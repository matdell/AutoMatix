import { Injectable } from '@nestjs/common';
import {
  CampaignAdhesionStatus,
  CampaignBenefitType,
  CampaignLocationLevel,
  CampaignStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

type SupportedProcessor = 'VISA_PRISMA' | 'FISERV';
type NormalizedCampaignType = 'discount' | 'installments' | 'discount_installments';
type CapType = 'transaction_cap' | 'card_cap' | 'monthly_cap' | null;

type GenerationCampaignSummary = {
  campaignId: string;
  campaignName: string;
  generatedForms: number;
  warnings: string[];
};

export type CampaignFormGenerationSummary = {
  processedCampaigns: number;
  generatedForms: number;
  campaigns: GenerationCampaignSummary[];
  warnings: string[];
};

type MerchantBranchRecord = {
  id: string;
  nombre: string;
  merchantNumber: string | null;
  processor: string | null;
  retailerId: string | null;
  shoppingId: string | null;
  pais: string;
  provincia: string;
  ciudad: string;
  establishments: Array<{ number: string }>;
};

type ConditionValues = {
  descuentoPorcentaje: number | null;
  cuotasCantidad: number | null;
  cuotasModo: string | null;
  cashbackModo: string | null;
  cashbackValor: number | null;
  financiacionModalidad: string | null;
  repartoCosto: string | null;
  financingRate: number | null;
  paymentDays: number | null;
  discountToCardholder: number | null;
  discountToMerchant: number | null;
  bankParticipation: number | null;
  capType: CapType;
  capValue: number | null;
  capTransaction: number | null;
  capCard: number | null;
  capMonthly: number | null;
  extras: Record<string, unknown>;
};

const dayLabelByCode: Record<string, string> = {
  L: 'Lunes',
  M: 'Martes',
  X: 'Miercoles',
  J: 'Jueves',
  V: 'Viernes',
  S: 'Sabado',
  D: 'Domingo',
};

@Injectable()
export class CampaignFormGenerationService {
  constructor(private prisma: PrismaService) {}

  async listByCampaign(tenantId: string, campaignId: string, merchantId?: string) {
    return this.prisma.campaignGeneratedForm.findMany({
      where: {
        tenantId,
        campaignId,
        merchantId: merchantId?.trim() || undefined,
      },
      orderBy: [
        { merchantId: 'asc' },
        { processor: 'asc' },
        { formTemplate: 'asc' },
      ],
    });
  }

  async generateForMerchantInvitationAcceptance(params: {
    tenantId: string;
    merchantId: string;
    invitationId?: string;
    invitationBranchIds?: string[];
  }): Promise<CampaignFormGenerationSummary> {
    const invitationBranchIds = this.normalizeUnique(params.invitationBranchIds);
    const invitationBranchSet = invitationBranchIds.length > 0 ? new Set(invitationBranchIds) : null;

    const summary: CampaignFormGenerationSummary = {
      processedCampaigns: 0,
      generatedForms: 0,
      campaigns: [],
      warnings: [],
    };

    const now = new Date();

    const pendingAdhesions = await this.prisma.campaignMerchantAdhesion.findMany({
      where: {
        tenantId: params.tenantId,
        merchantId: params.merchantId,
        status: CampaignAdhesionStatus.PENDIENTE,
        campaign: {
          estado: {
            notIn: [CampaignStatus.CANCELLED, CampaignStatus.ARCHIVED],
          },
        },
      },
      select: { id: true },
    });

    if (pendingAdhesions.length > 0) {
      await this.prisma.campaignMerchantAdhesion.updateMany({
        where: {
          id: {
            in: pendingAdhesions.map((item) => item.id),
          },
        },
        data: {
          status: CampaignAdhesionStatus.ACEPTADA,
          respondedAt: now,
        },
      });
    }

    const merchant = await this.prisma.merchant.findFirst({
      where: {
        tenantId: params.tenantId,
        id: params.merchantId,
      },
      select: {
        id: true,
        nombre: true,
        merchantNumber: true,
        processor: true,
        branches: {
          where: {
            tenantId: params.tenantId,
            activo: true,
          },
          select: {
            id: true,
            nombre: true,
            merchantNumber: true,
            processor: true,
            retailerId: true,
            shoppingId: true,
            pais: true,
            provincia: true,
            ciudad: true,
            establishments: {
              select: {
                number: true,
              },
            },
          },
        },
      },
    });

    if (!merchant) {
      summary.warnings.push('No se encontro el comercio para generar formularios.');
      return summary;
    }

    const adhesions = await this.prisma.campaignMerchantAdhesion.findMany({
      where: {
        tenantId: params.tenantId,
        merchantId: params.merchantId,
        status: CampaignAdhesionStatus.ACEPTADA,
        campaign: {
          estado: {
            notIn: [CampaignStatus.CANCELLED, CampaignStatus.ARCHIVED],
          },
        },
      },
      include: {
        campaign: {
          select: {
            id: true,
            nombre: true,
            fechaVigDesde: true,
            fechaVigHasta: true,
            dias: true,
            condiciones: true,
            resolvedBines: true,
            targetAllShoppings: true,
            locationLevel: true,
            campaignTypeConfig: {
              select: {
                nombre: true,
                benefitType: true,
              },
            },
            bank: {
              select: {
                id: true,
                nombre: true,
                nombreCompleto: true,
                bines: true,
              },
            },
            paymentMethods: {
              select: {
                cardCodeConfig: {
                  select: {
                    network: true,
                    label: true,
                  },
                },
              },
            },
            processorCodes: {
              select: {
                processor: true,
                code: true,
              },
            },
            targetRetailers: {
              select: {
                retailerId: true,
              },
            },
            targetBranches: {
              select: {
                branchId: true,
              },
            },
            targetShoppings: {
              select: {
                shoppingId: true,
              },
            },
            targetLocations: {
              select: {
                level: true,
                value: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    for (const adhesion of adhesions) {
      const campaign = adhesion.campaign;
      const campaignSummary: GenerationCampaignSummary = {
        campaignId: campaign.id,
        campaignName: campaign.nombre,
        generatedForms: 0,
        warnings: [],
      };
      summary.processedCampaigns += 1;

      const selectedBranches = this.filterBranchesForCampaign({
        branches: merchant.branches as MerchantBranchRecord[],
        invitationBranchSet,
        targetBranchIds: campaign.targetBranches.map((item) => item.branchId),
        targetRetailerIds: campaign.targetRetailers.map((item) => item.retailerId),
        targetShoppingIds: campaign.targetShoppings.map((item) => item.shoppingId),
        targetAllShoppings: campaign.targetAllShoppings,
        locationLevel: campaign.locationLevel,
        targetLocationValues: campaign.targetLocations.map((item) => item.value),
      });

      const processorsByType = this.resolveProcessorsByType({
        processorCodes: campaign.processorCodes,
        merchantProcessor: merchant.processor,
        branchProcessors: selectedBranches.map((branch) => branch.processor),
      });

      if (processorsByType.size === 0) {
        const warning = `Campana ${campaign.nombre}: sin procesadora reconocida (VISA_PRISMA/FISERV), no se generaron formularios.`;
        campaignSummary.warnings.push(warning);
        summary.warnings.push(warning);
        summary.campaigns.push(campaignSummary);
        continue;
      }

      const campaignType = this.resolveCampaignType(campaign.campaignTypeConfig.benefitType);
      const conditionValues = this.extractConditionValues(campaign.condiciones);

      const bins = this.resolveBins(campaign.resolvedBines, campaign.bank.bines);
      const binsSheet = bins.map((bin) => ({ bin }));

      const merchantsSheet = this.buildMerchantsSheet({
        merchantName: merchant.nombre,
        merchantDefaultNumber: merchant.merchantNumber,
        branches: selectedBranches,
      });

      const terminals = Array.from(
        new Set(
          merchantsSheet
            .map((row) => row.terminal)
            .filter((value): value is string => typeof value === 'string' && value.length > 0),
        ),
      );

      const cardBrands = Array.from(
        new Set(
          campaign.paymentMethods
            .map((item) => item.cardCodeConfig.network?.trim() || item.cardCodeConfig.label?.trim() || '')
            .filter((value) => value.length > 0),
        ),
      );

      for (const [processor, codes] of processorsByType.entries()) {
        const formTemplate = this.resolveFormTemplate(processor, campaignType);
        const merchantsSheetByProcessor = merchantsSheet.map((row) => ({
          ...row,
          acquirer: processor,
        }));
        const financingSheet =
          campaignType === 'installments' || campaignType === 'discount_installments'
            ? this.buildFinancingSheet(conditionValues)
            : [];

        const mainForm = {
          template: formTemplate,
          processor,
          campaignType,
          campaignName: campaign.nombre,
          campaignTypeName: campaign.campaignTypeConfig.nombre,
          startDate: this.formatLatamDate(campaign.fechaVigDesde),
          endDate: this.formatLatamDate(campaign.fechaVigHasta),
          bankEntity: campaign.bank.nombreCompleto?.trim() || campaign.bank.nombre,
          cardBrand: cardBrands.join(', '),
          cardBrands,
          bins,
          merchants: [merchant.nombre],
          terminals,
          daysOfWeek: this.resolveDayLabels(campaign.dias),
          processorCodes: codes,
          discountPercentage: conditionValues.descuentoPorcentaje,
          installments: conditionValues.cuotasCantidad,
          financingRate: conditionValues.financingRate,
          cashbackMode: conditionValues.cashbackModo,
          cashbackValue: conditionValues.cashbackValor,
          financingMode: conditionValues.financiacionModalidad ?? conditionValues.cuotasModo,
          costShareType: conditionValues.repartoCosto,
          capType: conditionValues.capType,
          transactionCap: conditionValues.capType === 'transaction_cap' ? conditionValues.capValue : null,
          cardCap: conditionValues.capType === 'card_cap' ? conditionValues.capValue : null,
          monthlyCap: conditionValues.capType === 'monthly_cap' ? conditionValues.capValue : null,
          discountToCardholder: conditionValues.discountToCardholder,
          discountToMerchant: conditionValues.discountToMerchant,
          bankParticipation: conditionValues.bankParticipation,
        };

        await this.prisma.campaignGeneratedForm.upsert({
          where: {
            campaignId_merchantId_processor_formTemplate: {
              campaignId: campaign.id,
              merchantId: merchant.id,
              processor,
              formTemplate,
            },
          },
          create: {
            tenantId: params.tenantId,
            campaignId: campaign.id,
            merchantId: merchant.id,
            invitationId: params.invitationId,
            processor,
            campaignType,
            formTemplate,
            mainForm: mainForm as Prisma.InputJsonValue,
            binsSheet: binsSheet as Prisma.InputJsonValue,
            merchantsSheet: merchantsSheetByProcessor as Prisma.InputJsonValue,
            financingSheet: financingSheet as Prisma.InputJsonValue,
          },
          update: {
            invitationId: params.invitationId ?? null,
            campaignType,
            mainForm: mainForm as Prisma.InputJsonValue,
            binsSheet: binsSheet as Prisma.InputJsonValue,
            merchantsSheet: merchantsSheetByProcessor as Prisma.InputJsonValue,
            financingSheet: financingSheet as Prisma.InputJsonValue,
          },
        });

        campaignSummary.generatedForms += 1;
        summary.generatedForms += 1;
      }

      summary.campaigns.push(campaignSummary);
    }

    return summary;
  }

  private normalizeUnique(values?: string[]) {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }

  private formatLatamDate(date: Date) {
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const year = `${date.getUTCFullYear()}`;
    return `${day}/${month}/${year}`;
  }

  private resolveDayLabels(dayCodes: string[]) {
    return dayCodes.map((code) => dayLabelByCode[code] ?? code);
  }

  private resolveCampaignType(benefitType: CampaignBenefitType): NormalizedCampaignType {
    switch (benefitType) {
      case CampaignBenefitType.INSTALLMENTS:
      case CampaignBenefitType.FINANCING:
        return 'installments';
      case CampaignBenefitType.INSTALLMENTS_DISCOUNT:
        return 'discount_installments';
      case CampaignBenefitType.DISCOUNT:
      case CampaignBenefitType.CASHBACK:
      case CampaignBenefitType.BANK_CREDENTIAL:
      default:
        return 'discount';
    }
  }

  private resolveFormTemplate(processor: SupportedProcessor, campaignType: NormalizedCampaignType) {
    if (processor === 'VISA_PRISMA') {
      if (campaignType === 'discount') return 'F568_DISCOUNT_MODE';
      if (campaignType === 'installments') return 'F568_FINANCING_MODE';
      return 'F568_COMBINED_MODE';
    }

    if (campaignType === 'discount') return 'CASHBACK_FORM';
    if (campaignType === 'installments') return 'FINANCING_FORM';
    return 'COMBINED_FORM';
  }

  private resolveProcessor(raw: string | null | undefined): SupportedProcessor | null {
    if (!raw) return null;
    const normalized = raw
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    if (normalized === 'VISAPRISMA' || normalized === 'PRISMA' || normalized === 'VISA') {
      return 'VISA_PRISMA';
    }
    if (normalized === 'FISERV' || normalized === 'FIRSTDATA') {
      return 'FISERV';
    }
    return null;
  }

  private resolveProcessorsByType(params: {
    processorCodes: Array<{ processor: string; code: string }>;
    merchantProcessor: string | null;
    branchProcessors: Array<string | null>;
  }) {
    const byProcessor = new Map<SupportedProcessor, string[]>();

    for (const item of params.processorCodes) {
      const processor = this.resolveProcessor(item.processor);
      if (!processor) continue;
      const current = byProcessor.get(processor) ?? [];
      const code = item.code?.trim();
      if (code) current.push(code);
      byProcessor.set(processor, current);
    }

    if (byProcessor.size > 0) {
      for (const [processor, codes] of byProcessor.entries()) {
        byProcessor.set(processor, Array.from(new Set(codes)));
      }
      return byProcessor;
    }

    const fallbackProcessors = [
      params.merchantProcessor,
      ...params.branchProcessors,
    ];

    for (const fallbackProcessor of fallbackProcessors) {
      const normalized = this.resolveProcessor(fallbackProcessor);
      if (!normalized) continue;
      if (!byProcessor.has(normalized)) {
        byProcessor.set(normalized, []);
      }
    }

    return byProcessor;
  }

  private resolveBins(campaignBins: string[] | null | undefined, bankBins: string[] | null | undefined) {
    const source = (campaignBins && campaignBins.length > 0 ? campaignBins : bankBins) ?? [];
    return Array.from(
      new Set(
        source
          .map((value) => value.replace(/\D/g, '').trim())
          .filter((value) => value.length >= 6),
      ),
    ).sort();
  }

  private filterBranchesForCampaign(params: {
    branches: MerchantBranchRecord[];
    invitationBranchSet: Set<string> | null;
    targetBranchIds: string[];
    targetRetailerIds: string[];
    targetShoppingIds: string[];
    targetAllShoppings: boolean;
    locationLevel: CampaignLocationLevel | null;
    targetLocationValues: string[];
  }) {
    let selected = params.branches;

    if (params.invitationBranchSet) {
      selected = selected.filter((branch) => params.invitationBranchSet?.has(branch.id));
    }

    const targetBranchSet = new Set(this.normalizeUnique(params.targetBranchIds));
    if (targetBranchSet.size > 0) {
      selected = selected.filter((branch) => targetBranchSet.has(branch.id));
    }

    const targetRetailerSet = new Set(this.normalizeUnique(params.targetRetailerIds));
    if (targetRetailerSet.size > 0) {
      selected = selected.filter(
        (branch) => Boolean(branch.retailerId) && targetRetailerSet.has(branch.retailerId as string),
      );
    }

    if (!params.targetAllShoppings) {
      const targetShoppingSet = new Set(this.normalizeUnique(params.targetShoppingIds));
      if (targetShoppingSet.size > 0) {
        selected = selected.filter(
          (branch) => Boolean(branch.shoppingId) && targetShoppingSet.has(branch.shoppingId as string),
        );
      }
    }

    if (params.locationLevel) {
      const locationSet = new Set(
        this.normalizeUnique(params.targetLocationValues).map((value) => value.toLowerCase()),
      );
      if (locationSet.size > 0) {
        selected = selected.filter((branch) => {
          const raw =
            params.locationLevel === CampaignLocationLevel.COUNTRY
              ? branch.pais
              : params.locationLevel === CampaignLocationLevel.PROVINCE
                ? branch.provincia
                : branch.ciudad;
          const normalized = raw?.trim().toLowerCase();
          return Boolean(normalized) && locationSet.has(normalized as string);
        });
      }
    }

    return selected;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const normalized = value.trim().replace(',', '.');
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private findFirstNumber(sources: Record<string, unknown>[], keys: string[]) {
    for (const source of sources) {
      for (const key of keys) {
        const value = this.toFiniteNumber(source[key]);
        if (value !== null) {
          return value;
        }
      }
    }
    return null;
  }

  private findFirstString(sources: Record<string, unknown>[], keys: string[]) {
    for (const source of sources) {
      for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
      }
    }
    return null;
  }

  private extractConditionValues(rawCondiciones: Prisma.JsonValue | null): ConditionValues {
    const condiciones = this.toRecord(rawCondiciones);
    const extras = this.toRecord(condiciones.extras);
    const sources = [condiciones, extras];

    const descuentoPorcentaje = this.findFirstNumber(sources, [
      'descuentoPorcentaje',
      'discountPercentage',
    ]);

    const cuotasCantidadRaw = this.findFirstNumber(sources, [
      'cuotasCantidad',
      'installments',
      'installmentsCount',
    ]);
    const cuotasCantidad = cuotasCantidadRaw !== null ? Math.max(1, Math.trunc(cuotasCantidadRaw)) : null;

    const cuotasModo = this.findFirstString(sources, ['cuotasModo', 'installmentsMode']);
    const cashbackModo = this.findFirstString(sources, ['cashbackModo', 'cashbackMode']);
    const cashbackValor = this.findFirstNumber(sources, ['cashbackValor', 'cashbackAmount', 'cashbackPercentage']);
    const financiacionModalidad = this.findFirstString(sources, [
      'financiacionModalidad',
      'financingMode',
      'modalidadFinanciacion',
    ]);
    const repartoCosto = this.findFirstString(sources, ['repartoCosto', 'costShareType']);

    const financingRate = this.findFirstNumber(sources, [
      'financingRate',
      'financing_rate',
      'tasaFinanciacion',
      'rate',
    ]);
    const paymentDaysRaw = this.findFirstNumber(sources, [
      'paymentDays',
      'payment_days',
      'diasPago',
      'settlementDays',
    ]);
    const paymentDays = paymentDaysRaw !== null ? Math.max(0, Math.trunc(paymentDaysRaw)) : null;

    const discountToCardholder =
      this.findFirstNumber(sources, [
        'discountToCardholder',
        'discount_cardholder',
        'descuentoTitular',
        'descuentoTarjetahabiente',
      ]) ?? descuentoPorcentaje;

    const discountToMerchant = this.findFirstNumber(sources, [
      'discountToMerchant',
      'discount_merchant',
      'descuentoComercio',
    ]);

    let bankParticipation = this.findFirstNumber(sources, [
      'bankParticipation',
      'bank_participation',
      'participacionBanco',
    ]);

    if (bankParticipation === null && repartoCosto?.toUpperCase() === 'BANCO_100') {
      bankParticipation = 100;
    }

    const capTransaction = this.findFirstNumber(sources, [
      'transactionCap',
      'transaction_cap',
      'topeTransaccion',
      'topeOperacion',
      'topePorOperacion',
      'topeReintegro',
    ]);
    const capCard = this.findFirstNumber(sources, [
      'cardCap',
      'card_cap',
      'topeTarjeta',
      'topePorTarjeta',
    ]);
    const capMonthly = this.findFirstNumber(sources, [
      'monthlyCap',
      'monthly_cap',
      'topeMensual',
      'topePorMes',
      'topeMes',
    ]);

    let capType: CapType = null;
    let capValue: number | null = null;
    if (capTransaction !== null) {
      capType = 'transaction_cap';
      capValue = capTransaction;
    } else if (capCard !== null) {
      capType = 'card_cap';
      capValue = capCard;
    } else if (capMonthly !== null) {
      capType = 'monthly_cap';
      capValue = capMonthly;
    }

    return {
      descuentoPorcentaje,
      cuotasCantidad,
      cuotasModo,
      cashbackModo,
      cashbackValor,
      financiacionModalidad,
      repartoCosto,
      financingRate,
      paymentDays,
      discountToCardholder,
      discountToMerchant,
      bankParticipation,
      capType,
      capValue,
      capTransaction,
      capCard,
      capMonthly,
      extras,
    };
  }

  private buildFinancingSheet(conditionValues: ConditionValues) {
    const rows: Array<{
      installment_from: number;
      installment_to: number;
      rate: number | null;
      payment_days: number | null;
    }> = [];

    const rawTable =
      conditionValues.extras.financingTable ??
      conditionValues.extras.financing_table ??
      conditionValues.extras.tablaFinanciacion;

    if (Array.isArray(rawTable)) {
      for (const item of rawTable) {
        const record = this.toRecord(item);
        const fromRaw = this.findFirstNumber([record], ['installment_from', 'installmentFrom', 'from']);
        const toRaw = this.findFirstNumber([record], ['installment_to', 'installmentTo', 'to']);
        const rate = this.findFirstNumber([record], ['rate', 'financingRate', 'tasa']);
        const paymentDaysRaw = this.findFirstNumber([record], ['payment_days', 'paymentDays', 'diasPago']);

        if (fromRaw === null || toRaw === null) {
          continue;
        }

        rows.push({
          installment_from: Math.max(1, Math.trunc(fromRaw)),
          installment_to: Math.max(1, Math.trunc(toRaw)),
          rate,
          payment_days: paymentDaysRaw === null ? null : Math.max(0, Math.trunc(paymentDaysRaw)),
        });
      }
    }

    if (rows.length > 0) {
      return rows;
    }

    return [
      {
        installment_from: 1,
        installment_to: conditionValues.cuotasCantidad ?? 1,
        rate: conditionValues.financingRate,
        payment_days: conditionValues.paymentDays,
      },
    ];
  }

  private buildMerchantsSheet(params: {
    merchantName: string;
    merchantDefaultNumber: string | null;
    branches: MerchantBranchRecord[];
  }) {
    const rows: Array<{
      merchant_name: string;
      merchant_number: string;
      terminal: string;
      acquirer: string;
      branch_name: string;
    }> = [];

    for (const branch of params.branches) {
      const merchantNumber = branch.merchantNumber?.trim() || params.merchantDefaultNumber?.trim() || '';
      const terminals = Array.from(
        new Set(
          branch.establishments
            .map((item) => item.number?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      );

      if (terminals.length === 0) {
        rows.push({
          merchant_name: params.merchantName,
          merchant_number: merchantNumber,
          terminal: '',
          acquirer: branch.processor?.trim() || '',
          branch_name: branch.nombre,
        });
        continue;
      }

      for (const terminal of terminals) {
        rows.push({
          merchant_name: params.merchantName,
          merchant_number: merchantNumber,
          terminal,
          acquirer: branch.processor?.trim() || '',
          branch_name: branch.nombre,
        });
      }
    }

    if (rows.length === 0) {
      rows.push({
        merchant_name: params.merchantName,
        merchant_number: params.merchantDefaultNumber?.trim() || '',
        terminal: '',
        acquirer: '',
        branch_name: '',
      });
    }

    return Array.from(
      new Map(
        rows.map((row) => [
          `${row.merchant_number}::${row.terminal}::${row.acquirer}::${row.branch_name}`,
          row,
        ]),
      ).values(),
    );
  }
}
