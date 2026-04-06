import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PlacesService } from '../places/places.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, CardNetwork } from '@prisma/client';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private places: PlacesService,
    private audit: AuditService,
  ) {}

  private normalizeEstablishments(
    establishments?: Array<{ cardNetwork: CardNetwork; number: string }>,
  ) {
    const map = new Map<CardNetwork, string>();
    for (const establishment of establishments ?? []) {
      const normalizedNumber = establishment.number?.trim() ?? '';
      if (!normalizedNumber) continue;
      map.set(establishment.cardNetwork, normalizedNumber);
    }
    return Array.from(map.entries()).map(([cardNetwork, number]) => ({
      cardNetwork,
      number,
    }));
  }

  private async getAllowedCardNetworks(tenantId: string) {
    const configs = await this.prisma.bankCardCodeConfig.findMany({
      where: { tenantId },
      select: { network: true, active: true },
    });

    if (configs.length === 0) {
      return new Set<CardNetwork>([CardNetwork.VISA, CardNetwork.MASTERCARD]);
    }

    return new Set<CardNetwork>(
      configs.filter((item) => item.active).map((item) => item.network),
    );
  }

  private async syncEstablishments(
    tenantId: string,
    branchId: string,
    establishments?: Array<{ cardNetwork: CardNetwork; number: string }>,
  ) {
    if (establishments === undefined) return;

    const normalized = this.normalizeEstablishments(establishments);
    const allowedNetworks = await this.getAllowedCardNetworks(tenantId);

    for (const establishment of normalized) {
      if (!allowedNetworks.has(establishment.cardNetwork)) {
        throw new BadRequestException(
          `La tarjeta ${establishment.cardNetwork} no esta habilitada en la configuracion del banco.`,
        );
      }
    }

    await this.prisma.branchEstablishment.deleteMany({
      where: { tenantId, branchId },
    });

    if (normalized.length > 0) {
      await this.prisma.branchEstablishment.createMany({
        data: normalized.map((item) => ({
          tenantId,
          branchId,
          cardNetwork: item.cardNetwork,
          number: item.number,
        })),
      });
    }
  }

  private async assertRetailerBelongsToMerchant(tenantId: string, merchantId: string, retailerId: string) {
    const retailer = await this.prisma.brand.findFirst({
      where: { tenantId, id: retailerId },
      select: { id: true },
    });
    if (!retailer) {
      throw new BadRequestException('Retailer invalido');
    }

    const link = await this.prisma.brandLegalEntity.findFirst({
      where: { tenantId, merchantId, brandId: retailerId },
      select: { id: true },
    });
    if (!link) {
      throw new BadRequestException('El retailer no esta vinculado a la razon social');
    }
  }

  private async inferSingleRetailerId(tenantId: string, merchantId: string): Promise<string | null> {
    const links = await this.prisma.brandLegalEntity.findMany({
      where: { tenantId, merchantId },
      select: { brandId: true },
      take: 2,
    });
    if (links.length === 1) {
      return links[0].brandId;
    }
    return null;
  }

  private async resolveShoppingIdByName(tenantId: string, shoppingNombre?: string | null) {
    const normalizedName = shoppingNombre?.trim();
    if (!normalizedName) {
      return null;
    }

    const existing = await this.prisma.shopping.findFirst({
      where: { tenantId, nombre: { equals: normalizedName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.shopping.create({
      data: {
        tenantId,
        nombre: normalizedName,
        activo: true,
      },
      select: { id: true },
    });
    return created.id;
  }

  async listByMerchant(tenantId: string, merchantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, merchantId },
      orderBy: { createdAt: 'desc' },
      include: {
        retailer: {
          select: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
        shopping: true,
        establishments: true,
      },
    });
  }

  async get(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { tenantId, id },
      include: {
        retailer: {
          select: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
        shopping: true,
        establishments: true,
      },
    });
    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada');
    }
    return branch;
  }

  async isMerchantInBrand(tenantId: string, brandId: string, merchantId: string) {
    const link = await this.prisma.brandLegalEntity.findFirst({
      where: { tenantId, brandId, merchantId },
      select: { id: true },
    });
    return Boolean(link);
  }

  async create(tenantId: string, merchantId: string, dto: CreateBranchDto, actorId?: string) {
    const merchant = await this.prisma.merchant.findFirst({ where: { tenantId, id: merchantId } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }

    let retailerId = dto.retailerId?.trim() || '';
    if (retailerId) {
      await this.assertRetailerBelongsToMerchant(tenantId, merchantId, retailerId);
    } else {
      const inferredRetailerId = await this.inferSingleRetailerId(tenantId, merchantId);
      if (!inferredRetailerId) {
        const linkCount = await this.prisma.brandLegalEntity.count({
          where: { tenantId, merchantId },
        });
        if (linkCount === 0) {
          throw new BadRequestException(
            'La razon social no tiene retailers vinculados. Vincula un retailer antes de crear el PDV.',
          );
        }
        throw new BadRequestException(
          'La razon social tiene multiples retailers. Debes indicar retailerId para crear el PDV.',
        );
      }
      retailerId = inferredRetailerId;
    }

    let lat = dto.lat;
    let lng = dto.lng;
    if (dto.placeId && (lat === undefined || lng === undefined)) {
      const place = await this.places.lookupPlace(dto.placeId);
      if (place?.lat) {
        lat = place.lat;
        lng = place.lng;
      }
    }

    let shoppingIdToSet: string | undefined;
    if (dto.shoppingId?.trim()) {
      const shopping = await this.prisma.shopping.findFirst({
        where: { tenantId, id: dto.shoppingId.trim() },
        select: { id: true },
      });
      if (!shopping) {
        throw new BadRequestException('Shopping invalido');
      }
      shoppingIdToSet = shopping.id;
    } else if (dto.shoppingNombre !== undefined) {
      const resolvedByName = await this.resolveShoppingIdByName(tenantId, dto.shoppingNombre);
      shoppingIdToSet = resolvedByName ?? undefined;
    }

    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        merchantId,
        nombre: dto.nombre,
        direccion: dto.direccion,
        calle: dto.calle,
        numero: dto.numero,
        piso: dto.piso,
        codigoPostal: dto.codigoPostal,
        ciudad: dto.ciudad,
        provincia: dto.provincia,
        pais: dto.pais,
        placeId: dto.placeId,
        lat,
        lng,
        merchantNumber: dto.merchantNumber,
        processor: dto.processor,
        activo: dto.activo ?? true,
        shoppingId: shoppingIdToSet,
        retailerId,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Branch',
      entityId: branch.id,
      after: { nombre: branch.nombre, merchantId, retailerId: branch.retailerId, activo: branch.activo },
    });

    await this.syncEstablishments(tenantId, branch.id, dto.establishments);

    return this.get(tenantId, branch.id);
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto, actorId?: string) {
    const before = await this.get(tenantId, id);

    let retailerIdToSet: string | undefined;
    if (dto.retailerId !== undefined) {
      const normalizedRetailerId = dto.retailerId.trim();
      if (!normalizedRetailerId) {
        throw new BadRequestException('retailerId invalido');
      }
      await this.assertRetailerBelongsToMerchant(tenantId, before.merchantId, normalizedRetailerId);
      retailerIdToSet = normalizedRetailerId;
    } else if (!before.retailerId) {
      const inferredRetailerId = await this.inferSingleRetailerId(tenantId, before.merchantId);
      if (inferredRetailerId) {
        retailerIdToSet = inferredRetailerId;
      }
    }

    let shoppingIdToSet: string | null | undefined;
    if (dto.shoppingId !== undefined) {
      const normalizedShoppingId = dto.shoppingId.trim();
      if (!normalizedShoppingId) {
        shoppingIdToSet = null;
      } else {
        const shopping = await this.prisma.shopping.findFirst({
          where: { tenantId, id: normalizedShoppingId },
          select: { id: true },
        });
        if (!shopping) {
          throw new BadRequestException('Shopping invalido');
        }
        shoppingIdToSet = shopping.id;
      }
    } else if (dto.shoppingNombre !== undefined) {
      const resolvedByName = await this.resolveShoppingIdByName(tenantId, dto.shoppingNombre);
      shoppingIdToSet = resolvedByName;
    }

    let lat = dto.lat;
    let lng = dto.lng;
    if (dto.placeId && (lat === undefined || lng === undefined)) {
      const place = await this.places.lookupPlace(dto.placeId);
      if (place?.lat) {
        lat = place.lat;
        lng = place.lng;
      }
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        direccion: dto.direccion ?? undefined,
        calle: dto.calle ?? undefined,
        numero: dto.numero ?? undefined,
        piso: dto.piso ?? undefined,
        codigoPostal: dto.codigoPostal ?? undefined,
        ciudad: dto.ciudad ?? undefined,
        provincia: dto.provincia ?? undefined,
        pais: dto.pais ?? undefined,
        placeId: dto.placeId ?? undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        merchantNumber: dto.merchantNumber ?? undefined,
        processor: dto.processor ?? undefined,
        activo: dto.activo ?? undefined,
        shoppingId: shoppingIdToSet,
        retailerId: retailerIdToSet ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Branch',
      entityId: branch.id,
      before: {
        nombre: before.nombre,
        direccion: before.direccion,
        retailerId: before.retailerId,
        activo: before.activo,
      },
      after: {
        nombre: branch.nombre,
        direccion: branch.direccion,
        retailerId: branch.retailerId,
        activo: branch.activo,
      },
    });

    await this.syncEstablishments(tenantId, branch.id, dto.establishments);

    return this.get(tenantId, branch.id);
  }

  async remove(tenantId: string, id: string, actorId?: string) {
    const before = await this.get(tenantId, id);
    await this.prisma.branch.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Branch',
      entityId: id,
      before: { nombre: before.nombre },
    });

    return { ok: true };
  }
}
