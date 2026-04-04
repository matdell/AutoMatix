import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private normalizeNombre(value?: string) {
    return value?.trim() || '';
  }

  async list(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateCategoryDto, actorId?: string) {
    const nombre = this.normalizeNombre(dto.nombre);
    if (!nombre) {
      throw new BadRequestException('El nombre de la categoria es obligatorio');
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        tenantId,
        nombre: { equals: nombre, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Ya existe una categoria con ese nombre');
    }

    const category = await this.prisma.category.create({
      data: {
        tenantId,
        nombre,
        activo: dto.activo ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Category',
      entityId: category.id,
      after: { nombre: category.nombre, activo: category.activo },
    });

    return category;
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto, actorId?: string) {
    const before = await this.prisma.category.findFirst({
      where: { tenantId, id },
    });

    if (!before) {
      throw new NotFoundException('Categoria no encontrada');
    }

    const nombre = dto.nombre !== undefined ? this.normalizeNombre(dto.nombre) : undefined;
    if (dto.nombre !== undefined && !nombre) {
      throw new BadRequestException('El nombre de la categoria es obligatorio');
    }

    if (nombre && nombre.toLowerCase() !== before.nombre.toLowerCase()) {
      const existing = await this.prisma.category.findFirst({
        where: {
          tenantId,
          nombre: { equals: nombre, mode: 'insensitive' },
          id: { not: id },
        },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestException('Ya existe una categoria con ese nombre');
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        nombre: nombre ?? undefined,
        activo: dto.activo ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Category',
      entityId: category.id,
      before: { nombre: before.nombre, activo: before.activo },
      after: { nombre: category.nombre, activo: category.activo },
    });

    return category;
  }

  async remove(tenantId: string, id: string, actorId?: string) {
    const category = await this.prisma.category.findFirst({
      where: { tenantId, id },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada');
    }

    const [brandLinks, merchantLinks] = await Promise.all([
      this.prisma.brandCategory.count({
        where: {
          tenantId,
          categoryId: id,
        },
      }),
      this.prisma.merchant.count({
        where: {
          tenantId,
          categoria: { equals: category.nombre, mode: 'insensitive' },
        },
      }),
    ]);

    if (brandLinks > 0 || merchantLinks > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoria que esta en uso por retailers o razones sociales',
      );
    }

    await this.prisma.category.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Category',
      entityId: id,
      before: { nombre: category.nombre, activo: category.activo },
    });

    return { ok: true };
  }
}
