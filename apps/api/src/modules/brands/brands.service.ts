import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(tenantId: string) {
    return this.prisma.brand.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        legalEntities: {
          include: {
            merchant: {
              select: { id: true, nombre: true, cuit: true },
            },
          },
        },
      },
    });
  }

  async get(tenantId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { tenantId, id },
      include: {
        legalEntities: {
          include: {
            merchant: {
              select: { id: true, nombre: true, cuit: true },
            },
          },
        },
      },
    });
    if (!brand) {
      throw new NotFoundException('Marca no encontrada');
    }
    return brand;
  }

  async create(tenantId: string, dto: CreateBrandDto, actorId?: string) {
    const brand = await this.prisma.brand.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        activo: dto.activo ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Brand',
      entityId: brand.id,
      after: { nombre: brand.nombre, activo: brand.activo },
    });

    return brand;
  }

  async update(tenantId: string, id: string, dto: UpdateBrandDto, actorId?: string) {
    const before = await this.prisma.brand.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Marca no encontrada');
    }
    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        activo: dto.activo ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Brand',
      entityId: brand.id,
      before: { nombre: before.nombre, activo: before.activo },
      after: { nombre: brand.nombre, activo: brand.activo },
    });

    return brand;
  }

  async remove(tenantId: string, id: string, actorId?: string) {
    const brand = await this.prisma.brand.findFirst({ where: { tenantId, id } });
    if (!brand) {
      throw new NotFoundException('Marca no encontrada');
    }
    const linkCount = await this.prisma.brandLegalEntity.count({
      where: { tenantId, brandId: id },
    });
    if (linkCount > 0) {
      throw new BadRequestException('No se puede eliminar una marca con razones sociales vinculadas');
    }
    await this.prisma.brand.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Brand',
      entityId: id,
      before: { nombre: brand.nombre, activo: brand.activo },
    });

    return { ok: true };
  }

  async linkLegalEntity(tenantId: string, brandId: string, merchantId: string, actorId?: string) {
    const brand = await this.prisma.brand.findFirst({ where: { tenantId, id: brandId } });
    if (!brand) {
      throw new NotFoundException('Marca no encontrada');
    }
    const merchant = await this.prisma.merchant.findFirst({ where: { tenantId, id: merchantId } });
    if (!merchant) {
      throw new NotFoundException('Razon social no encontrada');
    }
    await this.prisma.brandLegalEntity.create({
      data: { tenantId, brandId, merchantId },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'BrandLegalEntity',
      entityId: `${brandId}:${merchantId}`,
      after: { brandId, merchantId },
    });

    return { ok: true };
  }

  async unlinkLegalEntity(tenantId: string, brandId: string, merchantId: string, actorId?: string) {
    const link = await this.prisma.brandLegalEntity.findFirst({
      where: { tenantId, brandId, merchantId },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException('Vinculo no encontrado');
    }
    await this.prisma.brandLegalEntity.delete({ where: { id: link.id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'BrandLegalEntity',
      entityId: `${brandId}:${merchantId}`,
      before: { brandId, merchantId },
    });

    return { ok: true };
  }
}
