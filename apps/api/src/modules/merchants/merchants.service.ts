import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, MerchantStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(tenantId: string, filters?: { estado?: MerchantStatus; categoria?: string }) {
    return this.prisma.merchant.findMany({
      where: {
        tenantId,
        estado: filters?.estado,
        categoria: filters?.categoria,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { tenantId, id },
      include: { branches: true },
    });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return merchant;
  }

  async create(tenantId: string, dto: CreateMerchantDto, actorId?: string) {
    const merchant = await this.prisma.merchant.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        categoria: dto.categoria,
        estado: dto.estado ?? MerchantStatus.PENDING,
        cuit: dto.cuit,
        merchantNumber: dto.merchantNumber,
        contactoEmail: dto.contactoEmail,
        telefono: dto.telefono,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Merchant',
      entityId: merchant.id,
      after: { nombre: merchant.nombre, estado: merchant.estado },
    });

    return merchant;
  }

  async update(tenantId: string, id: string, dto: UpdateMerchantDto, actorId?: string) {
    const before = await this.prisma.merchant.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Comercio no encontrado');
    }
    const merchant = await this.prisma.merchant.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        categoria: dto.categoria ?? undefined,
        estado: dto.estado ?? undefined,
        cuit: dto.cuit ?? undefined,
        merchantNumber: dto.merchantNumber ?? undefined,
        contactoEmail: dto.contactoEmail ?? undefined,
        telefono: dto.telefono ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Merchant',
      entityId: merchant.id,
      before: { nombre: before.nombre, estado: before.estado },
      after: { nombre: merchant.nombre, estado: merchant.estado },
    });

    return merchant;
  }

  async remove(tenantId: string, id: string, actorId?: string) {
    const before = await this.prisma.merchant.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Comercio no encontrado');
    }
    await this.prisma.merchant.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Merchant',
      entityId: id,
      before: { nombre: before.nombre, estado: before.estado },
    });

    return { ok: true };
  }

  async importCsv(tenantId: string, csv: Buffer, actorId?: string) {
    const rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const created = [] as string[];

    for (const row of rows) {
      const estadoRaw = (row.estado || row.Estado || row.ESTADO || '').toLowerCase();
      const estado = estadoRaw === 'activo'
        ? MerchantStatus.ACTIVE
        : estadoRaw === 'restringido'
          ? MerchantStatus.RESTRICTED
          : MerchantStatus.PENDING;

      const nombre = row.nombre || row.Nombre || row.comercio || row.Comercio || 'Sin nombre';
      const categoria = row.categoria || row.Categoria || 'Sin categoria';

      const merchant = await this.prisma.merchant.create({
        data: {
          tenantId,
          nombre,
          categoria,
          estado,
          cuit: row.cuit || row.CUIT,
          merchantNumber: row.merchantNumber || row.mid || row.MID,
          contactoEmail: row.contactoEmail || row.email,
          telefono: row.telefono || row.Telefono,
        },
      });
      created.push(merchant.id);

      await this.audit.log({
        tenantId,
        userId: actorId ?? null,
        action: AuditAction.CREATE,
        entity: 'Merchant',
        entityId: merchant.id,
        after: { nombre: merchant.nombre, estado: merchant.estado },
      });
    }

    return { created: created.length };
  }

  async exportCsv(tenantId: string) {
    const merchants = await this.prisma.merchant.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'nombre,categoria,estado,cuit,merchantNumber,contactoEmail,telefono';
    const lines = merchants.map((m) =>
      [
        m.nombre,
        m.categoria,
        m.estado,
        m.cuit ?? '',
        m.merchantNumber ?? '',
        m.contactoEmail ?? '',
        m.telefono ?? '',
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }
}
