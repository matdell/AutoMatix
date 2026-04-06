import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  CampaignAdhesionStatus,
  CampaignBenefitType,
  CampaignCloseType,
  CampaignCommercialStatus,
  CampaignLocationLevel,
  CampaignStatus,
  CampaignTargetMode,
  Prisma,
} from '@prisma/client';

type ResolvedCampaignInput = {
  nombre: string;
  campaignTypeConfigId: string;
  closeType: CampaignCloseType;
  commercialStatus: CampaignCommercialStatus;
  codigoInterno: string | null;
  codigoExterno: string | null;
  fechaVigDesde: Date;
  fechaVigHasta: Date;
  fechaCierre: Date | null;
  dias: string[];
  fechaPrioridad: Date | null;
  paymentMethodIds: string[];
  retailerIds: string[];
  branchIds: string[];
  categoryIds: string[];
  shoppingIds: string[];
  targetAllShoppings: boolean;
  locationLevel: CampaignLocationLevel | null;
  locationValues: string[];
  condiciones: Prisma.InputJsonValue | null;
  processorCodes: Array<{ processor: string; code: string }>;
  adhesiones: Array<{ merchantId: string; status: CampaignAdhesionStatus }>;
  eligibility: Prisma.InputJsonValue | null;
  resolvedBines: string[];
};

@Injectable()
export class CampaignsService implements OnModuleInit, OnModuleDestroy {
  private readonly dayCodes = new Set(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  private autoFinalizeTimer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    this.autoFinalizeTimer = setInterval(() => {
      void this.autoFinalizeExpiredCampaigns();
    }, 5 * 60 * 1000);
    void this.autoFinalizeExpiredCampaigns();
  }

  onModuleDestroy() {
    if (this.autoFinalizeTimer) {
      clearInterval(this.autoFinalizeTimer);
      this.autoFinalizeTimer = null;
    }
  }

  private get campaignInclude(): Prisma.CampaignInclude {
    return {
      campaignTypeConfig: true,
      targetRetailers: {
        include: {
          retailer: {
            select: {
              id: true,
              nombre: true,
              activo: true,
            },
          },
        },
      },
      targetBranches: {
        include: {
          branch: {
            select: {
              id: true,
              nombre: true,
              activo: true,
              retailerId: true,
              ciudad: true,
              provincia: true,
              pais: true,
              direccion: true,
              shopping: { select: { id: true, nombre: true } },
              retailer: { select: { id: true, nombre: true } },
            },
          },
        },
      },
      targetCategories: {
        include: {
          category: {
            select: {
              id: true,
              nombre: true,
              activo: true,
            },
          },
        },
      },
      targetShoppings: {
        include: {
          shopping: {
            select: {
              id: true,
              nombre: true,
              activo: true,
            },
          },
        },
      },
      targetLocations: {
        select: {
          id: true,
          level: true,
          value: true,
        },
      },
      paymentMethods: {
        include: {
          cardCodeConfig: {
            select: {
              id: true,
              network: true,
              label: true,
              active: true,
              sortOrder: true,
            },
          },
        },
      },
      processorCodes: {
        select: {
          id: true,
          processor: true,
          code: true,
        },
      },
      merchantAdhesions: {
        include: {
          merchant: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      },
      archivedBy: {
        select: {
          id: true,
          nombre: true,
          email: true,
        },
      },
    };
  }

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
    if (options?.q?.trim()) {
      where.nombre = { contains: options.q.trim(), mode: 'insensitive' };
    }

    return this.prisma.campaign.findMany({
      where,
      include: this.campaignInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { tenantId, id },
      include: this.campaignInclude,
    });
    if (!campaign) {
      throw new NotFoundException('Campana no encontrada');
    }
    return campaign;
  }

  async create(tenantId: string, dto: CreateCampaignDto, actorId?: string) {
    const resolved = await this.resolveInput(tenantId, dto);
    const condicionesValue =
      resolved.condiciones === null ? Prisma.DbNull : resolved.condiciones;
    const eligibilityValue =
      resolved.eligibility === null ? Prisma.DbNull : resolved.eligibility;

    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        nombre: resolved.nombre,
        campaignTypeConfigId: resolved.campaignTypeConfigId,
        closeType: resolved.closeType,
        estado: CampaignStatus.EDITING,
        commercialStatus: resolved.commercialStatus,
        codigoInterno: resolved.codigoInterno,
        codigoExterno: resolved.codigoExterno,
        fechaVigDesde: resolved.fechaVigDesde,
        fechaVigHasta: resolved.fechaVigHasta,
        fechaCierre: resolved.fechaCierre,
        dias: resolved.dias,
        targetAllShoppings: resolved.targetAllShoppings,
        locationLevel: resolved.locationLevel,
        fechaPrioridad: resolved.fechaPrioridad,
        condiciones: condicionesValue,
        eligibility: eligibilityValue,
        resolvedBines: resolved.resolvedBines,
        targetRetailers: {
          create: resolved.retailerIds.map((retailerId) => ({
            tenantId,
            retailerId,
          })),
        },
        targetBranches: {
          create: resolved.branchIds.map((branchId) => ({
            tenantId,
            branchId,
          })),
        },
        targetCategories: {
          create: resolved.categoryIds.map((categoryId) => ({
            tenantId,
            categoryId,
          })),
        },
        targetShoppings: {
          create: resolved.shoppingIds.map((shoppingId) => ({
            tenantId,
            shoppingId,
          })),
        },
        targetLocations: {
          create: resolved.locationValues.map((value) => ({
            tenantId,
            level: resolved.locationLevel as CampaignLocationLevel,
            value,
          })),
        },
        paymentMethods: {
          create: resolved.paymentMethodIds.map((cardCodeConfigId) => ({
            tenantId,
            cardCodeConfigId,
          })),
        },
        processorCodes: {
          create: resolved.processorCodes.map((item) => ({
            tenantId,
            processor: item.processor,
            code: item.code,
          })),
        },
        merchantAdhesions: {
          create: resolved.adhesiones.map((item) => ({
            tenantId,
            merchantId: item.merchantId,
            status: item.status,
          })),
        },
      },
      include: this.campaignInclude,
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
    const before = await this.prisma.campaign.findFirst({
      where: { tenantId, id },
      include: {
        targetRetailers: { select: { retailerId: true } },
        targetBranches: { select: { branchId: true } },
        targetCategories: { select: { categoryId: true } },
        targetShoppings: { select: { shoppingId: true } },
        targetLocations: { select: { level: true, value: true } },
        paymentMethods: { select: { cardCodeConfigId: true } },
        processorCodes: { select: { processor: true, code: true } },
        merchantAdhesions: { select: { merchantId: true, status: true } },
      },
    });
    if (!before) {
      throw new NotFoundException('Campana no encontrada');
    }

    if (before.estado === CampaignStatus.ARCHIVED) {
      throw new BadRequestException('No se puede editar una campana archivada');
    }

    const mergedInput: CreateCampaignDto = {
      nombre: dto.nombre ?? before.nombre,
      campaignTypeConfigId: dto.campaignTypeConfigId ?? before.campaignTypeConfigId,
      closeType: dto.closeType ?? before.closeType,
      commercialStatus: dto.commercialStatus ?? before.commercialStatus,
      codigoInterno: dto.codigoInterno !== undefined ? dto.codigoInterno : before.codigoInterno ?? undefined,
      codigoExterno: dto.codigoExterno !== undefined ? dto.codigoExterno : before.codigoExterno ?? undefined,
      fechaVigDesde: dto.fechaVigDesde ?? before.fechaVigDesde.toISOString(),
      fechaVigHasta: dto.fechaVigHasta ?? before.fechaVigHasta.toISOString(),
      fechaCierre:
        dto.fechaCierre !== undefined
          ? dto.fechaCierre
          : before.fechaCierre
            ? before.fechaCierre.toISOString()
            : undefined,
      dias: dto.dias ?? before.dias,
      tienePrioridad:
        dto.tienePrioridad !== undefined
          ? dto.tienePrioridad
          : Boolean(before.fechaPrioridad),
      fechaPrioridad:
        dto.fechaPrioridad !== undefined
          ? dto.fechaPrioridad
          : before.fechaPrioridad
            ? before.fechaPrioridad.toISOString()
            : undefined,
      paymentMethodIds:
        dto.paymentMethodIds ??
        before.paymentMethods.map((item) => item.cardCodeConfigId),
      retailerIds:
        dto.retailerIds ??
        before.targetRetailers.map((item) => item.retailerId),
      branchIds:
        dto.branchIds ??
        before.targetBranches.map((item) => item.branchId),
      categoryIds:
        dto.categoryIds ??
        before.targetCategories.map((item) => item.categoryId),
      shoppingIds:
        dto.shoppingIds ??
        before.targetShoppings.map((item) => item.shoppingId),
      targetAllShoppings:
        dto.targetAllShoppings !== undefined
          ? dto.targetAllShoppings
          : before.targetAllShoppings,
      locationLevel:
        dto.locationLevel !== undefined
          ? dto.locationLevel
          : before.locationLevel ?? undefined,
      locationValues:
        dto.locationValues ??
        before.targetLocations.map((item) => item.value),
      condiciones: dto.condiciones ?? ((before.condiciones as Record<string, unknown> | null) ?? undefined),
      processorCodes:
        dto.processorCodes ??
        before.processorCodes.map((item) => ({
          processor: item.processor,
          code: item.code,
        })),
      adhesiones:
        dto.adhesiones ??
        before.merchantAdhesions.map((item) => ({
          merchantId: item.merchantId,
          status: item.status,
        })),
      eligibility:
        dto.eligibility ??
        ((before.eligibility as Record<string, unknown> | null) ?? undefined),
    };

    const resolved = await this.resolveInput(tenantId, mergedInput, before.id);
    const condicionesValue =
      resolved.condiciones === null ? Prisma.DbNull : resolved.condiciones;
    const eligibilityValue =
      resolved.eligibility === null ? Prisma.DbNull : resolved.eligibility;

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        nombre: resolved.nombre,
        campaignTypeConfigId: resolved.campaignTypeConfigId,
        closeType: resolved.closeType,
        commercialStatus: resolved.commercialStatus,
        codigoInterno: resolved.codigoInterno,
        codigoExterno: resolved.codigoExterno,
        fechaVigDesde: resolved.fechaVigDesde,
        fechaVigHasta: resolved.fechaVigHasta,
        fechaCierre: resolved.fechaCierre,
        dias: resolved.dias,
        targetAllShoppings: resolved.targetAllShoppings,
        locationLevel: resolved.locationLevel,
        fechaPrioridad: resolved.fechaPrioridad,
        condiciones: condicionesValue,
        eligibility: eligibilityValue,
        resolvedBines: resolved.resolvedBines,
        targetRetailers: {
          deleteMany: { campaignId: id },
          create: resolved.retailerIds.map((retailerId) => ({
            tenantId,
            retailerId,
          })),
        },
        targetBranches: {
          deleteMany: { campaignId: id },
          create: resolved.branchIds.map((branchId) => ({
            tenantId,
            branchId,
          })),
        },
        targetCategories: {
          deleteMany: { campaignId: id },
          create: resolved.categoryIds.map((categoryId) => ({
            tenantId,
            categoryId,
          })),
        },
        targetShoppings: {
          deleteMany: { campaignId: id },
          create: resolved.shoppingIds.map((shoppingId) => ({
            tenantId,
            shoppingId,
          })),
        },
        targetLocations: {
          deleteMany: { campaignId: id },
          create: resolved.locationValues.map((value) => ({
            tenantId,
            level: resolved.locationLevel as CampaignLocationLevel,
            value,
          })),
        },
        paymentMethods: {
          deleteMany: { campaignId: id },
          create: resolved.paymentMethodIds.map((cardCodeConfigId) => ({
            tenantId,
            cardCodeConfigId,
          })),
        },
        processorCodes: {
          deleteMany: { campaignId: id },
          create: resolved.processorCodes.map((item) => ({
            tenantId,
            processor: item.processor,
            code: item.code,
          })),
        },
        merchantAdhesions: {
          deleteMany: { campaignId: id },
          create: resolved.adhesiones.map((item) => ({
            tenantId,
            merchantId: item.merchantId,
            status: item.status,
          })),
        },
      },
      include: this.campaignInclude,
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

  async transition(
    tenantId: string,
    id: string,
    targetStatus: CampaignStatus,
    actorId?: string,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { tenantId, id },
    });
    if (!campaign) {
      throw new NotFoundException('Campana no encontrada');
    }

    if (campaign.estado === targetStatus) {
      return this.get(tenantId, id);
    }

    if (!this.canTransition(campaign.estado, targetStatus)) {
      throw new BadRequestException('Transicion de estado invalida');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        estado: targetStatus,
      },
      include: this.campaignInclude,
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

  async exportCsv(tenantId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId, estado: { not: CampaignStatus.ARCHIVED } },
      include: {
        campaignTypeConfig: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'nombre,tipo,estado,estadoComercial,codigoInterno,codigoExterno,fechaVigDesde,fechaVigHasta,closeType';
    const lines = campaigns.map((campaign) =>
      [
        campaign.nombre,
        campaign.campaignTypeConfig.nombre,
        campaign.estado,
        campaign.commercialStatus,
        campaign.codigoInterno ?? '',
        campaign.codigoExterno ?? '',
        campaign.fechaVigDesde.toISOString(),
        campaign.fechaVigHasta.toISOString(),
        campaign.closeType,
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }

  async archive(tenantId: string, id: string, actorId?: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { tenantId, id } });
    if (!campaign) {
      throw new NotFoundException('Campana no encontrada');
    }
    if (campaign.estado === CampaignStatus.ARCHIVED) {
      return this.get(tenantId, id);
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        estado: CampaignStatus.ARCHIVED,
        estadoAnterior: campaign.estado,
        archivedAt: new Date(),
        archivedById: actorId ?? null,
      },
      include: this.campaignInclude,
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
      return this.get(tenantId, id);
    }

    const restoredEstado = campaign.estadoAnterior ?? CampaignStatus.EDITING;
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        estado: restoredEstado,
        estadoAnterior: null,
        archivedAt: null,
        archivedById: null,
      },
      include: this.campaignInclude,
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

  private canTransition(from: CampaignStatus, to: CampaignStatus) {
    if (from === CampaignStatus.ARCHIVED) {
      return false;
    }
    const transitions: Record<CampaignStatus, CampaignStatus[]> = {
      [CampaignStatus.EDITING]: [CampaignStatus.PENDING, CampaignStatus.CANCELLED, CampaignStatus.ARCHIVED],
      [CampaignStatus.PENDING]: [
        CampaignStatus.EDITING,
        CampaignStatus.ACTIVE,
        CampaignStatus.CANCELLED,
        CampaignStatus.ARCHIVED,
      ],
      [CampaignStatus.ACTIVE]: [
        CampaignStatus.EDITING,
        CampaignStatus.CANCELLED,
        CampaignStatus.FINALIZED,
        CampaignStatus.ARCHIVED,
      ],
      [CampaignStatus.FINALIZED]: [CampaignStatus.ARCHIVED],
      [CampaignStatus.CANCELLED]: [CampaignStatus.ARCHIVED],
      [CampaignStatus.ARCHIVED]: [],
    };
    return transitions[from]?.includes(to) ?? false;
  }

  private parseDate(value: string, label: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Fecha invalida en ${label}`);
    }
    return parsed;
  }

  private normalizeUnique(ids?: string[]) {
    return Array.from(
      new Set((ids ?? []).map((value) => value.trim()).filter((value) => value.length > 0)),
    );
  }

  private formatDateInTimezone(date: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private async resolveInput(
    tenantId: string,
    dto: CreateCampaignDto | UpdateCampaignDto,
    campaignId?: string,
  ): Promise<ResolvedCampaignInput> {
    const nombre = dto.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const campaignTypeConfigId = dto.campaignTypeConfigId?.trim();
    if (!campaignTypeConfigId) {
      throw new BadRequestException('El tipo de campana es obligatorio');
    }

    const typeConfig = await this.prisma.bankCampaignTypeConfig.findFirst({
      where: {
        tenantId,
        id: campaignTypeConfigId,
      },
    });
    if (!typeConfig) {
      throw new BadRequestException('Tipo de campana invalido');
    }

    const closeType = dto.closeType;
    if (!closeType) {
      throw new BadRequestException('El tipo de cierre es obligatorio');
    }

    const commercialStatus = dto.commercialStatus ?? CampaignCommercialStatus.INVITACION;

    const codigoInterno =
      dto.codigoInterno === undefined
        ? null
        : dto.codigoInterno.trim().length > 0
          ? dto.codigoInterno.trim()
          : null;

    const codigoExterno =
      dto.codigoExterno === undefined
        ? null
        : dto.codigoExterno.trim().length > 0
          ? dto.codigoExterno.trim()
          : null;

    if (codigoInterno) {
      const duplicated = await this.prisma.campaign.findFirst({
        where: {
          tenantId,
          codigoInterno,
          id: campaignId ? { not: campaignId } : undefined,
        },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException('Ya existe una campana con ese codigo interno');
      }
    }

    const fechaVigDesde = this.parseDate((dto as CreateCampaignDto).fechaVigDesde, 'fechaVigDesde');
    const fechaVigHasta = this.parseDate((dto as CreateCampaignDto).fechaVigHasta, 'fechaVigHasta');
    if (fechaVigDesde > fechaVigHasta) {
      throw new BadRequestException('La fecha de vigencia desde no puede ser mayor a la fecha hasta');
    }

    let fechaCierre: Date | null = null;
    if (closeType === CampaignCloseType.WITH_CLOSE_DATE) {
      if (!dto.fechaCierre) {
        throw new BadRequestException('La fecha de cierre es obligatoria para este tipo de cierre');
      }
      fechaCierre = this.parseDate(dto.fechaCierre, 'fechaCierre');
      if (fechaCierre > fechaVigDesde) {
        throw new BadRequestException('La fecha de cierre no puede ser posterior al inicio de vigencia');
      }
    }

    const dias = this.normalizeUnique(dto.dias);
    if (dias.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un dia');
    }
    for (const dia of dias) {
      if (!this.dayCodes.has(dia)) {
        throw new BadRequestException(`Dia invalido: ${dia}`);
      }
    }

    const tienePrioridad = dto.tienePrioridad ?? false;
    let fechaPrioridad: Date | null = null;
    if (tienePrioridad) {
      if (!dto.fechaPrioridad) {
        throw new BadRequestException('La fecha de prioridad es obligatoria');
      }
      fechaPrioridad = this.parseDate(dto.fechaPrioridad, 'fechaPrioridad');
      if (fechaPrioridad < fechaVigDesde || fechaPrioridad > fechaVigHasta) {
        throw new BadRequestException('La fecha de prioridad debe estar dentro de la vigencia');
      }
    } else if (dto.fechaPrioridad) {
      fechaPrioridad = this.parseDate(dto.fechaPrioridad, 'fechaPrioridad');
    }

    const paymentMethodIds = this.normalizeUnique(dto.paymentMethodIds);
    if (paymentMethodIds.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un medio de pago');
    }
    const validPaymentMethods = await this.prisma.bankCardCodeConfig.findMany({
      where: {
        tenantId,
        active: true,
        id: { in: paymentMethodIds },
      },
      select: { id: true },
    });
    if (validPaymentMethods.length !== paymentMethodIds.length) {
      throw new BadRequestException('Hay medios de pago invalidos o inactivos');
    }

    let retailerIds = this.normalizeUnique(dto.retailerIds);
    let branchIds = this.normalizeUnique(dto.branchIds);
    let categoryIds = this.normalizeUnique(dto.categoryIds);
    let shoppingIds = this.normalizeUnique(dto.shoppingIds);
    let targetAllShoppings = dto.targetAllShoppings ?? false;
    let locationLevel = dto.locationLevel ?? null;
    let locationValues = this.normalizeUnique(dto.locationValues);

    switch (typeConfig.mode) {
      case CampaignTargetMode.RUBROS: {
        retailerIds = [];
        branchIds = [];
        shoppingIds = [];
        targetAllShoppings = false;
        locationLevel = null;
        locationValues = [];
        if (categoryIds.length === 0) {
          throw new BadRequestException('Debe seleccionar al menos un rubro para este tipo de campana');
        }
        const categories = await this.prisma.category.findMany({
          where: {
            tenantId,
            activo: true,
            id: { in: categoryIds },
          },
          select: { id: true },
        });
        if (categories.length !== categoryIds.length) {
          throw new BadRequestException('Hay rubros invalidos o inactivos');
        }
        break;
      }

      case CampaignTargetMode.RETAILER_PDV: {
        categoryIds = [];
        shoppingIds = [];
        targetAllShoppings = false;
        locationLevel = null;
        locationValues = [];
        if (retailerIds.length === 0 && branchIds.length === 0) {
          throw new BadRequestException('Debe seleccionar retailers o puntos de venta');
        }

        if (retailerIds.length > 0) {
          const retailers = await this.prisma.brand.findMany({
            where: {
              tenantId,
              id: { in: retailerIds },
            },
            select: { id: true },
          });
          if (retailers.length !== retailerIds.length) {
            throw new BadRequestException('Hay retailers invalidos');
          }
        }

        let branches: Array<{ id: string; retailerId: string | null }> = [];
        if (branchIds.length > 0) {
          branches = await this.prisma.branch.findMany({
            where: {
              tenantId,
              activo: true,
              id: { in: branchIds },
            },
            select: { id: true, retailerId: true },
          });
          if (branches.length !== branchIds.length) {
            throw new BadRequestException('Hay puntos de venta invalidos o inactivos');
          }
        }

        if (retailerIds.length > 0 && branches.length > 0) {
          const selectedRetailers = new Set(retailerIds);
          branchIds = branches
            .filter((branch) => !branch.retailerId || !selectedRetailers.has(branch.retailerId))
            .map((branch) => branch.id);
        }
        break;
      }

      case CampaignTargetMode.SHOPPING: {
        retailerIds = [];
        branchIds = [];
        categoryIds = [];
        locationLevel = null;
        locationValues = [];

        if (!targetAllShoppings && shoppingIds.length === 0) {
          throw new BadRequestException(
            'Debe seleccionar todos los shoppings o al menos un shopping especifico',
          );
        }

        if (targetAllShoppings) {
          shoppingIds = [];
        } else if (shoppingIds.length > 0) {
          const shoppings = await this.prisma.shopping.findMany({
            where: {
              tenantId,
              activo: true,
              id: { in: shoppingIds },
            },
            select: { id: true },
          });
          if (shoppings.length !== shoppingIds.length) {
            throw new BadRequestException('Hay shoppings invalidos o inactivos');
          }
        }
        break;
      }

      case CampaignTargetMode.LOCATION: {
        retailerIds = [];
        branchIds = [];
        categoryIds = [];
        targetAllShoppings = false;
        shoppingIds = [];

        if (!locationLevel) {
          throw new BadRequestException(
            'Debe seleccionar el nivel de ubicacion (pais, provincia o ciudad)',
          );
        }
        if (locationValues.length === 0) {
          throw new BadRequestException('Debe seleccionar al menos una ubicacion');
        }

        const activeBranches = await this.prisma.branch.findMany({
          where: { tenantId, activo: true },
          select: {
            pais: true,
            provincia: true,
            ciudad: true,
          },
        });

        const availableValues = new Set<string>();
        for (const branch of activeBranches) {
          const rawValue =
            locationLevel === CampaignLocationLevel.COUNTRY
              ? branch.pais
              : locationLevel === CampaignLocationLevel.PROVINCE
                ? branch.provincia
                : branch.ciudad;
          const normalizedValue = rawValue?.trim();
          if (normalizedValue) {
            availableValues.add(normalizedValue.toLowerCase());
          }
        }

        if (availableValues.size === 0) {
          throw new BadRequestException('No hay puntos de venta activos con datos de ubicacion');
        }

        const invalidLocations = locationValues.filter(
          (value) => !availableValues.has(value.trim().toLowerCase()),
        );
        if (invalidLocations.length > 0) {
          throw new BadRequestException('Hay ubicaciones invalidas para el nivel seleccionado');
        }
        break;
      }

      default:
        throw new BadRequestException('Modo de tipo de campana no soportado');
    }

    const processorCodesByKey = new Map<string, { processor: string; code: string }>();
    for (const item of dto.processorCodes ?? []) {
      const processor = item.processor?.trim();
      const code = item.code?.trim();
      if (!processor || !code) {
        throw new BadRequestException('Cada codigo de procesadora debe tener procesadora y codigo');
      }
      const uniqueKey = `${processor.toLowerCase()}::${code.toLowerCase()}`;
      if (!processorCodesByKey.has(uniqueKey)) {
        processorCodesByKey.set(uniqueKey, { processor, code });
      }
    }
    const processorCodes = Array.from(processorCodesByKey.values());

    const adhesionByMerchantId = new Map<string, CampaignAdhesionStatus>();
    for (const item of dto.adhesiones ?? []) {
      const merchantId = item.merchantId?.trim();
      if (!merchantId) {
        throw new BadRequestException('Cada adhesion debe incluir merchantId');
      }
      adhesionByMerchantId.set(merchantId, item.status ?? CampaignAdhesionStatus.PENDIENTE);
    }
    const adhesiones = Array.from(adhesionByMerchantId.entries()).map(([merchantId, status]) => ({
      merchantId,
      status,
    }));
    if (adhesiones.length > 0) {
      const merchants = await this.prisma.merchant.findMany({
        where: {
          tenantId,
          id: { in: adhesiones.map((item) => item.merchantId) },
        },
        select: { id: true },
      });
      if (merchants.length !== adhesiones.length) {
        throw new BadRequestException('Hay adhesiones con comercios invalidos');
      }
    }

    const normalizeFilterValues = (values?: string[]) =>
      Array.from(
        new Set((values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
      );
    const normalizeBinValues = (values?: string[]) => {
      const normalized = Array.from(
        new Set(
          (values ?? [])
            .map((value) => value.replace(/\D/g, '').trim())
            .filter((value) => value.length > 0),
        ),
      );
      for (const bin of normalized) {
        if (!/^\d{6,10}$/.test(bin)) {
          throw new BadRequestException(`BIN invalido en override: ${bin}`);
        }
      }
      return normalized;
    };

    let eligibility: Prisma.InputJsonValue | null = null;
    let resolvedBines: string[] = [];

    if (dto.eligibility !== undefined) {
      const network = normalizeFilterValues(dto.eligibility?.network);
      const cardType = normalizeFilterValues(dto.eligibility?.cardType);
      const segment = normalizeFilterValues(dto.eligibility?.segment);
      const alliance = normalizeFilterValues(dto.eligibility?.alliance);
      const channel = normalizeFilterValues(dto.eligibility?.channel);
      const product = normalizeFilterValues(dto.eligibility?.product);
      const binesFinalesOverride = normalizeBinValues(dto.eligibility?.binesFinalesOverride);

      const activeBinConfigs = await this.prisma.bankBinConfig.findMany({
        where: { tenantId, active: true },
        select: {
          bin: true,
          network: true,
          cardType: true,
          segment: true,
          alliance: true,
          channel: true,
          product: true,
        },
      });

      let filtered = activeBinConfigs;
      const applyFilter = (
        values: string[],
        resolver: (item: (typeof activeBinConfigs)[number]) => string | null,
      ) => {
        if (values.length === 0) return;
        const normalizedSet = new Set(values.map((value) => value.toLowerCase()));
        filtered = filtered.filter((item) => {
          const resolved = resolver(item)?.trim();
          if (!resolved) return false;
          return normalizedSet.has(resolved.toLowerCase());
        });
      };

      applyFilter(network, (item) => item.network);
      applyFilter(cardType, (item) => item.cardType);
      applyFilter(segment, (item) => item.segment ?? null);
      applyFilter(alliance, (item) => item.alliance ?? null);
      applyFilter(channel, (item) => item.channel ?? null);
      applyFilter(product, (item) => item.product ?? null);

      resolvedBines = Array.from(
        new Set([...filtered.map((item) => item.bin), ...binesFinalesOverride]),
      ).sort();

      eligibility = {
        network,
        cardType,
        segment,
        alliance,
        channel,
        product,
        binesFinalesOverride,
      } as Prisma.InputJsonValue;
    }

    const parseOptionalNumber = (value: unknown, fieldName: string) => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`El campo ${fieldName} debe ser numerico`);
      }
      return parsed;
    };

    const parseOptionalInteger = (value: unknown, fieldName: string) => {
      const parsed = parseOptionalNumber(value, fieldName);
      if (parsed === null) return null;
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException(`El campo ${fieldName} debe ser un entero positivo`);
      }
      return parsed;
    };

    const normalizeEnumValue = <T extends string>(
      value: unknown,
      allowedValues: readonly T[],
      fieldName: string,
    ): T | null => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string') {
        throw new BadRequestException(`El campo ${fieldName} es invalido`);
      }
      const normalized = value.trim().toUpperCase() as T;
      if (!allowedValues.includes(normalized)) {
        throw new BadRequestException(`El campo ${fieldName} es invalido`);
      }
      return normalized;
    };

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      Boolean(value) && typeof value === 'object' && !Array.isArray(value);

    let condiciones: Prisma.InputJsonValue | null = null;
    let descuentoPorcentaje: number | null = null;
    let cuotasCantidad: number | null = null;
    let cuotasModo: 'NO_APLICA' | 'SIN_INTERES' | 'CON_FINANCIACION' | null = null;
    let cashbackModo: 'NO_APLICA' | 'PORCENTAJE' | 'MONTO' | null = null;
    let cashbackValor: number | null = null;
    let financiacionModalidad: string | null = null;
    let repartoCosto: 'BANCO_100' | 'COMPARTIDO' | 'PROCESADORA' | 'OTRO' | null = null;

    if (dto.condiciones !== undefined) {
      if (!isRecord(dto.condiciones)) {
        throw new BadRequestException('El campo condiciones debe ser un objeto JSON');
      }

      descuentoPorcentaje = parseOptionalNumber(dto.condiciones.descuentoPorcentaje, 'descuentoPorcentaje');
      if (descuentoPorcentaje !== null && (descuentoPorcentaje < 0 || descuentoPorcentaje > 100)) {
        throw new BadRequestException('descuentoPorcentaje debe estar entre 0 y 100');
      }

      cuotasCantidad = parseOptionalInteger(dto.condiciones.cuotasCantidad, 'cuotasCantidad');
      cuotasModo = normalizeEnumValue(
        dto.condiciones.cuotasModo,
        ['NO_APLICA', 'SIN_INTERES', 'CON_FINANCIACION'] as const,
        'cuotasModo',
      );

      cashbackModo = normalizeEnumValue(
        dto.condiciones.cashbackModo,
        ['NO_APLICA', 'PORCENTAJE', 'MONTO'] as const,
        'cashbackModo',
      );
      cashbackValor = parseOptionalNumber(dto.condiciones.cashbackValor, 'cashbackValor');
      if (cashbackModo === 'PORCENTAJE' && cashbackValor !== null && (cashbackValor < 0 || cashbackValor > 100)) {
        throw new BadRequestException('cashbackValor debe estar entre 0 y 100 cuando cashbackModo es PORCENTAJE');
      }
      if (cashbackModo === 'MONTO' && cashbackValor !== null && cashbackValor <= 0) {
        throw new BadRequestException('cashbackValor debe ser mayor a 0 cuando cashbackModo es MONTO');
      }

      const financiacionRaw = dto.condiciones.financiacionModalidad;
      if (financiacionRaw !== undefined && financiacionRaw !== null && financiacionRaw !== '') {
        if (typeof financiacionRaw !== 'string') {
          throw new BadRequestException('financiacionModalidad debe ser texto');
        }
        financiacionModalidad = financiacionRaw.trim();
      }

      repartoCosto = normalizeEnumValue(
        dto.condiciones.repartoCosto,
        ['BANCO_100', 'COMPARTIDO', 'PROCESADORA', 'OTRO'] as const,
        'repartoCosto',
      );

      const condicionesKeys = new Set([
        'descuentoPorcentaje',
        'cuotasCantidad',
        'cuotasModo',
        'cashbackModo',
        'cashbackValor',
        'financiacionModalidad',
        'repartoCosto',
      ]);
      const extras = Object.fromEntries(
        Object.entries(dto.condiciones).filter(([key]) => !condicionesKeys.has(key)),
      );

      const normalizedCondiciones: Record<string, unknown> = {};
      if (descuentoPorcentaje !== null) normalizedCondiciones.descuentoPorcentaje = descuentoPorcentaje;
      if (cuotasCantidad !== null) normalizedCondiciones.cuotasCantidad = cuotasCantidad;
      if (cuotasModo !== null) normalizedCondiciones.cuotasModo = cuotasModo;
      if (cashbackModo !== null) normalizedCondiciones.cashbackModo = cashbackModo;
      if (cashbackValor !== null) normalizedCondiciones.cashbackValor = cashbackValor;
      if (financiacionModalidad) normalizedCondiciones.financiacionModalidad = financiacionModalidad;
      if (repartoCosto !== null) normalizedCondiciones.repartoCosto = repartoCosto;
      if (Object.keys(extras).length > 0) normalizedCondiciones.extras = extras;

      condiciones =
        Object.keys(normalizedCondiciones).length > 0
          ? (normalizedCondiciones as Prisma.InputJsonValue)
          : null;
    }

    switch (typeConfig.benefitType) {
      case CampaignBenefitType.DISCOUNT:
        if (descuentoPorcentaje === null) {
          throw new BadRequestException('Para campanas de descuento debes informar descuentoPorcentaje en condiciones');
        }
        break;
      case CampaignBenefitType.INSTALLMENTS:
        if (cuotasCantidad === null) {
          throw new BadRequestException('Para campanas de cuotas debes informar cuotasCantidad en condiciones');
        }
        break;
      case CampaignBenefitType.INSTALLMENTS_DISCOUNT:
        if (cuotasCantidad === null || descuentoPorcentaje === null) {
          throw new BadRequestException('Para campanas de cuotas + descuento debes informar cuotasCantidad y descuentoPorcentaje');
        }
        break;
      case CampaignBenefitType.CASHBACK:
        if (!cashbackModo || cashbackModo === 'NO_APLICA' || cashbackValor === null) {
          throw new BadRequestException('Para campanas de cashback debes informar cashbackModo y cashbackValor');
        }
        break;
      case CampaignBenefitType.FINANCING:
        if (cuotasModo !== 'CON_FINANCIACION' && !financiacionModalidad) {
          throw new BadRequestException('Para campanas de financiacion debes informar cuotas con financiacion o modalidad');
        }
        break;
      case CampaignBenefitType.BANK_CREDENTIAL:
        if (repartoCosto !== 'BANCO_100') {
          throw new BadRequestException('Para campanas credencial/100% banco el repartoCosto debe ser BANCO_100');
        }
        break;
      default:
        break;
    }

    return {
      nombre,
      campaignTypeConfigId,
      closeType,
      commercialStatus,
      codigoInterno,
      codigoExterno,
      fechaVigDesde,
      fechaVigHasta,
      fechaCierre,
      dias,
      fechaPrioridad,
      paymentMethodIds,
      retailerIds,
      branchIds,
      categoryIds,
      shoppingIds,
      targetAllShoppings,
      locationLevel,
      locationValues,
      condiciones,
      processorCodes,
      adhesiones,
      eligibility,
      resolvedBines,
    };
  }

  private async autoFinalizeExpiredCampaigns() {
    const now = new Date();
    const activeCampaigns = await this.prisma.campaign.findMany({
      where: {
        estado: CampaignStatus.ACTIVE,
      },
      select: {
        id: true,
        tenantId: true,
        nombre: true,
        fechaVigHasta: true,
        bank: {
          select: {
            timezone: true,
          },
        },
      },
    });

    for (const campaign of activeCampaigns) {
      const timezone = campaign.bank.timezone || 'America/Argentina/Buenos_Aires';
      const today = this.formatDateInTimezone(now, timezone);
      const endDate = this.formatDateInTimezone(campaign.fechaVigHasta, timezone);
      if (endDate >= today) {
        continue;
      }

      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          estado: CampaignStatus.FINALIZED,
        },
      });

      await this.audit.log({
        tenantId: campaign.tenantId,
        userId: null,
        action: AuditAction.UPDATE,
        entity: 'Campaign',
        entityId: campaign.id,
        before: { estado: CampaignStatus.ACTIVE, motivo: 'AUTO_FINALIZE' },
        after: { estado: CampaignStatus.FINALIZED, motivo: 'AUTO_FINALIZE' },
      });
    }
  }
}
