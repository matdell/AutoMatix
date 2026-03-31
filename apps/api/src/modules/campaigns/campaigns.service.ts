import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, CampaignStatus, Prisma } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(
    tenantId: string,
    options?: { estado?: CampaignStatus; includeArchived?: boolean; q?: string },
  ) {
    const where: Prisma.CampaignWhereInput = { tenantId };
    if (options?.estado) {
      where.estado = options.estado;
    } else if (!options?.includeArchived) {
      where.estado = { not: CampaignStatus.ARCHIVED };
    }
    if (options?.q) {
      where.nombre = { contains: options.q, mode: 'insensitive' };
    }

    return this.prisma.campaign.findMany({
      where,
      include: {
        merchants: true,
        archivedBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { tenantId, id },
      include: { merchants: true },
    });
    if (!campaign) {
      throw new NotFoundException('Campana no encontrada');
    }
    return campaign;
  }

  async create(tenantId: string, dto: CreateCampaignDto, actorId?: string) {
    const condiciones = (dto.condiciones ?? {}) as Prisma.InputJsonValue;
    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        tipo: dto.tipo,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        condiciones,
        merchants: {
          create: dto.targets.map((target) => ({
            tenantId,
            merchantId: target.merchantId,
            branchId: target.branchId ?? null,
          })),
        },
      },
      include: { merchants: true },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Campaign',
      entityId: campaign.id,
      after: { nombre: campaign.nombre, estado: campaign.estado },
    });

    return campaign;
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto, actorId?: string) {
    const before = await this.prisma.campaign.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Campana no encontrada');
    }

    if (dto.targets) {
      await this.prisma.campaignMerchant.deleteMany({
        where: { tenantId, campaignId: id },
      });
    }

    const archiving = dto.estado === CampaignStatus.ARCHIVED && before.estado !== CampaignStatus.ARCHIVED;
    const restoring =
      dto.estado !== undefined &&
      dto.estado !== CampaignStatus.ARCHIVED &&
      before.estado === CampaignStatus.ARCHIVED;

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        tipo: dto.tipo ?? undefined,
        estado: dto.estado ?? undefined,
        estadoAnterior: archiving ? before.estado : restoring ? null : undefined,
        archivedAt: archiving ? new Date() : restoring ? null : undefined,
        archivedById: archiving ? actorId ?? null : restoring ? null : undefined,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
        condiciones: dto.condiciones
          ? (dto.condiciones as Prisma.InputJsonValue)
          : undefined,
        merchants: dto.targets
          ? {
              create: dto.targets.map((target) => ({
                tenantId,
                merchantId: target.merchantId,
                branchId: target.branchId ?? null,
              })),
            }
          : undefined,
      },
      include: { merchants: true },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Campaign',
      entityId: id,
      before: { nombre: before.nombre, estado: before.estado },
      after: { nombre: campaign.nombre, estado: campaign.estado },
    });

    return campaign;
  }

  async exportCsv(tenantId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId, estado: { not: CampaignStatus.ARCHIVED } },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'nombre,tipo,estado,fechaInicio,fechaFin';
    const lines = campaigns.map((c) =>
      [c.nombre, c.tipo, c.estado, c.fechaInicio.toISOString(), c.fechaFin.toISOString()].join(','),
    );

    return [header, ...lines].join('\n');
  }

  async archive(tenantId: string, id: string, actorId?: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { tenantId, id } });
    if (!campaign) {
      throw new NotFoundException('Campana no encontrada');
    }
    if (campaign.estado === CampaignStatus.ARCHIVED) {
      return campaign;
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        estado: CampaignStatus.ARCHIVED,
        estadoAnterior: campaign.estado,
        archivedAt: new Date(),
        archivedById: actorId ?? null,
      },
      include: {
        merchants: true,
        archivedBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Campaign',
      entityId: id,
      before: { estado: campaign.estado },
      after: { estado: updated.estado },
    });

    return updated;
  }

  async restore(tenantId: string, id: string, actorId?: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { tenantId, id } });
    if (!campaign) {
      throw new NotFoundException('Campana no encontrada');
    }
    if (campaign.estado !== CampaignStatus.ARCHIVED) {
      return campaign;
    }

    const restoredEstado = campaign.estadoAnterior ?? CampaignStatus.INVITED;
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        estado: restoredEstado,
        estadoAnterior: null,
        archivedAt: null,
        archivedById: null,
      },
      include: {
        merchants: true,
        archivedBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Campaign',
      entityId: id,
      before: { estado: campaign.estado },
      after: { estado: updated.estado },
    });

    return updated;
  }
}
