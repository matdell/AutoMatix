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
        categories: {
          include: { category: true },
        },
        legalEntities: {
          include: {
            merchant: {
              select: { id: true, nombre: true, razonSocial: true, cuit: true },
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
        categories: {
          include: { category: true },
        },
        legalEntities: {
          include: {
            merchant: {
              select: { id: true, nombre: true, razonSocial: true, cuit: true },
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
    const rubros = this.normalizeRubros(dto.rubros);
    if (rubros.length === 0) {
      throw new BadRequestException('La categoria es obligatoria para el retailer');
    }
    const brand = await this.prisma.brand.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        logoUrl: dto.logoUrl ?? undefined,
        sitioWeb: dto.sitioWeb ?? undefined,
        facebook: dto.facebook ?? undefined,
        instagram: dto.instagram ?? undefined,
        twitter: dto.twitter ?? undefined,
        emailPrincipal: dto.emailPrincipal ?? undefined,
        telefonoPrincipal: dto.telefonoPrincipal ?? undefined,
        processor: dto.processor ?? undefined,
        activo: dto.activo ?? true,
      },
    });

    if (rubros.length) {
      const categories = await this.ensureCategories(tenantId, rubros);
      await this.prisma.brandCategory.createMany({
        data: categories.map((category) => ({
          tenantId,
          brandId: brand.id,
          categoryId: category.id,
        })),
        skipDuplicates: true,
      });
    }

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Brand',
      entityId: brand.id,
      after: {
        nombre: brand.nombre,
        logoUrl: brand.logoUrl,
        sitioWeb: brand.sitioWeb,
        facebook: brand.facebook,
        instagram: brand.instagram,
        twitter: brand.twitter,
        emailPrincipal: brand.emailPrincipal,
        telefonoPrincipal: brand.telefonoPrincipal,
        processor: brand.processor,
        activo: brand.activo,
        rubros,
      },
    });

    return brand;
  }

  async update(tenantId: string, id: string, dto: UpdateBrandDto, actorId?: string) {
    const before = await this.prisma.brand.findFirst({
      where: { tenantId, id },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });
    if (!before) {
      throw new NotFoundException('Marca no encontrada');
    }
    const rubros = dto.rubros ? this.normalizeRubros(dto.rubros) : null;
    if (rubros && rubros.length === 0) {
      throw new BadRequestException('La categoria es obligatoria para el retailer');
    }
    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        logoUrl: dto.logoUrl ?? undefined,
        sitioWeb: dto.sitioWeb ?? undefined,
        facebook: dto.facebook ?? undefined,
        instagram: dto.instagram ?? undefined,
        twitter: dto.twitter ?? undefined,
        emailPrincipal: dto.emailPrincipal ?? undefined,
        telefonoPrincipal: dto.telefonoPrincipal ?? undefined,
        processor: dto.processor ?? undefined,
        activo: dto.activo ?? undefined,
      },
    });

    if (rubros) {
      await this.prisma.brandCategory.deleteMany({
        where: { tenantId, brandId: id },
      });
      if (rubros.length) {
        const categories = await this.ensureCategories(tenantId, rubros);
        await this.prisma.brandCategory.createMany({
          data: categories.map((category) => ({
            tenantId,
            brandId: id,
            categoryId: category.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    const beforeRubros = before.categories?.map((entry) => entry.category.nombre) ?? [];
    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Brand',
      entityId: brand.id,
      before: {
        nombre: before.nombre,
        logoUrl: before.logoUrl,
        sitioWeb: before.sitioWeb,
        facebook: before.facebook,
        instagram: before.instagram,
        twitter: before.twitter,
        emailPrincipal: before.emailPrincipal,
        telefonoPrincipal: before.telefonoPrincipal,
        processor: before.processor,
        activo: before.activo,
        rubros: beforeRubros,
      },
      after: {
        nombre: brand.nombre,
        logoUrl: brand.logoUrl,
        sitioWeb: brand.sitioWeb,
        facebook: brand.facebook,
        instagram: brand.instagram,
        twitter: brand.twitter,
        emailPrincipal: brand.emailPrincipal,
        telefonoPrincipal: brand.telefonoPrincipal,
        processor: brand.processor,
        activo: brand.activo,
        rubros: rubros ?? beforeRubros,
      },
    });

    return brand;
  }

  private normalizeRubros(rubros?: string[]) {
    return (rubros ?? [])
      .map((rubro) => rubro.trim())
      .filter(Boolean);
  }

  private async ensureCategories(tenantId: string, rubros: string[]) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
    });
    const categoryByName = new Map(
      categories.map((category) => [category.nombre.toLowerCase(), category] as const),
    );

    const resolved: typeof categories = [];
    const seen = new Set<string>();

    for (const rubro of rubros) {
      const key = rubro.toLowerCase();
      if (seen.has(key)) continue;
      const category = categoryByName.get(key);
      if (!category) {
        throw new BadRequestException(`Categoria invalida: ${rubro}`);
      }
      seen.add(key);
      resolved.push(category);
    }

    return resolved;
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
