import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PlacesService } from '../places/places.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private places: PlacesService,
    private audit: AuditService,
  ) {}

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

    const retailerId = dto.retailerId?.trim() || '';
    if (!retailerId) {
      throw new BadRequestException('El retailer es obligatorio para crear el PDV');
    }
    await this.assertRetailerBelongsToMerchant(tenantId, merchantId, retailerId);

    let lat = dto.lat;
    let lng = dto.lng;
    if (dto.placeId && (lat === undefined || lng === undefined)) {
      const place = await this.places.lookupPlace(dto.placeId);
      if (place?.lat) {
        lat = place.lat;
        lng = place.lng;
      }
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
        shoppingId: dto.shoppingId,
        retailerId,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Branch',
      entityId: branch.id,
      after: { nombre: branch.nombre, merchantId, retailerId: branch.retailerId },
    });

    return branch;
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
      } else {
        throw new BadRequestException('El retailer es obligatorio para actualizar este PDV');
      }
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
        shoppingId: dto.shoppingId ?? undefined,
        retailerId: retailerIdToSet ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Branch',
      entityId: branch.id,
      before: { nombre: before.nombre, direccion: before.direccion, retailerId: before.retailerId },
      after: { nombre: branch.nombre, direccion: branch.direccion, retailerId: branch.retailerId },
    });

    return branch;
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
