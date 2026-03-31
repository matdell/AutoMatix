import { Injectable, NotFoundException } from '@nestjs/common';
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

  async listByMerchant(tenantId: string, merchantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, merchantId },
      orderBy: { createdAt: 'desc' },
      include: {
        shopping: true,
        establishments: true,
      },
    });
  }

  async get(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { tenantId, id },
      include: { shopping: true, establishments: true },
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
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Branch',
      entityId: branch.id,
      after: { nombre: branch.nombre, merchantId },
    });

    return branch;
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto, actorId?: string) {
    const before = await this.get(tenantId, id);

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
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Branch',
      entityId: branch.id,
      before: { nombre: before.nombre, direccion: before.direccion },
      after: { nombre: branch.nombre, direccion: branch.direccion },
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
