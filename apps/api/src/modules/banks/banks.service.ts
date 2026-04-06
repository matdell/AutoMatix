import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { UpdateBankSuperadminDto } from './dto/update-bank-superadmin.dto';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  CampaignBenefitType,
  CampaignTargetMode,
  CardNetwork,
  ProvisioningStatus,
  Role,
} from '@prisma/client';
import { CreateBankCardCodeConfigDto } from './dto/create-bank-card-code-config.dto';
import { UpdateBankCardCodeConfigDto } from './dto/update-bank-card-code-config.dto';
import { CreateBankCategoryDto } from './dto/create-bank-category.dto';
import { UpdateBankCategoryDto } from './dto/update-bank-category.dto';
import { CreateBankShoppingDto } from './dto/create-bank-shopping.dto';
import { UpdateBankShoppingDto } from './dto/update-bank-shopping.dto';
import { CreateBankProcessorConfigDto } from './dto/create-bank-processor-config.dto';
import { UpdateBankProcessorConfigDto } from './dto/update-bank-processor-config.dto';
import { CreateBankCampaignTypeConfigDto } from './dto/create-bank-campaign-type-config.dto';
import { UpdateBankCampaignTypeConfigDto } from './dto/update-bank-campaign-type-config.dto';
import { CreateBankBinConfigDto } from './dto/create-bank-bin-config.dto';
import { UpdateBankBinConfigDto } from './dto/update-bank-bin-config.dto';

const CARD_CODE_DEFAULTS: Array<{ network: CardNetwork; label: string; sortOrder: number }> = [
  { network: CardNetwork.VISA, label: 'Visa', sortOrder: 10 },
  { network: CardNetwork.MASTERCARD, label: 'Mastercard', sortOrder: 20 },
  { network: CardNetwork.AMEX, label: 'American Express', sortOrder: 30 },
  { network: CardNetwork.CABAL, label: 'Cabal', sortOrder: 40 },
  { network: CardNetwork.NARANJA, label: 'Naranja', sortOrder: 50 },
  { network: CardNetwork.OTRA, label: 'Otra', sortOrder: 60 },
];

const PROCESSOR_DEFAULTS: Array<{ nombre: string; sortOrder: number }> = [
  { nombre: 'Prisma', sortOrder: 10 },
  { nombre: 'MODO', sortOrder: 20 },
];

const CAMPAIGN_TYPE_DEFAULTS: Array<{
  nombre: string;
  benefitType: CampaignBenefitType;
  mode: CampaignTargetMode;
  locked: boolean;
  sortOrder: number;
}> = [
  {
    nombre: 'Descuento',
    benefitType: CampaignBenefitType.DISCOUNT,
    mode: CampaignTargetMode.RETAILER_PDV,
    locked: true,
    sortOrder: 10,
  },
  {
    nombre: 'Cuotas',
    benefitType: CampaignBenefitType.INSTALLMENTS,
    mode: CampaignTargetMode.RETAILER_PDV,
    locked: true,
    sortOrder: 20,
  },
  {
    nombre: 'Cuotas + Descuento',
    benefitType: CampaignBenefitType.INSTALLMENTS_DISCOUNT,
    mode: CampaignTargetMode.RETAILER_PDV,
    locked: true,
    sortOrder: 30,
  },
  {
    nombre: 'Cashback',
    benefitType: CampaignBenefitType.CASHBACK,
    mode: CampaignTargetMode.RETAILER_PDV,
    locked: true,
    sortOrder: 40,
  },
  {
    nombre: 'Financiacion',
    benefitType: CampaignBenefitType.FINANCING,
    mode: CampaignTargetMode.RETAILER_PDV,
    locked: true,
    sortOrder: 50,
  },
  {
    nombre: 'Credencial / 100% aporte banco',
    benefitType: CampaignBenefitType.BANK_CREDENTIAL,
    mode: CampaignTargetMode.RETAILER_PDV,
    locked: true,
    sortOrder: 60,
  },
];

@Injectable()
export class BanksService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private normalizePaymentMethod(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeComparableName(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeBin(value: string) {
    return value.replace(/\D/g, '').trim();
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeShoppingGroup(value?: string | null) {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private resolveNetworkFromPaymentMethod(value: string): CardNetwork | null {
    const normalized = this.normalizePaymentMethod(value);
    if (normalized === 'visa') return CardNetwork.VISA;
    if (normalized === 'mastercard' || normalized === 'master') return CardNetwork.MASTERCARD;
    if (normalized === 'amex' || normalized === 'american express') return CardNetwork.AMEX;
    if (normalized === 'cabal') return CardNetwork.CABAL;
    if (normalized === 'naranja') return CardNetwork.NARANJA;
    if (normalized === 'otra' || normalized === 'other') return CardNetwork.OTRA;
    return null;
  }

  private getDefaultCardCodeLabel(network: CardNetwork) {
    return CARD_CODE_DEFAULTS.find((item) => item.network === network)?.label ?? network;
  }

  private getDefaultCardCodeSortOrder(network: CardNetwork) {
    return CARD_CODE_DEFAULTS.find((item) => item.network === network)?.sortOrder ?? 999;
  }

  private getActiveNetworksFromPaymentMethods(paymentMethods?: string[] | null) {
    const networks = new Set<CardNetwork>();
    for (const method of paymentMethods ?? []) {
      const resolved = this.resolveNetworkFromPaymentMethod(method);
      if (resolved) {
        networks.add(resolved);
      }
    }
    if (networks.size === 0) {
      networks.add(CardNetwork.VISA);
      networks.add(CardNetwork.MASTERCARD);
    }
    return Array.from(networks.values());
  }

  private async syncBankPaymentMethodsFromCardCodeConfigs(tenantId: string) {
    const activeConfigs = await this.prisma.bankCardCodeConfig.findMany({
      where: { tenantId, active: true },
      select: { label: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    await this.prisma.bank.update({
      where: { id: tenantId },
      data: {
        paymentMethods: activeConfigs.map((item) => item.label),
      },
    });
  }

  private async ensureCardCodeConfigs(tenantId: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: tenantId },
      select: { id: true, paymentMethods: true },
    });
    if (!bank) {
      return;
    }

    const existingCount = await this.prisma.bankCardCodeConfig.count({ where: { tenantId } });
    if (existingCount > 0) {
      return;
    }

    const activeNetworks = this.getActiveNetworksFromPaymentMethods(bank.paymentMethods);
    await this.prisma.bankCardCodeConfig.createMany({
      data: activeNetworks.map((network) => ({
        tenantId,
        network,
        label: this.getDefaultCardCodeLabel(network),
        active: true,
        sortOrder: this.getDefaultCardCodeSortOrder(network),
      })),
      skipDuplicates: true,
    });

    await this.syncBankPaymentMethodsFromCardCodeConfigs(tenantId);
  }

  private async ensureProcessorConfigs(tenantId: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!bank) {
      return;
    }

    const existingCount = await this.prisma.bankProcessorConfig.count({ where: { tenantId } });
    if (existingCount > 0) {
      return;
    }

    await this.prisma.bankProcessorConfig.createMany({
      data: PROCESSOR_DEFAULTS.map((item) => ({
        tenantId,
        nombre: item.nombre,
        active: true,
        sortOrder: item.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  private async ensureCampaignTypeConfigs(tenantId: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!bank) {
      return;
    }

    const existing = await this.prisma.bankCampaignTypeConfig.findMany({
      where: { tenantId },
      select: {
        benefitType: true,
        locked: true,
      },
    });
    const existingLockedByBenefitType = new Set(
      existing.filter((item) => item.locked).map((item) => item.benefitType),
    );

    const missingDefaults = CAMPAIGN_TYPE_DEFAULTS.filter(
      (item) => !existingLockedByBenefitType.has(item.benefitType),
    );
    if (missingDefaults.length === 0) {
      return;
    }

    await this.prisma.bankCampaignTypeConfig.createMany({
      data: missingDefaults.map((item) => ({
        tenantId,
        nombre: item.nombre,
        benefitType: item.benefitType,
        mode: item.mode,
        locked: item.locked,
        active: true,
        sortOrder: item.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  async listCardCodeConfigs(tenantId: string, options?: { activeOnly?: boolean }) {
    await this.ensureCardCodeConfigs(tenantId);
    return this.prisma.bankCardCodeConfig.findMany({
      where: {
        tenantId,
        active: options?.activeOnly ? true : undefined,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createCardCodeConfig(tenantId: string, dto: CreateBankCardCodeConfigDto, actorId?: string) {
    await this.ensureCardCodeConfigs(tenantId);

    const existing = await this.prisma.bankCardCodeConfig.findFirst({
      where: { tenantId, network: dto.network },
    });
    if (existing) {
      throw new BadRequestException('Ya existe una configuracion para esa tarjeta. Editala o habilitala.');
    }

    const label = dto.label?.trim() || this.getDefaultCardCodeLabel(dto.network);
    const created = await this.prisma.bankCardCodeConfig.create({
      data: {
        tenantId,
        network: dto.network,
        label,
        active: dto.active ?? true,
        sortOrder: this.getDefaultCardCodeSortOrder(dto.network),
      },
    });

    await this.syncBankPaymentMethodsFromCardCodeConfigs(tenantId);

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'BankCardCodeConfig',
      entityId: created.id,
      after: {
        network: created.network,
        label: created.label,
        active: created.active,
        sortOrder: created.sortOrder,
      },
    });

    return created;
  }

  async updateCardCodeConfig(
    tenantId: string,
    id: string,
    dto: UpdateBankCardCodeConfigDto,
    actorId?: string,
  ) {
    await this.ensureCardCodeConfigs(tenantId);

    const before = await this.prisma.bankCardCodeConfig.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Configuracion de codigo de comercio no encontrada');
    }

    const label = dto.label === undefined ? undefined : dto.label.trim();
    if (dto.label !== undefined && label === '') {
      throw new BadRequestException('El nombre de la tarjeta no puede quedar vacio');
    }

    const updated = await this.prisma.bankCardCodeConfig.update({
      where: { id },
      data: {
        label,
        active: dto.active ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });

    await this.syncBankPaymentMethodsFromCardCodeConfigs(tenantId);

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'BankCardCodeConfig',
      entityId: updated.id,
      before: {
        network: before.network,
        label: before.label,
        active: before.active,
        sortOrder: before.sortOrder,
      },
      after: {
        network: updated.network,
        label: updated.label,
        active: updated.active,
        sortOrder: updated.sortOrder,
      },
    });

    return updated;
  }

  async removeCardCodeConfig(tenantId: string, id: string, actorId?: string) {
    await this.ensureCardCodeConfigs(tenantId);

    const before = await this.prisma.bankCardCodeConfig.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Configuracion de codigo de comercio no encontrada');
    }

    await this.prisma.bankCardCodeConfig.delete({ where: { id } });
    await this.syncBankPaymentMethodsFromCardCodeConfigs(tenantId);

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'BankCardCodeConfig',
      entityId: id,
      before: {
        network: before.network,
        label: before.label,
        active: before.active,
        sortOrder: before.sortOrder,
      },
    });

    return { ok: true };
  }

  async listCategories(tenantId: string, options?: { activeOnly?: boolean }) {
    return this.prisma.category.findMany({
      where: {
        tenantId,
        activo: options?.activeOnly ? true : undefined,
      },
      orderBy: [{ nombre: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createCategory(tenantId: string, dto: CreateBankCategoryDto, actorId?: string) {
    const nombre = dto.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre de la categoria es obligatorio');
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        tenantId,
        nombre: { equals: nombre, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new BadRequestException('Ya existe una categoria con ese nombre');
    }

    const created = await this.prisma.category.create({
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
      entityId: created.id,
      after: {
        nombre: created.nombre,
        activo: created.activo,
      },
    });

    return created;
  }

  async updateCategory(tenantId: string, id: string, dto: UpdateBankCategoryDto, actorId?: string) {
    const before = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Categoria no encontrada');
    }

    let nombre: string | undefined;
    if (dto.nombre !== undefined) {
      nombre = dto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException('El nombre de la categoria no puede quedar vacio');
      }

      const duplicated = await this.prisma.category.findFirst({
        where: {
          tenantId,
          id: { not: id },
          nombre: { equals: nombre, mode: 'insensitive' },
        },
      });
      if (duplicated) {
        throw new BadRequestException('Ya existe una categoria con ese nombre');
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        nombre,
        activo: dto.activo ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Category',
      entityId: updated.id,
      before: {
        nombre: before.nombre,
        activo: before.activo,
      },
      after: {
        nombre: updated.nombre,
        activo: updated.activo,
      },
    });

    return updated;
  }

  async removeCategory(tenantId: string, id: string, actorId?: string) {
    const before = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Categoria no encontrada');
    }

    const linkedBrands = await this.prisma.brandCategory.count({
      where: {
        tenantId,
        categoryId: id,
      },
    });
    if (linkedBrands > 0) {
      throw new BadRequestException('No se puede eliminar una categoria en uso por retailers');
    }

    await this.prisma.category.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Category',
      entityId: id,
      before: {
        nombre: before.nombre,
        activo: before.activo,
      },
    });

    return { ok: true };
  }

  async listShoppings(tenantId: string, options?: { activeOnly?: boolean }) {
    return this.prisma.shopping.findMany({
      where: {
        tenantId,
        activo: options?.activeOnly ? true : undefined,
      },
      orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createShopping(tenantId: string, dto: CreateBankShoppingDto, actorId?: string) {
    const nombre = dto.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre del shopping es obligatorio');
    }

    const existing = await this.prisma.shopping.findFirst({
      where: {
        tenantId,
        nombre: { equals: nombre, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un shopping con ese nombre');
    }

    const created = await this.prisma.shopping.create({
      data: {
        tenantId,
        nombre,
        grupo: this.normalizeShoppingGroup(dto.grupo),
        activo: dto.activo ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Shopping',
      entityId: created.id,
      after: {
        nombre: created.nombre,
        grupo: created.grupo,
        activo: created.activo,
      },
    });

    return created;
  }

  async updateShopping(tenantId: string, id: string, dto: UpdateBankShoppingDto, actorId?: string) {
    const before = await this.prisma.shopping.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Shopping no encontrado');
    }

    let nombre: string | undefined;
    if (dto.nombre !== undefined) {
      nombre = dto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException('El nombre del shopping no puede quedar vacio');
      }

      const duplicated = await this.prisma.shopping.findFirst({
        where: {
          tenantId,
          id: { not: id },
          nombre: { equals: nombre, mode: 'insensitive' },
        },
      });
      if (duplicated) {
        throw new BadRequestException('Ya existe un shopping con ese nombre');
      }
    }

    let grupo: string | null | undefined;
    if (dto.grupo !== undefined) {
      grupo = this.normalizeShoppingGroup(dto.grupo);
    }

    const updated = await this.prisma.shopping.update({
      where: { id },
      data: {
        nombre,
        grupo,
        activo: dto.activo ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Shopping',
      entityId: updated.id,
      before: {
        nombre: before.nombre,
        grupo: before.grupo,
        activo: before.activo,
      },
      after: {
        nombre: updated.nombre,
        grupo: updated.grupo,
        activo: updated.activo,
      },
    });

    return updated;
  }

  async removeShopping(tenantId: string, id: string, actorId?: string) {
    const before = await this.prisma.shopping.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Shopping no encontrado');
    }

    const linkedBranches = await this.prisma.branch.count({
      where: {
        tenantId,
        shoppingId: id,
      },
    });
    if (linkedBranches > 0) {
      throw new BadRequestException('No se puede eliminar un shopping en uso por puntos de venta');
    }

    await this.prisma.shopping.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Shopping',
      entityId: id,
      before: {
        nombre: before.nombre,
        activo: before.activo,
      },
    });

    return { ok: true };
  }

  async listProcessorConfigs(tenantId: string, options?: { activeOnly?: boolean }) {
    await this.ensureProcessorConfigs(tenantId);
    return this.prisma.bankProcessorConfig.findMany({
      where: {
        tenantId,
        active: options?.activeOnly ? true : undefined,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createProcessorConfig(
    tenantId: string,
    dto: CreateBankProcessorConfigDto,
    actorId?: string,
  ) {
    await this.ensureProcessorConfigs(tenantId);

    const nombre = dto.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre del procesador es obligatorio');
    }

    const existing = await this.prisma.bankProcessorConfig.findMany({
      where: { tenantId },
      select: { id: true, nombre: true },
    });
    const normalizedNombre = this.normalizeComparableName(nombre);
    const duplicated = existing.find(
      (item) => this.normalizeComparableName(item.nombre) === normalizedNombre,
    );
    if (duplicated) {
      throw new BadRequestException('Ya existe un procesador con ese nombre');
    }

    const created = await this.prisma.bankProcessorConfig.create({
      data: {
        tenantId,
        nombre,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 999,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'BankProcessorConfig',
      entityId: created.id,
      after: {
        nombre: created.nombre,
        active: created.active,
        sortOrder: created.sortOrder,
      },
    });

    return created;
  }

  async updateProcessorConfig(
    tenantId: string,
    id: string,
    dto: UpdateBankProcessorConfigDto,
    actorId?: string,
  ) {
    await this.ensureProcessorConfigs(tenantId);

    const before = await this.prisma.bankProcessorConfig.findFirst({
      where: { tenantId, id },
    });
    if (!before) {
      throw new NotFoundException('Procesador no encontrado');
    }

    let nombre: string | undefined;
    if (dto.nombre !== undefined) {
      nombre = dto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException('El nombre del procesador no puede quedar vacio');
      }

      const existing = await this.prisma.bankProcessorConfig.findMany({
        where: {
          tenantId,
          id: { not: id },
        },
        select: { nombre: true },
      });
      const normalizedNombre = this.normalizeComparableName(nombre);
      const duplicated = existing.find(
        (item) => this.normalizeComparableName(item.nombre) === normalizedNombre,
      );
      if (duplicated) {
        throw new BadRequestException('Ya existe un procesador con ese nombre');
      }
    }

    const updated = await this.prisma.bankProcessorConfig.update({
      where: { id },
      data: {
        nombre,
        active: dto.active ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'BankProcessorConfig',
      entityId: updated.id,
      before: {
        nombre: before.nombre,
        active: before.active,
        sortOrder: before.sortOrder,
      },
      after: {
        nombre: updated.nombre,
        active: updated.active,
        sortOrder: updated.sortOrder,
      },
    });

    return updated;
  }

  async removeProcessorConfig(tenantId: string, id: string, actorId?: string) {
    await this.ensureProcessorConfigs(tenantId);

    const before = await this.prisma.bankProcessorConfig.findFirst({
      where: { tenantId, id },
    });
    if (!before) {
      throw new NotFoundException('Procesador no encontrado');
    }

    await this.prisma.bankProcessorConfig.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'BankProcessorConfig',
      entityId: id,
      before: {
        nombre: before.nombre,
        active: before.active,
        sortOrder: before.sortOrder,
      },
    });

    return { ok: true };
  }

  async listCampaignTypeConfigs(tenantId: string, options?: { activeOnly?: boolean }) {
    await this.ensureCampaignTypeConfigs(tenantId);
    return this.prisma.bankCampaignTypeConfig.findMany({
      where: {
        tenantId,
        active: options?.activeOnly ? true : undefined,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createCampaignTypeConfig(
    tenantId: string,
    dto: CreateBankCampaignTypeConfigDto,
    actorId?: string,
  ) {
    await this.ensureCampaignTypeConfigs(tenantId);

    const nombre = dto.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre del tipo de campana es obligatorio');
    }

    const existing = await this.prisma.bankCampaignTypeConfig.findMany({
      where: { tenantId },
      select: { nombre: true },
    });
    const normalizedNombre = this.normalizeComparableName(nombre);
    const duplicated = existing.find(
      (item) => this.normalizeComparableName(item.nombre) === normalizedNombre,
    );
    if (duplicated) {
      throw new BadRequestException('Ya existe un tipo de campana con ese nombre');
    }

    const created = await this.prisma.bankCampaignTypeConfig.create({
      data: {
        tenantId,
        nombre,
        benefitType: dto.benefitType,
        mode: dto.mode,
        locked: false,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 999,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'BankCampaignTypeConfig',
      entityId: created.id,
      after: {
        nombre: created.nombre,
        benefitType: created.benefitType,
        mode: created.mode,
        locked: created.locked,
        active: created.active,
        sortOrder: created.sortOrder,
      },
    });

    return created;
  }

  async updateCampaignTypeConfig(
    tenantId: string,
    id: string,
    dto: UpdateBankCampaignTypeConfigDto,
    actorId?: string,
  ) {
    await this.ensureCampaignTypeConfigs(tenantId);

    const before = await this.prisma.bankCampaignTypeConfig.findFirst({
      where: { tenantId, id },
    });
    if (!before) {
      throw new NotFoundException('Tipo de campana no encontrado');
    }

    let nombre: string | undefined;
    if (dto.nombre !== undefined) {
      nombre = dto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException('El nombre del tipo de campana no puede quedar vacio');
      }

      const existing = await this.prisma.bankCampaignTypeConfig.findMany({
        where: {
          tenantId,
          id: { not: id },
        },
        select: { nombre: true },
      });
      const normalizedNombre = this.normalizeComparableName(nombre);
      const duplicated = existing.find(
        (item) => this.normalizeComparableName(item.nombre) === normalizedNombre,
      );
      if (duplicated) {
        throw new BadRequestException('Ya existe un tipo de campana con ese nombre');
      }
    }

    if (before.locked && dto.benefitType && dto.benefitType !== before.benefitType) {
      throw new BadRequestException('No se puede cambiar el tipo comercial de un tipo base');
    }

    const updated = await this.prisma.bankCampaignTypeConfig.update({
      where: { id },
      data: {
        nombre,
        benefitType: dto.benefitType ?? undefined,
        mode: dto.mode ?? undefined,
        active: dto.active ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'BankCampaignTypeConfig',
      entityId: updated.id,
      before: {
        nombre: before.nombre,
        benefitType: before.benefitType,
        mode: before.mode,
        locked: before.locked,
        active: before.active,
        sortOrder: before.sortOrder,
      },
      after: {
        nombre: updated.nombre,
        benefitType: updated.benefitType,
        mode: updated.mode,
        locked: updated.locked,
        active: updated.active,
        sortOrder: updated.sortOrder,
      },
    });

    return updated;
  }

  async removeCampaignTypeConfig(tenantId: string, id: string, actorId?: string) {
    await this.ensureCampaignTypeConfigs(tenantId);

    const before = await this.prisma.bankCampaignTypeConfig.findFirst({
      where: { tenantId, id },
    });
    if (!before) {
      throw new NotFoundException('Tipo de campana no encontrado');
    }
    if (before.locked) {
      throw new BadRequestException('No se puede eliminar un tipo base del sistema');
    }

    const linkedCampaigns = await this.prisma.campaign.count({
      where: {
        tenantId,
        campaignTypeConfigId: id,
      },
    });
    if (linkedCampaigns > 0) {
      throw new BadRequestException('No se puede eliminar un tipo de campana en uso por campanas');
    }

    await this.prisma.bankCampaignTypeConfig.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'BankCampaignTypeConfig',
      entityId: id,
      before: {
        nombre: before.nombre,
        benefitType: before.benefitType,
        mode: before.mode,
        locked: before.locked,
        active: before.active,
        sortOrder: before.sortOrder,
      },
    });

    return { ok: true };
  }

  async listBinConfigs(tenantId: string, options?: { activeOnly?: boolean }) {
    return this.prisma.bankBinConfig.findMany({
      where: {
        tenantId,
        active: options?.activeOnly ? true : undefined,
      },
      orderBy: [
        { network: 'asc' },
        { cardType: 'asc' },
        { segment: 'asc' },
        { alliance: 'asc' },
        { bin: 'asc' },
      ],
    });
  }

  async createBinConfig(tenantId: string, dto: CreateBankBinConfigDto, actorId?: string) {
    const bin = this.normalizeBin(dto.bin);
    if (!/^\d{6,10}$/.test(bin)) {
      throw new BadRequestException('El BIN debe tener entre 6 y 10 digitos');
    }

    const network = dto.network?.trim();
    const cardType = dto.cardType?.trim();
    if (!network) {
      throw new BadRequestException('La marca es obligatoria');
    }
    if (!cardType) {
      throw new BadRequestException('El tipo de tarjeta es obligatorio');
    }

    const duplicated = await this.prisma.bankBinConfig.findFirst({
      where: { tenantId, bin },
      select: { id: true },
    });
    if (duplicated) {
      throw new BadRequestException('Ya existe ese BIN en la configuracion del banco');
    }

    const created = await this.prisma.bankBinConfig.create({
      data: {
        tenantId,
        bin,
        network,
        cardType,
        segment: this.normalizeOptionalText(dto.segment),
        alliance: this.normalizeOptionalText(dto.alliance),
        channel: this.normalizeOptionalText(dto.channel),
        product: this.normalizeOptionalText(dto.product),
        active: dto.active ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'BankBinConfig',
      entityId: created.id,
      after: {
        bin: created.bin,
        network: created.network,
        cardType: created.cardType,
        segment: created.segment,
        alliance: created.alliance,
        channel: created.channel,
        product: created.product,
        active: created.active,
      },
    });

    return created;
  }

  async updateBinConfig(
    tenantId: string,
    id: string,
    dto: UpdateBankBinConfigDto,
    actorId?: string,
  ) {
    const before = await this.prisma.bankBinConfig.findFirst({
      where: { tenantId, id },
    });
    if (!before) {
      throw new NotFoundException('BIN no encontrado');
    }

    const nextBin =
      dto.bin !== undefined
        ? this.normalizeBin(dto.bin)
        : before.bin;
    if (!/^\d{6,10}$/.test(nextBin)) {
      throw new BadRequestException('El BIN debe tener entre 6 y 10 digitos');
    }

    if (nextBin !== before.bin) {
      const duplicated = await this.prisma.bankBinConfig.findFirst({
        where: {
          tenantId,
          id: { not: id },
          bin: nextBin,
        },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException('Ya existe ese BIN en la configuracion del banco');
      }
    }

    const network =
      dto.network !== undefined
        ? dto.network.trim()
        : before.network;
    const cardType =
      dto.cardType !== undefined
        ? dto.cardType.trim()
        : before.cardType;
    if (!network) {
      throw new BadRequestException('La marca no puede quedar vacia');
    }
    if (!cardType) {
      throw new BadRequestException('El tipo de tarjeta no puede quedar vacio');
    }

    const updated = await this.prisma.bankBinConfig.update({
      where: { id },
      data: {
        bin: nextBin,
        network,
        cardType,
        segment:
          dto.segment !== undefined
            ? this.normalizeOptionalText(dto.segment)
            : undefined,
        alliance:
          dto.alliance !== undefined
            ? this.normalizeOptionalText(dto.alliance)
            : undefined,
        channel:
          dto.channel !== undefined
            ? this.normalizeOptionalText(dto.channel)
            : undefined,
        product:
          dto.product !== undefined
            ? this.normalizeOptionalText(dto.product)
            : undefined,
        active: dto.active ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'BankBinConfig',
      entityId: updated.id,
      before: {
        bin: before.bin,
        network: before.network,
        cardType: before.cardType,
        segment: before.segment,
        alliance: before.alliance,
        channel: before.channel,
        product: before.product,
        active: before.active,
      },
      after: {
        bin: updated.bin,
        network: updated.network,
        cardType: updated.cardType,
        segment: updated.segment,
        alliance: updated.alliance,
        channel: updated.channel,
        product: updated.product,
        active: updated.active,
      },
    });

    return updated;
  }

  async removeBinConfig(tenantId: string, id: string, actorId?: string) {
    const before = await this.prisma.bankBinConfig.findFirst({
      where: { tenantId, id },
    });
    if (!before) {
      throw new NotFoundException('BIN no encontrado');
    }

    await this.prisma.bankBinConfig.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'BankBinConfig',
      entityId: id,
      before: {
        bin: before.bin,
        network: before.network,
        cardType: before.cardType,
        segment: before.segment,
        alliance: before.alliance,
        channel: before.channel,
        product: before.product,
        active: before.active,
      },
    });

    return { ok: true };
  }

  async create(dto: CreateBankDto) {
    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
    const bank = await this.prisma.bank.create({
      data: {
        nombre: dto.nombre,
        nombreCompleto: dto.nombreCompleto ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        cuit: dto.cuit ?? undefined,
        direccionCasaMatriz: dto.direccionCasaMatriz ?? undefined,
        slug: dto.slug,
        paymentMethods: dto.paymentMethods ?? [],
        bines: dto.bines ?? [],
        timezone: dto.timezone?.trim() || undefined,
        fechaAlta: dto.fechaAlta ? new Date(dto.fechaAlta) : undefined,
        users: {
          create: {
            email: dto.adminEmail,
            passwordHash,
            nombre: dto.adminNombre,
            role: Role.BANK_ADMIN,
          },
        },
      },
      include: { users: true },
    });

    await this.ensureCardCodeConfigs(bank.id);
    await this.ensureProcessorConfigs(bank.id);
    await this.ensureCampaignTypeConfigs(bank.id);

    return {
      id: bank.id,
      nombre: bank.nombre,
      slug: bank.slug,
      admin: bank.users[0],
    };
  }

  async list() {
    const banks = await this.prisma.bank.findMany({
      select: {
        id: true,
        nombre: true,
        nombreCompleto: true,
        razonSocial: true,
        cuit: true,
        direccionCasaMatriz: true,
        slug: true,
        logoUrl: true,
        activo: true,
        paymentMethods: true,
        bines: true,
        timezone: true,
        fechaAlta: true,
        createdAt: true,
        provisioningRequests: {
          where: {
            status: ProvisioningStatus.READY,
            OR: [{ domain: { not: null } }, { apiDomain: { not: null } }],
          },
          select: {
            domain: true,
            apiDomain: true,
            processedAt: true,
            createdAt: true,
          },
          orderBy: [{ processedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return banks.map(({ provisioningRequests, ...bank }) => ({
      ...bank,
      provisionedDomain: provisioningRequests[0]?.domain ?? null,
      provisionedApiDomain: provisioningRequests[0]?.apiDomain ?? null,
      provisionedAt:
        provisioningRequests[0]?.processedAt ?? provisioningRequests[0]?.createdAt ?? null,
    }));
  }

  async getCurrent(tenantId: string) {
    await this.ensureCardCodeConfigs(tenantId);
    await this.ensureProcessorConfigs(tenantId);
    await this.ensureCampaignTypeConfigs(tenantId);

    const bank = await this.prisma.bank.findUnique({
      where: { id: tenantId },
    });
    if (!bank) {
      throw new NotFoundException('Banco no encontrado');
    }
    return bank;
  }

  async updateCurrent(tenantId: string, dto: UpdateBankDto, actorId?: string) {
    const before = await this.prisma.bank.findUnique({ where: { id: tenantId } });
    if (!before) {
      throw new NotFoundException('Banco no encontrado');
    }
    const updated = await this.prisma.bank.update({
      where: { id: tenantId },
      data: {
        nombre: dto.nombre ?? undefined,
        nombreCompleto: dto.nombreCompleto ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        cuit: dto.cuit ?? undefined,
        direccionCasaMatriz: dto.direccionCasaMatriz ?? undefined,
        paymentMethods: dto.paymentMethods ?? undefined,
        bines: dto.bines ?? undefined,
        fechaAlta: dto.fechaAlta ? new Date(dto.fechaAlta) : undefined,
        logoUrl: dto.logoUrl ?? undefined,
        timezone: dto.timezone?.trim() || undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Bank',
      entityId: tenantId,
      before: {
        nombre: before.nombre,
        nombreCompleto: before.nombreCompleto,
        razonSocial: before.razonSocial,
        cuit: before.cuit,
        direccionCasaMatriz: before.direccionCasaMatriz,
        paymentMethods: before.paymentMethods,
        bines: before.bines,
        fechaAlta: before.fechaAlta,
        logoUrl: before.logoUrl,
        timezone: before.timezone,
      },
      after: {
        nombre: updated.nombre,
        nombreCompleto: updated.nombreCompleto,
        razonSocial: updated.razonSocial,
        cuit: updated.cuit,
        direccionCasaMatriz: updated.direccionCasaMatriz,
        paymentMethods: updated.paymentMethods,
        bines: updated.bines,
        fechaAlta: updated.fechaAlta,
        logoUrl: updated.logoUrl,
        timezone: updated.timezone,
      },
    });

    return updated;
  }

  async updateById(bankId: string, dto: UpdateBankSuperadminDto, actorId?: string) {
    const before = await this.prisma.bank.findUnique({ where: { id: bankId } });
    if (!before) {
      throw new NotFoundException('Banco no encontrado');
    }

    const updated = await this.prisma.bank.update({
      where: { id: bankId },
      data: {
        nombre: dto.nombre ?? undefined,
        nombreCompleto: dto.nombreCompleto ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        cuit: dto.cuit ?? undefined,
        direccionCasaMatriz: dto.direccionCasaMatriz ?? undefined,
        slug: dto.slug ?? undefined,
        paymentMethods: dto.paymentMethods ?? undefined,
        bines: dto.bines ?? undefined,
        fechaAlta: dto.fechaAlta ? new Date(dto.fechaAlta) : undefined,
        logoUrl: dto.logoUrl ?? undefined,
        activo: dto.activo ?? undefined,
        timezone: dto.timezone?.trim() || undefined,
      },
    });

    await this.audit.log({
      tenantId: bankId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Bank',
      entityId: bankId,
      before: {
        nombre: before.nombre,
        nombreCompleto: before.nombreCompleto,
        razonSocial: before.razonSocial,
        cuit: before.cuit,
        direccionCasaMatriz: before.direccionCasaMatriz,
        slug: before.slug,
        paymentMethods: before.paymentMethods,
        bines: before.bines,
        fechaAlta: before.fechaAlta,
        logoUrl: before.logoUrl,
        activo: before.activo,
        timezone: before.timezone,
      },
      after: {
        nombre: updated.nombre,
        nombreCompleto: updated.nombreCompleto,
        razonSocial: updated.razonSocial,
        cuit: updated.cuit,
        direccionCasaMatriz: updated.direccionCasaMatriz,
        slug: updated.slug,
        paymentMethods: updated.paymentMethods,
        bines: updated.bines,
        fechaAlta: updated.fechaAlta,
        logoUrl: updated.logoUrl,
        activo: updated.activo,
        timezone: updated.timezone,
      },
    });

    return updated;
  }

  async remove(bankId: string, actorId?: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true, nombre: true, slug: true },
    });
    if (!bank) {
      throw new NotFoundException('Banco no encontrado');
    }

    const counts = await this.prisma.bank.findUnique({
      where: { id: bankId },
      select: {
        _count: {
          select: {
            users: true,
            bankBranches: true,
            merchants: true,
            branches: true,
            campaigns: true,
            invitations: true,
            validations: true,
            notifications: true,
            auditLogs: true,
          },
        },
      },
    });

    const totalRelations = Object.values(counts?._count ?? {}).reduce((acc, value) => acc + value, 0);
    if (totalRelations > 0) {
      throw new BadRequestException('No se puede borrar un banco con datos asociados. Desactivalo primero.');
    }

    await this.audit.log({
      tenantId: bankId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Bank',
      entityId: bankId,
      before: {
        nombre: bank.nombre,
        slug: bank.slug,
      },
    });

    await this.prisma.bank.delete({ where: { id: bankId } });

    return { ok: true };
  }
}
