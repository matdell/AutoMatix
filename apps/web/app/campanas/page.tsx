'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';

type CampaignStatus = 'EDITING' | 'PENDING' | 'ACTIVE' | 'FINALIZED' | 'CANCELLED' | 'ARCHIVED';
type CampaignCommercialStatus = 'INVITACION' | 'OPERACIONES' | 'ADMINISTRADORA' | 'PARCIAL' | 'OK';
type CampaignCloseType = 'WITH_CLOSE_DATE' | 'WITHOUT_CLOSE_DATE';
type CampaignTargetMode = 'RETAILER_PDV' | 'RUBROS' | 'SHOPPING' | 'LOCATION';
type CampaignLocationLevel = 'COUNTRY' | 'PROVINCE' | 'CITY';
type CampaignBenefitType =
  | 'DISCOUNT'
  | 'INSTALLMENTS'
  | 'INSTALLMENTS_DISCOUNT'
  | 'CASHBACK'
  | 'FINANCING'
  | 'BANK_CREDENTIAL';
type CampaignAdhesionStatus = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';

type CampaignConditionInstallmentsMode = 'NO_APLICA' | 'SIN_INTERES' | 'CON_FINANCIACION';
type CampaignConditionCashbackMode = 'NO_APLICA' | 'PORCENTAJE' | 'MONTO';
type CampaignConditionCostShare = 'BANCO_100' | 'COMPARTIDO' | 'PROCESADORA' | 'OTRO';

type CampaignTypeConfig = {
  id: string;
  nombre: string;
  benefitType: CampaignBenefitType;
  mode: CampaignTargetMode;
  locked: boolean;
  active: boolean;
  sortOrder: number;
};

type CardCodeConfig = {
  id: string;
  network: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

type BankBinConfig = {
  id: string;
  bin: string;
  network: string;
  cardType: string;
  segment?: string | null;
  alliance?: string | null;
  channel?: string | null;
  product?: string | null;
  active: boolean;
};

type CategoryItem = {
  id: string;
  nombre: string;
  activo: boolean;
};

type ShoppingItem = {
  id: string;
  nombre: string;
  grupo?: string | null;
  activo: boolean;
};

type ShoppingGroupOption = {
  key: string;
  nombre: string;
  shoppingIds: string[];
};

type CampaignProcessorCode = {
  processor: string;
  code: string;
};

type CampaignMerchantAdhesion = {
  merchantId: string;
  status: CampaignAdhesionStatus;
};

type CampaignEligibility = {
  network: string[];
  cardType: string[];
  segment: string[];
  alliance: string[];
  channel: string[];
  product: string[];
  binesFinalesOverride: string[];
};

type EligibilityDimensionKey = Exclude<keyof CampaignEligibility, 'binesFinalesOverride'>;

type CampaignConditions = {
  descuentoPorcentaje?: number;
  cuotasCantidad?: number;
  cuotasModo?: CampaignConditionInstallmentsMode;
  cashbackModo?: CampaignConditionCashbackMode;
  cashbackValor?: number;
  financiacionModalidad?: string;
  repartoCosto?: CampaignConditionCostShare;
  extras?: Record<string, unknown>;
};

type MerchantItem = {
  id: string;
  nombre: string;
  brands: Array<{
    brand: {
      id: string;
      nombre: string;
      activo: boolean;
    };
  }>;
  branches: Array<{
    id: string;
    nombre: string;
    activo: boolean;
    retailerId?: string | null;
    direccion?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
    pais?: string | null;
    shopping?: { id: string; nombre: string } | null;
    retailer?: { id: string; nombre: string } | null;
  }>;
};

type Campaign = {
  id: string;
  nombre: string;
  estado: CampaignStatus;
  commercialStatus: CampaignCommercialStatus;
  estadoAnterior?: CampaignStatus | null;
  closeType: CampaignCloseType;
  codigoInterno?: string | null;
  codigoExterno?: string | null;
  fechaVigDesde: string;
  fechaVigHasta: string;
  fechaCierre?: string | null;
  fechaPrioridad?: string | null;
  dias: string[];
  targetAllShoppings: boolean;
  locationLevel?: CampaignLocationLevel | null;
  condiciones?: CampaignConditions | null;
  eligibility?: CampaignEligibility | null;
  resolvedBines?: string[];
  campaignTypeConfigId: string;
  campaignTypeConfig: CampaignTypeConfig;
  targetRetailers: Array<{
    retailerId: string;
    retailer: { id: string; nombre: string; activo: boolean };
  }>;
  targetBranches: Array<{
    branchId: string;
    branch: {
      id: string;
      nombre: string;
      retailerId?: string | null;
      direccion?: string | null;
      ciudad?: string | null;
      provincia?: string | null;
      pais?: string | null;
      shopping?: { id: string; nombre: string } | null;
      retailer?: { id: string; nombre: string } | null;
    };
  }>;
  targetCategories: Array<{
    categoryId: string;
    category: { id: string; nombre: string; activo: boolean };
  }>;
  targetShoppings: Array<{
    shoppingId: string;
    shopping: { id: string; nombre: string; activo: boolean };
  }>;
  targetLocations: Array<{
    id: string;
    level: CampaignLocationLevel;
    value: string;
  }>;
  paymentMethods: Array<{
    cardCodeConfigId: string;
    cardCodeConfig: { id: string; network: string; label: string; active: boolean };
  }>;
  processorCodes: Array<{
    id: string;
    processor: string;
    code: string;
  }>;
  merchantAdhesions: Array<{
    id: string;
    merchantId: string;
    status: CampaignAdhesionStatus;
    merchant: { id: string; nombre: string };
  }>;
  archivedAt?: string | null;
  archivedBy?: { nombre?: string | null; email?: string | null } | null;
};

type RetailerOption = {
  id: string;
  nombre: string;
  activo: boolean;
};

type BranchOption = {
  id: string;
  nombre: string;
  activo: boolean;
  retailerId: string | null;
  retailerNombre: string;
  merchantNombre: string;
  direccion: string;
  shoppingNombre: string | null;
  ciudad: string;
  provincia: string;
  pais: string;
};

type CampaignForm = {
  nombre: string;
  campaignTypeConfigId: string;
  commercialStatus: CampaignCommercialStatus;
  codigoInterno: string;
  codigoExterno: string;
  closeType: CampaignCloseType;
  fechaVigDesde: string;
  fechaVigHasta: string;
  fechaCierre: string;
  dias: string[];
  tienePrioridad: boolean;
  fechaPrioridad: string;
  paymentMethodIds: string[];
  retailerIds: string[];
  branchIds: string[];
  categoryIds: string[];
  shoppingIds: string[];
  targetAllShoppings: boolean;
  locationLevel: CampaignLocationLevel | '';
  locationValues: string[];
  descuentoPorcentaje: string;
  cuotasCantidad: string;
  cuotasModo: CampaignConditionInstallmentsMode;
  cashbackModo: CampaignConditionCashbackMode;
  cashbackValor: string;
  financiacionModalidad: string;
  repartoCosto: CampaignConditionCostShare;
  condicionesExtrasText: string;
  processorCodes: CampaignProcessorCode[];
  adhesiones: CampaignMerchantAdhesion[];
  eligibility: CampaignEligibility;
};

type TransitionAction = {
  endpoint: 'submit' | 'activate' | 'reopen' | 'cancel';
  label: string;
};

const dayOptions = [
  { code: 'L', label: 'Lunes' },
  { code: 'M', label: 'Martes' },
  { code: 'X', label: 'Miercoles' },
  { code: 'J', label: 'Jueves' },
  { code: 'V', label: 'Viernes' },
  { code: 'S', label: 'Sabado' },
  { code: 'D', label: 'Domingo' },
] as const;

const statusLabel: Record<CampaignStatus, string> = {
  EDITING: 'Edicion',
  PENDING: 'Pendiente',
  ACTIVE: 'Vigente',
  FINALIZED: 'Finalizada',
  CANCELLED: 'Cancelada',
  ARCHIVED: 'Archivada',
};

const commercialStatusLabel: Record<CampaignCommercialStatus, string> = {
  INVITACION: 'Invitacion',
  OPERACIONES: 'Operaciones',
  ADMINISTRADORA: 'Administradora',
  PARCIAL: 'Parcial',
  OK: 'OK',
};

const benefitTypeLabel: Record<CampaignBenefitType, string> = {
  DISCOUNT: 'Descuento',
  INSTALLMENTS: 'Cuotas',
  INSTALLMENTS_DISCOUNT: 'Cuotas + Descuento',
  CASHBACK: 'Cashback',
  FINANCING: 'Financiacion',
  BANK_CREDENTIAL: 'Credencial / 100% banco',
};

const adhesionStatusOptions: Array<{ value: CampaignAdhesionStatus; label: string }> = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'ACEPTADA', label: 'Aceptada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
];

const commercialStatusOptions: Array<{ value: CampaignCommercialStatus; label: string }> = [
  { value: 'INVITACION', label: 'Invitacion' },
  { value: 'OPERACIONES', label: 'Operaciones' },
  { value: 'ADMINISTRADORA', label: 'Administradora' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'OK', label: 'OK' },
];

const installmentsModeOptions: Array<{ value: CampaignConditionInstallmentsMode; label: string }> = [
  { value: 'NO_APLICA', label: 'No aplica' },
  { value: 'SIN_INTERES', label: 'Sin interes' },
  { value: 'CON_FINANCIACION', label: 'Con financiacion' },
];

const cashbackModeOptions: Array<{ value: CampaignConditionCashbackMode; label: string }> = [
  { value: 'NO_APLICA', label: 'No aplica' },
  { value: 'PORCENTAJE', label: 'Porcentaje' },
  { value: 'MONTO', label: 'Monto fijo' },
];

const costShareOptions: Array<{ value: CampaignConditionCostShare; label: string }> = [
  { value: 'BANCO_100', label: '100% banco' },
  { value: 'COMPARTIDO', label: 'Compartido' },
  { value: 'PROCESADORA', label: 'Procesadora' },
  { value: 'OTRO', label: 'Otro' },
];

const statusStyles: Record<CampaignStatus, string> = {
  EDITING: 'bg-slate-200 text-slate-800',
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  FINALIZED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

const closeTypeOptions: Array<{ value: CampaignCloseType; label: string }> = [
  { value: 'WITHOUT_CLOSE_DATE', label: 'Sin fecha de cierre' },
  { value: 'WITH_CLOSE_DATE', label: 'Con fecha de cierre' },
];

const locationLevelOptions: Array<{ value: CampaignLocationLevel; label: string }> = [
  { value: 'COUNTRY', label: 'Pais' },
  { value: 'PROVINCE', label: 'Provincia' },
  { value: 'CITY', label: 'Ciudad' },
];

const campaignModeLabel: Record<CampaignTargetMode, string> = {
  RETAILER_PDV: 'Retailer+PDV',
  RUBROS: 'Rubros',
  SHOPPING: 'Shopping',
  LOCATION: 'Ubicacion',
};

const transitionActions: Record<CampaignStatus, TransitionAction[]> = {
  EDITING: [{ endpoint: 'submit', label: 'Enviar a Pendiente' }, { endpoint: 'cancel', label: 'Cancelar' }],
  PENDING: [
    { endpoint: 'activate', label: 'Activar Vigente' },
    { endpoint: 'reopen', label: 'Volver a Edicion' },
    { endpoint: 'cancel', label: 'Cancelar' },
  ],
  ACTIVE: [
    { endpoint: 'reopen', label: 'Volver a Edicion' },
    { endpoint: 'cancel', label: 'Cancelar' },
  ],
  FINALIZED: [],
  CANCELLED: [],
  ARCHIVED: [],
};

const nonArchivedStatuses: Array<'' | Exclude<CampaignStatus, 'ARCHIVED'>> = [
  '',
  'EDITING',
  'PENDING',
  'ACTIVE',
  'FINALIZED',
  'CANCELLED',
];
const minSearchChars = 2;
const maxSearchResults = 30;

function normalizeDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatLatamDate(value?: string | null) {
  if (!value) return '-';

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoDateMatch) {
    return `${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  const day = `${parsed.getUTCDate()}`.padStart(2, '0');
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  const year = `${parsed.getUTCFullYear()}`;
  return `${day}/${month}/${year}`;
}

function buildEmptyForm(defaultTypeId = ''): CampaignForm {
  return {
    nombre: '',
    campaignTypeConfigId: defaultTypeId,
    commercialStatus: 'INVITACION',
    codigoInterno: '',
    codigoExterno: '',
    closeType: 'WITHOUT_CLOSE_DATE',
    fechaVigDesde: '',
    fechaVigHasta: '',
    fechaCierre: '',
    dias: ['L', 'M', 'X', 'J', 'V'],
    tienePrioridad: false,
    fechaPrioridad: '',
    paymentMethodIds: [],
    retailerIds: [],
    branchIds: [],
    categoryIds: [],
    shoppingIds: [],
    targetAllShoppings: false,
    locationLevel: '',
    locationValues: [],
    descuentoPorcentaje: '',
    cuotasCantidad: '',
    cuotasModo: 'NO_APLICA',
    cashbackModo: 'NO_APLICA',
    cashbackValor: '',
    financiacionModalidad: '',
    repartoCosto: 'COMPARTIDO',
    condicionesExtrasText: '',
    processorCodes: [],
    adhesiones: [],
    eligibility: {
      network: [],
      cardType: [],
      segment: [],
      alliance: [],
      channel: [],
      product: [],
      binesFinalesOverride: [],
    },
  };
}

export default function CampanasPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [archivedItems, setArchivedItems] = useState<Campaign[]>([]);

  const [campaignTypes, setCampaignTypes] = useState<CampaignTypeConfig[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<CardCodeConfig[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [shoppings, setShoppings] = useState<ShoppingItem[]>([]);
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [binConfigs, setBinConfigs] = useState<BankBinConfig[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'' | Exclude<CampaignStatus, 'ARCHIVED'>>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(buildEmptyForm());
  const [categoryQuery, setCategoryQuery] = useState('');
  const [shoppingQuery, setShoppingQuery] = useState('');
  const [shoppingGroupQuery, setShoppingGroupQuery] = useState('');
  const [shoppingGroupName, setShoppingGroupName] = useState('');
  const [savingShoppingGroup, setSavingShoppingGroup] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [retailerQuery, setRetailerQuery] = useState('');
  const [branchQuery, setBranchQuery] = useState('');
  const [adhesionMerchantQuery, setAdhesionMerchantQuery] = useState('');

  const catalogData = useMemo(() => {
    const retailerMap = new Map<string, RetailerOption>();
    const branchMap = new Map<string, BranchOption>();

    for (const merchant of merchants) {
      for (const brandLink of merchant.brands ?? []) {
        const brand = brandLink.brand;
        if (!brand) continue;
        retailerMap.set(brand.id, {
          id: brand.id,
          nombre: brand.nombre,
          activo: brand.activo,
        });
      }

      for (const branch of merchant.branches ?? []) {
        const retailerId = branch.retailerId ?? branch.retailer?.id ?? null;
        const retailerNombre = branch.retailer?.nombre ?? 'Sin retailer';

        if (retailerId && !retailerMap.has(retailerId)) {
          retailerMap.set(retailerId, {
            id: retailerId,
            nombre: retailerNombre,
            activo: true,
          });
        }

        const direccionParts = [branch.direccion, branch.ciudad, branch.provincia]
          .map((value) => value?.trim())
          .filter(Boolean);

        branchMap.set(branch.id, {
          id: branch.id,
          nombre: branch.nombre,
          activo: branch.activo,
          retailerId,
          retailerNombre,
          merchantNombre: merchant.nombre,
          direccion: direccionParts.join(', '),
          shoppingNombre: branch.shopping?.nombre ?? null,
          ciudad: branch.ciudad?.trim() ?? '',
          provincia: branch.provincia?.trim() ?? '',
          pais: branch.pais?.trim() ?? '',
        });
      }
    }

    const retailerOptions = Array.from(retailerMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const branchOptions = Array.from(branchMap.values())
      .filter((branch) => branch.activo)
      .sort((a, b) => {
        const byRetailer = a.retailerNombre.localeCompare(b.retailerNombre);
        if (byRetailer !== 0) return byRetailer;
        return a.nombre.localeCompare(b.nombre);
      });

    return { retailerOptions, branchOptions };
  }, [merchants]);

  const selectedCampaignType = useMemo(
    () => campaignTypes.find((item) => item.id === form.campaignTypeConfigId) ?? null,
    [campaignTypes, form.campaignTypeConfigId],
  );

  const targetMode: CampaignTargetMode = selectedCampaignType?.mode ?? 'RETAILER_PDV';
  const isRetailerMode = targetMode === 'RETAILER_PDV';
  const isRubrosMode = targetMode === 'RUBROS';
  const isShoppingMode = targetMode === 'SHOPPING';
  const isLocationMode = targetMode === 'LOCATION';

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryItem>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const retailerById = useMemo(() => {
    const map = new Map<string, RetailerOption>();
    for (const retailer of catalogData.retailerOptions) {
      map.set(retailer.id, retailer);
    }
    return map;
  }, [catalogData.retailerOptions]);

  const branchById = useMemo(() => {
    const map = new Map<string, BranchOption>();
    for (const branch of catalogData.branchOptions) {
      map.set(branch.id, branch);
    }
    return map;
  }, [catalogData.branchOptions]);

  const merchantOptions = useMemo(
    () =>
      merchants
        .map((merchant) => ({
          id: merchant.id,
          nombre: merchant.nombre,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [merchants],
  );

  const merchantById = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string }>();
    for (const merchant of merchantOptions) {
      map.set(merchant.id, merchant);
    }
    return map;
  }, [merchantOptions]);

  const selectedRetailers = useMemo(
    () =>
      form.retailerIds
        .map((retailerId) => retailerById.get(retailerId))
        .filter((item): item is RetailerOption => Boolean(item)),
    [form.retailerIds, retailerById],
  );

  const selectedBranches = useMemo(
    () =>
      form.branchIds
        .map((branchId) => branchById.get(branchId))
        .filter((item): item is BranchOption => Boolean(item)),
    [form.branchIds, branchById],
  );

  const selectedCategories = useMemo(
    () =>
      form.categoryIds
        .map((categoryId) => categoryById.get(categoryId))
        .filter((item): item is CategoryItem => Boolean(item)),
    [form.categoryIds, categoryById],
  );

  const shoppingById = useMemo(() => {
    const map = new Map<string, ShoppingItem>();
    for (const shopping of shoppings) {
      map.set(shopping.id, shopping);
    }
    return map;
  }, [shoppings]);

  const selectedShoppings = useMemo(
    () =>
      form.shoppingIds
        .map((shoppingId) => shoppingById.get(shoppingId))
        .filter((item): item is ShoppingItem => Boolean(item)),
    [form.shoppingIds, shoppingById],
  );

  const shoppingGroups = useMemo<ShoppingGroupOption[]>(() => {
    const byGroupKey = new Map<string, ShoppingGroupOption>();

    for (const shopping of shoppings) {
      const groupName = shopping.grupo?.trim();
      if (!groupName) continue;

      const groupKey = groupName.toLowerCase();
      const existing = byGroupKey.get(groupKey);
      if (existing) {
        existing.shoppingIds.push(shopping.id);
        continue;
      }

      byGroupKey.set(groupKey, {
        key: groupKey,
        nombre: groupName,
        shoppingIds: [shopping.id],
      });
    }

    return Array.from(byGroupKey.values())
      .map((group) => ({
        ...group,
        shoppingIds: Array.from(new Set(group.shoppingIds)),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [shoppings]);

  const locationOptionsByLevel = useMemo(() => {
    const countries = new Set<string>();
    const provinces = new Set<string>();
    const cities = new Set<string>();

    for (const branch of catalogData.branchOptions) {
      if (branch.pais) countries.add(branch.pais);
      if (branch.provincia) provinces.add(branch.provincia);
      if (branch.ciudad) cities.add(branch.ciudad);
    }

    return {
      COUNTRY: Array.from(countries).sort((a, b) => a.localeCompare(b)),
      PROVINCE: Array.from(provinces).sort((a, b) => a.localeCompare(b)),
      CITY: Array.from(cities).sort((a, b) => a.localeCompare(b)),
    };
  }, [catalogData.branchOptions]);

  const categorySearchTerm = categoryQuery.trim().toLowerCase();
  const shoppingSearchTerm = shoppingQuery.trim().toLowerCase();
  const shoppingGroupSearchTerm = shoppingGroupQuery.trim().toLowerCase();
  const locationSearchTerm = locationQuery.trim().toLowerCase();
  const retailerSearchTerm = retailerQuery.trim().toLowerCase();
  const branchSearchTerm = branchQuery.trim().toLowerCase();
  const adhesionMerchantSearchTerm = adhesionMerchantQuery.trim().toLowerCase();

  const categorySearchResults = useMemo(() => {
    if (categorySearchTerm.length < minSearchChars) return [];
    return categories
      .filter((category) => category.nombre.toLowerCase().includes(categorySearchTerm))
      .slice(0, maxSearchResults);
  }, [categories, categorySearchTerm]);

  const retailerSearchResults = useMemo(() => {
    if (retailerSearchTerm.length < minSearchChars) return [];
    return catalogData.retailerOptions
      .filter((retailer) => retailer.nombre.toLowerCase().includes(retailerSearchTerm))
      .slice(0, maxSearchResults);
  }, [catalogData.retailerOptions, retailerSearchTerm]);

  const branchSearchResults = useMemo(() => {
    if (branchSearchTerm.length < minSearchChars) return [];
    return catalogData.branchOptions
      .filter((branch) => {
        const searchableText = [
          branch.nombre,
          branch.retailerNombre,
          branch.merchantNombre,
          branch.direccion,
          branch.shoppingNombre ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return searchableText.includes(branchSearchTerm);
      })
      .slice(0, maxSearchResults);
  }, [branchSearchTerm, catalogData.branchOptions]);

  const shoppingSearchResults = useMemo(() => {
    if (shoppingSearchTerm.length < minSearchChars) return [];
    return shoppings
      .filter((shopping) => shopping.nombre.toLowerCase().includes(shoppingSearchTerm))
      .slice(0, maxSearchResults);
  }, [shoppings, shoppingSearchTerm]);

  const shoppingGroupSearchResults = useMemo(() => {
    if (shoppingGroupSearchTerm.length < minSearchChars) return [];
    return shoppingGroups
      .filter((group) => group.nombre.toLowerCase().includes(shoppingGroupSearchTerm))
      .slice(0, maxSearchResults);
  }, [shoppingGroups, shoppingGroupSearchTerm]);

  const selectedShoppingGroups = useMemo(() => {
    if (form.shoppingIds.length === 0) return [];
    const selectedSet = new Set(form.shoppingIds);
    return shoppingGroups.filter((group) =>
      group.shoppingIds.every((shoppingId) => selectedSet.has(shoppingId)),
    );
  }, [form.shoppingIds, shoppingGroups]);

  const locationSearchResults = useMemo(() => {
    if (!form.locationLevel || locationSearchTerm.length < minSearchChars) return [];
    return locationOptionsByLevel[form.locationLevel]
      .filter((value) => value.toLowerCase().includes(locationSearchTerm))
      .slice(0, maxSearchResults);
  }, [form.locationLevel, locationOptionsByLevel, locationSearchTerm]);

  const adhesionMerchantSearchResults = useMemo(() => {
    if (adhesionMerchantSearchTerm.length < minSearchChars) return [];
    return merchantOptions
      .filter((merchant) => merchant.nombre.toLowerCase().includes(adhesionMerchantSearchTerm))
      .slice(0, maxSearchResults);
  }, [adhesionMerchantSearchTerm, merchantOptions]);

  const selectedAdhesions = useMemo(
    () =>
      form.adhesiones.map((adhesion) => ({
        ...adhesion,
        merchantNombre: merchantById.get(adhesion.merchantId)?.nombre ?? adhesion.merchantId,
      })),
    [form.adhesiones, merchantById],
  );

  const eligibilityDimensionOptions = useMemo(() => {
    const network = new Set<string>();
    const cardType = new Set<string>();
    const segment = new Set<string>();
    const alliance = new Set<string>();
    const channel = new Set<string>();
    const product = new Set<string>();

    for (const item of binConfigs) {
      if (!item.active) continue;
      if (item.network?.trim()) network.add(item.network.trim());
      if (item.cardType?.trim()) cardType.add(item.cardType.trim());
      if (item.segment?.trim()) segment.add(item.segment.trim());
      if (item.alliance?.trim()) alliance.add(item.alliance.trim());
      if (item.channel?.trim()) channel.add(item.channel.trim());
      if (item.product?.trim()) product.add(item.product.trim());
    }

    return {
      network: Array.from(network).sort((a, b) => a.localeCompare(b)),
      cardType: Array.from(cardType).sort((a, b) => a.localeCompare(b)),
      segment: Array.from(segment).sort((a, b) => a.localeCompare(b)),
      alliance: Array.from(alliance).sort((a, b) => a.localeCompare(b)),
      channel: Array.from(channel).sort((a, b) => a.localeCompare(b)),
      product: Array.from(product).sort((a, b) => a.localeCompare(b)),
    };
  }, [binConfigs]);

  const calculatedResolvedBines = useMemo(() => {
    const normalize = (value?: string | null) => (value ? value.trim().toLowerCase() : '');
    let filtered = binConfigs.filter((item) => item.active);

    const applyFilter = (values: string[], resolver: (item: BankBinConfig) => string | null | undefined) => {
      if (values.length === 0) return;
      const valueSet = new Set(values.map((value) => value.toLowerCase()));
      filtered = filtered.filter((item) => {
        const current = normalize(resolver(item));
        return current.length > 0 && valueSet.has(current);
      });
    };

    applyFilter(form.eligibility.network, (item) => item.network);
    applyFilter(form.eligibility.cardType, (item) => item.cardType);
    applyFilter(form.eligibility.segment, (item) => item.segment);
    applyFilter(form.eligibility.alliance, (item) => item.alliance);
    applyFilter(form.eligibility.channel, (item) => item.channel);
    applyFilter(form.eligibility.product, (item) => item.product);

    return Array.from(
      new Set([
        ...filtered.map((item) => item.bin),
        ...form.eligibility.binesFinalesOverride,
      ]),
    ).sort((a, b) => a.localeCompare(b));
  }, [binConfigs, form.eligibility]);

  const binesOverrideText = useMemo(
    () => form.eligibility.binesFinalesOverride.join('\n'),
    [form.eligibility.binesFinalesOverride],
  );

  const defaultCampaignTypeId = useMemo(() => {
    if (campaignTypes.length === 0) return '';
    const firstActive = campaignTypes.find((item) => item.active);
    return firstActive?.id ?? campaignTypes[0].id;
  }, [campaignTypes]);

  const formatDate = (value?: string | null) => {
    return formatLatamDate(value);
  };

  const formatRange = (from: string, to: string) => {
    return `${formatDate(from)} - ${formatDate(to)}`;
  };

  const loadCampaigns = async (filter = statusFilter, search = searchTerm) => {
    if (!getToken()) {
      setError('Inicia sesion para ver las campanas.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('estado', filter);
      if (search.trim()) params.set('q', search.trim());
      const activeUrl = params.toString() ? `/campaigns?${params.toString()}` : '/campaigns';

      const [activeData, archivedData] = await Promise.all([
        apiJson<Campaign[]>(activeUrl),
        apiJson<Campaign[]>('/campaigns?estado=ARCHIVED'),
      ]);
      setItems(activeData);
      setArchivedItems(archivedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las campanas');
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogs = async () => {
    if (!getToken()) {
      setLoadingCatalogs(false);
      return;
    }

    setLoadingCatalogs(true);
    try {
      const [typesData, paymentData, categoriesData, shoppingsData, merchantsData, binConfigsData] = await Promise.all([
        apiJson<CampaignTypeConfig[]>('/banks/me/campaign-type-configs'),
        apiJson<CardCodeConfig[]>('/banks/me/card-code-configs?activeOnly=1'),
        apiJson<CategoryItem[]>('/banks/me/categories?activeOnly=1'),
        apiJson<ShoppingItem[]>('/banks/me/shoppings?activeOnly=1'),
        apiJson<MerchantItem[]>('/merchants'),
        apiJson<BankBinConfig[]>('/banks/me/bin-configs?activeOnly=1'),
      ]);
      setCampaignTypes(typesData);
      setPaymentMethods(paymentData);
      setCategories(categoriesData);
      setShoppings(shoppingsData);
      setMerchants(merchantsData);
      setBinConfigs(binConfigsData);

      setForm((previous) => {
        if (previous.campaignTypeConfigId && typesData.some((item) => item.id === previous.campaignTypeConfigId)) {
          return previous;
        }
        const firstActive = typesData.find((item) => item.active);
        return {
          ...previous,
          campaignTypeConfigId: firstActive?.id ?? typesData[0]?.id ?? '',
        };
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudieron cargar los catalogos');
    } finally {
      setLoadingCatalogs(false);
    }
  };

  useEffect(() => {
    void loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    void loadCatalogs();
  }, []);

  const resetForm = () => {
    setForm(buildEmptyForm(defaultCampaignTypeId));
    setEditingCampaignId(null);
    setFormError(null);
    setCategoryQuery('');
    setShoppingQuery('');
    setShoppingGroupQuery('');
    setShoppingGroupName('');
    setLocationQuery('');
    setRetailerQuery('');
    setBranchQuery('');
    setAdhesionMerchantQuery('');
  };

  const updateForm = (next: Partial<CampaignForm>) => {
    setForm((previous) => ({
      ...previous,
      ...next,
    }));
  };

  const toggleSelection = (
    current: string[],
    id: string,
    checked: boolean,
  ): string[] => {
    if (checked) {
      return Array.from(new Set([...current, id]));
    }
    return current.filter((item) => item !== id);
  };

  const onSelectCampaignType = (campaignTypeConfigId: string) => {
    const config = campaignTypes.find((item) => item.id === campaignTypeConfigId);
    setForm((previous) => {
      const next: CampaignForm = {
        ...previous,
        campaignTypeConfigId,
      };

      if (config?.mode === 'RUBROS') {
        next.retailerIds = [];
        next.branchIds = [];
        next.shoppingIds = [];
        next.targetAllShoppings = false;
        next.locationLevel = '';
        next.locationValues = [];
      } else if (config?.mode === 'RETAILER_PDV') {
        next.categoryIds = [];
        next.shoppingIds = [];
        next.targetAllShoppings = false;
        next.locationLevel = '';
        next.locationValues = [];
      } else if (config?.mode === 'SHOPPING') {
        next.retailerIds = [];
        next.branchIds = [];
        next.categoryIds = [];
        next.locationLevel = '';
        next.locationValues = [];
      } else {
        next.retailerIds = [];
        next.branchIds = [];
        next.categoryIds = [];
        next.shoppingIds = [];
        next.targetAllShoppings = false;
        next.locationLevel = '';
        next.locationValues = [];
      }

      if (config?.benefitType === 'BANK_CREDENTIAL') {
        next.repartoCosto = 'BANCO_100';
      }

      return next;
    });
  };

  const loadCampaignIntoForm = (campaign: Campaign) => {
    if (!campaignTypes.some((item) => item.id === campaign.campaignTypeConfig.id)) {
      setCampaignTypes((previous) => [...previous, campaign.campaignTypeConfig]);
    }

    setEditingCampaignId(campaign.id);
    setFormError(null);
    setSuccess(null);
    setCategoryQuery('');
    setShoppingQuery('');
    setShoppingGroupQuery('');
    setShoppingGroupName('');
    setLocationQuery('');
    setRetailerQuery('');
    setBranchQuery('');
    setAdhesionMerchantQuery('');

    const condiciones = (campaign.condiciones ?? {}) as CampaignConditions;
    const eligibility = (campaign.eligibility ?? {}) as Partial<CampaignEligibility>;
    const normalizeEligibility = (values?: string[]) =>
      Array.from(new Set((values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value))));

    setForm({
      nombre: campaign.nombre,
      campaignTypeConfigId: campaign.campaignTypeConfigId,
      commercialStatus: campaign.commercialStatus ?? 'INVITACION',
      codigoInterno: campaign.codigoInterno ?? '',
      codigoExterno: campaign.codigoExterno ?? '',
      closeType: campaign.closeType,
      fechaVigDesde: normalizeDateInput(campaign.fechaVigDesde),
      fechaVigHasta: normalizeDateInput(campaign.fechaVigHasta),
      fechaCierre: normalizeDateInput(campaign.fechaCierre),
      dias: campaign.dias,
      tienePrioridad: Boolean(campaign.fechaPrioridad),
      fechaPrioridad: normalizeDateInput(campaign.fechaPrioridad),
      paymentMethodIds: campaign.paymentMethods.map((item) => item.cardCodeConfigId),
      retailerIds: campaign.targetRetailers.map((item) => item.retailerId),
      branchIds: campaign.targetBranches.map((item) => item.branchId),
      categoryIds: campaign.targetCategories.map((item) => item.categoryId),
      shoppingIds: campaign.targetShoppings.map((item) => item.shoppingId),
      targetAllShoppings: campaign.targetAllShoppings,
      locationLevel: campaign.locationLevel ?? '',
      locationValues: campaign.targetLocations.map((item) => item.value),
      descuentoPorcentaje:
        condiciones.descuentoPorcentaje !== undefined
          ? String(condiciones.descuentoPorcentaje)
          : '',
      cuotasCantidad:
        condiciones.cuotasCantidad !== undefined
          ? String(condiciones.cuotasCantidad)
          : '',
      cuotasModo: condiciones.cuotasModo ?? 'NO_APLICA',
      cashbackModo: condiciones.cashbackModo ?? 'NO_APLICA',
      cashbackValor:
        condiciones.cashbackValor !== undefined
          ? String(condiciones.cashbackValor)
          : '',
      financiacionModalidad: condiciones.financiacionModalidad ?? '',
      repartoCosto: condiciones.repartoCosto ?? 'COMPARTIDO',
      condicionesExtrasText: condiciones.extras ? JSON.stringify(condiciones.extras, null, 2) : '',
      processorCodes: campaign.processorCodes.map((item) => ({
        processor: item.processor,
        code: item.code,
      })),
      adhesiones: campaign.merchantAdhesions.map((item) => ({
        merchantId: item.merchantId,
        status: item.status,
      })),
      eligibility: {
        network: normalizeEligibility(eligibility.network),
        cardType: normalizeEligibility(eligibility.cardType),
        segment: normalizeEligibility(eligibility.segment),
        alliance: normalizeEligibility(eligibility.alliance),
        channel: normalizeEligibility(eligibility.channel),
        product: normalizeEligibility(eligibility.product),
        binesFinalesOverride: normalizeEligibility(eligibility.binesFinalesOverride),
      },
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buildPayload = () => {
    const nombre = form.nombre.trim();
    if (!nombre) {
      throw new Error('El nombre es obligatorio.');
    }
    if (!form.campaignTypeConfigId) {
      throw new Error('Debes seleccionar un tipo de campana.');
    }
    if (!selectedCampaignType) {
      throw new Error('No se pudo resolver el tipo de campana seleccionado.');
    }
    if (!form.fechaVigDesde || !form.fechaVigHasta) {
      throw new Error('La vigencia desde y hasta es obligatoria.');
    }
    if (form.dias.length === 0) {
      throw new Error('Debes seleccionar al menos un dia.');
    }
    if (form.paymentMethodIds.length === 0) {
      throw new Error('Debes seleccionar al menos un medio de pago.');
    }

    if (form.closeType === 'WITH_CLOSE_DATE' && !form.fechaCierre) {
      throw new Error('La fecha de cierre es obligatoria para ese tipo de cierre.');
    }

    if (form.tienePrioridad && !form.fechaPrioridad) {
      throw new Error('La fecha de prioridad es obligatoria cuando hay prioridad.');
    }

    if (isRubrosMode) {
      if (form.categoryIds.length === 0) {
        throw new Error('Debes seleccionar al menos un rubro para este tipo de campana.');
      }
    } else if (isRetailerMode && form.retailerIds.length === 0 && form.branchIds.length === 0) {
      throw new Error('Debes seleccionar al menos un retailer o un punto de venta.');
    } else if (isShoppingMode && !form.targetAllShoppings && form.shoppingIds.length === 0) {
      throw new Error('Debes seleccionar todos los shoppings o al menos un shopping.');
    } else if (isLocationMode) {
      if (!form.locationLevel) {
        throw new Error('Debes seleccionar si segmentas por pais, provincia o ciudad.');
      }
      if (form.locationValues.length === 0) {
        throw new Error('Debes seleccionar al menos una ubicacion.');
      }
    }

    const parseOptionalNumber = (value: string, label: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`${label} debe ser numerico.`);
      }
      return parsed;
    };

    const descuentoPorcentaje = parseOptionalNumber(form.descuentoPorcentaje, 'Descuento');
    if (descuentoPorcentaje !== undefined && (descuentoPorcentaje < 0 || descuentoPorcentaje > 100)) {
      throw new Error('El descuento debe estar entre 0 y 100.');
    }

    const cuotasCantidadRaw = parseOptionalNumber(form.cuotasCantidad, 'Cantidad de cuotas');
    const cuotasCantidad =
      cuotasCantidadRaw === undefined
        ? undefined
        : Number.isInteger(cuotasCantidadRaw) && cuotasCantidadRaw > 0
          ? cuotasCantidadRaw
          : (() => {
              throw new Error('La cantidad de cuotas debe ser un entero positivo.');
            })();

    const cashbackValor = parseOptionalNumber(form.cashbackValor, 'Valor de cashback');
    if (form.cashbackModo === 'PORCENTAJE' && cashbackValor !== undefined && (cashbackValor < 0 || cashbackValor > 100)) {
      throw new Error('El cashback en porcentaje debe estar entre 0 y 100.');
    }
    if (form.cashbackModo === 'MONTO' && cashbackValor !== undefined && cashbackValor <= 0) {
      throw new Error('El cashback en monto debe ser mayor a 0.');
    }

    let extras: Record<string, unknown> | undefined;
    if (form.condicionesExtrasText.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(form.condicionesExtrasText);
      } catch {
        throw new Error('El JSON de condiciones extra no es valido.');
      }
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('El JSON de condiciones extra debe ser un objeto.');
      }
      extras = parsed as Record<string, unknown>;
    }

    if (selectedCampaignType.benefitType === 'DISCOUNT' && descuentoPorcentaje === undefined) {
      throw new Error('Para campanas de descuento debes informar el porcentaje de descuento.');
    }
    if (selectedCampaignType.benefitType === 'INSTALLMENTS' && cuotasCantidad === undefined) {
      throw new Error('Para campanas de cuotas debes informar la cantidad de cuotas.');
    }
    if (
      selectedCampaignType.benefitType === 'INSTALLMENTS_DISCOUNT' &&
      (cuotasCantidad === undefined || descuentoPorcentaje === undefined)
    ) {
      throw new Error('Para campanas de cuotas + descuento debes informar cuotas y porcentaje.');
    }
    if (
      selectedCampaignType.benefitType === 'CASHBACK' &&
      (form.cashbackModo === 'NO_APLICA' || cashbackValor === undefined)
    ) {
      throw new Error('Para campanas de cashback debes informar modo y valor.');
    }
    if (
      selectedCampaignType.benefitType === 'FINANCING' &&
      form.cuotasModo !== 'CON_FINANCIACION' &&
      !form.financiacionModalidad.trim()
    ) {
      throw new Error('Para campanas de financiacion debes informar modalidad o cuotas con financiacion.');
    }
    if (selectedCampaignType.benefitType === 'BANK_CREDENTIAL' && form.repartoCosto !== 'BANCO_100') {
      throw new Error('Para campana credencial/100% banco, el reparto del costo debe ser 100% banco.');
    }

    const condiciones: Record<string, unknown> = {};
    if (descuentoPorcentaje !== undefined) condiciones.descuentoPorcentaje = descuentoPorcentaje;
    if (cuotasCantidad !== undefined) condiciones.cuotasCantidad = cuotasCantidad;
    if (form.cuotasModo !== 'NO_APLICA') condiciones.cuotasModo = form.cuotasModo;
    if (form.cashbackModo !== 'NO_APLICA') condiciones.cashbackModo = form.cashbackModo;
    if (cashbackValor !== undefined) condiciones.cashbackValor = cashbackValor;
    if (form.financiacionModalidad.trim()) condiciones.financiacionModalidad = form.financiacionModalidad.trim();
    condiciones.repartoCosto = form.repartoCosto;
    if (extras && Object.keys(extras).length > 0) condiciones.extras = extras;

    const processorCodes = form.processorCodes
      .map((item) => ({
        processor: item.processor.trim(),
        code: item.code.trim(),
      }))
      .filter((item) => item.processor.length > 0 || item.code.length > 0);
    for (const item of processorCodes) {
      if (!item.processor || !item.code) {
        throw new Error('Cada codigo de procesadora debe tener procesadora y codigo.');
      }
    }

    const adhesiones = Array.from(
      new Map(
        form.adhesiones.map((item) => [
          item.merchantId,
          {
            merchantId: item.merchantId,
            status: item.status,
          },
        ]),
      ).values(),
    );

    const eligibilityPayload: CampaignEligibility = {
      network: form.eligibility.network,
      cardType: form.eligibility.cardType,
      segment: form.eligibility.segment,
      alliance: form.eligibility.alliance,
      channel: form.eligibility.channel,
      product: form.eligibility.product,
      binesFinalesOverride: form.eligibility.binesFinalesOverride,
    };

    const hasEligibility =
      Object.values(eligibilityPayload).some((value) => Array.isArray(value) && value.length > 0);

    const payload: Record<string, unknown> = {
      nombre,
      campaignTypeConfigId: form.campaignTypeConfigId,
      commercialStatus: form.commercialStatus,
      codigoInterno: form.codigoInterno.trim() || undefined,
      codigoExterno: form.codigoExterno.trim() || undefined,
      closeType: form.closeType,
      fechaVigDesde: form.fechaVigDesde,
      fechaVigHasta: form.fechaVigHasta,
      dias: form.dias,
      tienePrioridad: form.tienePrioridad,
      paymentMethodIds: form.paymentMethodIds,
      retailerIds: isRetailerMode ? form.retailerIds : [],
      branchIds: isRetailerMode ? form.branchIds : [],
      categoryIds: isRubrosMode ? form.categoryIds : [],
      shoppingIds: isShoppingMode && !form.targetAllShoppings ? form.shoppingIds : [],
      targetAllShoppings: isShoppingMode ? form.targetAllShoppings : false,
      locationLevel: isLocationMode ? form.locationLevel : undefined,
      locationValues: isLocationMode ? form.locationValues : [],
      processorCodes,
      adhesiones,
      condiciones,
    };

    if (hasEligibility) {
      payload.eligibility = eligibilityPayload;
    }

    if (form.closeType === 'WITH_CLOSE_DATE') payload.fechaCierre = form.fechaCierre;
    if (form.tienePrioridad) payload.fechaPrioridad = form.fechaPrioridad;

    return payload;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    let payload: Record<string, unknown>;
    try {
      payload = buildPayload();
    } catch (validationError) {
      setFormError(validationError instanceof Error ? validationError.message : 'Formulario invalido');
      return;
    }

    setSaving(true);
    try {
      if (editingCampaignId) {
        await apiJson(`/campaigns/${editingCampaignId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess('Campana actualizada.');
      } else {
        await apiJson('/campaigns', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Campana creada en estado Edicion.');
      }

      resetForm();
      await loadCampaigns();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la campana');
    } finally {
      setSaving(false);
    }
  };

  const runCampaignAction = async (
    campaignId: string,
    endpoint: 'submit' | 'activate' | 'reopen' | 'cancel' | 'archive' | 'restore',
    nextMessage: string,
  ) => {
    const actionKey = `${campaignId}:${endpoint}`;
    setBusyActionKey(actionKey);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/campaigns/${campaignId}/${endpoint}`, { method: 'POST' });
      setSuccess(nextMessage);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar la accion');
    } finally {
      setBusyActionKey(null);
    }
  };

  const addProcessorCodeRow = () => {
    updateForm({
      processorCodes: [...form.processorCodes, { processor: '', code: '' }],
    });
  };

  const updateProcessorCodeRow = (
    index: number,
    key: keyof CampaignProcessorCode,
    value: string,
  ) => {
    updateForm({
      processorCodes: form.processorCodes.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    });
  };

  const removeProcessorCodeRow = (index: number) => {
    updateForm({
      processorCodes: form.processorCodes.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const addAdhesionMerchant = (merchantId: string) => {
    if (form.adhesiones.some((item) => item.merchantId === merchantId)) return;
    updateForm({
      adhesiones: [...form.adhesiones, { merchantId, status: 'PENDIENTE' }],
    });
  };

  const updateAdhesionStatus = (merchantId: string, status: CampaignAdhesionStatus) => {
    updateForm({
      adhesiones: form.adhesiones.map((item) =>
        item.merchantId === merchantId ? { ...item, status } : item,
      ),
    });
  };

  const removeAdhesionMerchant = (merchantId: string) => {
    updateForm({
      adhesiones: form.adhesiones.filter((item) => item.merchantId !== merchantId),
    });
  };

  const toggleEligibilityValue = (dimension: EligibilityDimensionKey, value: string, checked: boolean) => {
    const current = form.eligibility[dimension];
    const next = checked
      ? Array.from(new Set([...current, value]))
      : current.filter((item) => item !== value);
    updateForm({
      eligibility: {
        ...form.eligibility,
        [dimension]: next,
      },
    });
  };

  const setBinesOverrideFromText = (rawText: string) => {
    const normalized = Array.from(
      new Set(
        rawText
          .split(/\r?\n/)
          .map((value) => value.replace(/\D/g, '').trim())
          .filter((value) => value.length > 0),
      ),
    );
    updateForm({
      eligibility: {
        ...form.eligibility,
        binesFinalesOverride: normalized,
      },
    });
  };

  const onToggleShoppingGroup = (group: ShoppingGroupOption, checked: boolean) => {
    if (checked) {
      updateForm({
        targetAllShoppings: false,
        shoppingIds: Array.from(new Set([...form.shoppingIds, ...group.shoppingIds])),
      });
      return;
    }

    const groupSet = new Set(group.shoppingIds);
    updateForm({
      shoppingIds: form.shoppingIds.filter((shoppingId) => !groupSet.has(shoppingId)),
    });
  };

  const saveGroupOnSelectedShoppings = async () => {
    const groupName = shoppingGroupName.trim();
    if (!groupName) {
      setFormError('Ingresa un nombre para el grupo de shoppings.');
      return;
    }
    if (form.shoppingIds.length === 0) {
      setFormError('Selecciona al menos un shopping para guardar el grupo.');
      return;
    }

    setSavingShoppingGroup(true);
    setFormError(null);
    setSuccess(null);

    try {
      await Promise.all(
        form.shoppingIds.map((shoppingId) =>
          apiJson(`/banks/me/shoppings/${shoppingId}`, {
            method: 'PATCH',
            body: JSON.stringify({ grupo: groupName }),
          }),
        ),
      );

      setSuccess(`Grupo "${groupName}" guardado en ${form.shoppingIds.length} shopping(s).`);
      setShoppingGroupName('');
      await loadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el grupo de shoppings');
    } finally {
      setSavingShoppingGroup(false);
    }
  };

  const clearGroupOnSelectedShoppings = async () => {
    if (form.shoppingIds.length === 0) {
      setFormError('Selecciona al menos un shopping para quitarle el grupo.');
      return;
    }

    setSavingShoppingGroup(true);
    setFormError(null);
    setSuccess(null);

    try {
      await Promise.all(
        form.shoppingIds.map((shoppingId) =>
          apiJson(`/banks/me/shoppings/${shoppingId}`, {
            method: 'PATCH',
            body: JSON.stringify({ grupo: '' }),
          }),
        ),
      );

      setSuccess(`Grupo quitado de ${form.shoppingIds.length} shopping(s) seleccionado(s).`);
      setShoppingGroupName('');
      await loadCatalogs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo quitar el grupo de shoppings');
    } finally {
      setSavingShoppingGroup(false);
    }
  };

  const campaignTargetsSummary = (campaign: Campaign) => {
    switch (campaign.campaignTypeConfig.mode) {
      case 'RUBROS': {
        const rubros = campaign.targetCategories.map((item) => item.category.nombre);
        if (rubros.length === 0) return 'Sin rubros';
        return rubros.join(', ');
      }
      case 'SHOPPING': {
        if (campaign.targetAllShoppings) return 'Shoppings: Todos';
        const names = campaign.targetShoppings.map((item) => item.shopping.nombre);
        if (names.length === 0) return 'Sin shoppings';
        return `Shoppings: ${names.length}`;
      }
      case 'LOCATION': {
        const count = campaign.targetLocations.length;
        if (count === 0 || !campaign.locationLevel) return 'Sin ubicaciones';
        const levelLabel =
          campaign.locationLevel === 'COUNTRY'
            ? 'Pais'
            : campaign.locationLevel === 'PROVINCE'
              ? 'Provincia'
              : 'Ciudad';
        return `${levelLabel}: ${count}`;
      }
      default: {
        const retailerCount = campaign.targetRetailers.length;
        const branchCount = campaign.targetBranches.length;
        return `Retailers: ${retailerCount} · PDV: ${branchCount}`;
      }
    }
  };

  const paymentSummary = (campaign: Campaign) => {
    const labels = campaign.paymentMethods.map((item) => item.cardCodeConfig.label);
    if (labels.length === 0) return '-';
    return labels.join(', ');
  };

  const activeCampaignTypes = campaignTypes.filter((item) => item.active || item.id === form.campaignTypeConfigId);

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Campanas</h1>
      </header>

      <div className="pt-24 px-8 pb-12 space-y-6">
        {error ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div>
        ) : null}
        {success ? (
          <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{success}</div>
        ) : null}
        {formError ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{formError}</div>
        ) : null}

        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                {editingCampaignId ? 'Editar Campana' : 'Nueva Campana (Manual)'}
              </h2>
              <p className="text-sm text-on-surface-variant">
                Estado operativo: Edicion → Pendiente → Vigente. Estado comercial: Invitacion → Operaciones → Administradora → Parcial → OK.
              </p>
            </div>
            {editingCampaignId ? (
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                onClick={resetForm}
              >
                Cancelar edicion
              </button>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.nombre}
                  onChange={(event) => updateForm({ nombre: event.target.value })}
                  placeholder="Ej: Promo Invierno"
                  disabled={saving || loadingCatalogs}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo de campana</label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.campaignTypeConfigId}
                  onChange={(event) => onSelectCampaignType(event.target.value)}
                  disabled={saving || loadingCatalogs}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {activeCampaignTypes.map((campaignType) => (
                    <option key={campaignType.id} value={campaignType.id}>
                      {campaignType.nombre} · {benefitTypeLabel[campaignType.benefitType]} · {campaignModeLabel[campaignType.mode]}
                      {campaignType.active ? '' : ' (Inactivo)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Vigencia desde</label>
                <input
                  type="date"
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.fechaVigDesde}
                  onChange={(event) => updateForm({ fechaVigDesde: event.target.value })}
                  disabled={saving}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Vigencia hasta</label>
                <input
                  type="date"
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.fechaVigHasta}
                  onChange={(event) => updateForm({ fechaVigHasta: event.target.value })}
                  disabled={saving}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo de cierre</label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.closeType}
                  onChange={(event) =>
                    updateForm({
                      closeType: event.target.value as CampaignCloseType,
                      fechaCierre: event.target.value === 'WITH_CLOSE_DATE' ? form.fechaCierre : '',
                    })
                  }
                  disabled={saving}
                >
                  {closeTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.closeType === 'WITH_CLOSE_DATE' ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Fecha de cierre</label>
                  <input
                    type="date"
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.fechaCierre}
                    onChange={(event) => updateForm({ fechaCierre: event.target.value })}
                    disabled={saving}
                    required
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Dias de vigencia</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {dayOptions.map((day) => {
                  const checked = form.dias.includes(day.code);
                  return (
                    <label key={day.code} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={checked}
                        onChange={(event) =>
                          updateForm({
                            dias: toggleSelection(form.dias, day.code, event.target.checked),
                          })
                        }
                        disabled={saving}
                      />
                      {day.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Medios de pago</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {paymentMethods.map((method) => {
                  const checked = form.paymentMethodIds.includes(method.id);
                  return (
                    <label key={method.id} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={checked}
                        onChange={(event) =>
                          updateForm({
                            paymentMethodIds: toggleSelection(form.paymentMethodIds, method.id, event.target.checked),
                          })
                        }
                        disabled={saving}
                      />
                      {method.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={form.tienePrioridad}
                  onChange={(event) =>
                    updateForm({
                      tienePrioridad: event.target.checked,
                      fechaPrioridad: event.target.checked ? form.fechaPrioridad : '',
                    })
                  }
                  disabled={saving}
                />
                Tiene prioridad
              </label>

              {form.tienePrioridad ? (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Fecha de prioridad</label>
                  <input
                    type="date"
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.fechaPrioridad}
                    onChange={(event) => updateForm({ fechaPrioridad: event.target.value })}
                    disabled={saving}
                    required
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado comercial</label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.commercialStatus}
                  onChange={(event) => updateForm({ commercialStatus: event.target.value as CampaignCommercialStatus })}
                  disabled={saving}
                >
                  {commercialStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Codigo interno</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.codigoInterno}
                  onChange={(event) => updateForm({ codigoInterno: event.target.value })}
                  placeholder="Ej: NACION-2026-001"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Codigo externo / procesadora</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={form.codigoExterno}
                  onChange={(event) => updateForm({ codigoExterno: event.target.value })}
                  placeholder="Ej: PRISMA-ABC-7788"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Condiciones comerciales ({benefitTypeLabel[selectedCampaignType?.benefitType ?? 'DISCOUNT']})
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Descuento (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.descuentoPorcentaje}
                    onChange={(event) => updateForm({ descuentoPorcentaje: event.target.value })}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Cantidad de cuotas</label>
                  <input
                    type="number"
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.cuotasCantidad}
                    onChange={(event) => updateForm({ cuotasCantidad: event.target.value })}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Cuotas</label>
                  <select
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.cuotasModo}
                    onChange={(event) => updateForm({ cuotasModo: event.target.value as CampaignConditionInstallmentsMode })}
                    disabled={saving}
                  >
                    {installmentsModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Cashback</label>
                  <select
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.cashbackModo}
                    onChange={(event) => updateForm({ cashbackModo: event.target.value as CampaignConditionCashbackMode })}
                    disabled={saving}
                  >
                    {cashbackModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Cashback valor</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.cashbackValor}
                    onChange={(event) => updateForm({ cashbackValor: event.target.value })}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Reparto costo promocional</label>
                  <select
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.repartoCosto}
                    onChange={(event) => updateForm({ repartoCosto: event.target.value as CampaignConditionCostShare })}
                    disabled={saving}
                  >
                    {costShareOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Modalidad de financiacion</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={form.financiacionModalidad}
                    onChange={(event) => updateForm({ financiacionModalidad: event.target.value })}
                    placeholder="Ej: Plan banco 18 cuotas"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Condiciones extra (JSON opcional)</label>
                  <textarea
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm min-h-[90px]"
                    value={form.condicionesExtrasText}
                    onChange={(event) => updateForm({ condicionesExtrasText: event.target.value })}
                    placeholder='{"topeReintegro": 15000}'
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Codigos de procesadora (multiples)
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  onClick={addProcessorCodeRow}
                  disabled={saving}
                >
                  Agregar codigo
                </button>
              </div>
              {form.processorCodes.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Sin codigos cargados.</p>
              ) : (
                <div className="space-y-2">
                  {form.processorCodes.map((item, index) => (
                    <div key={`processor-code-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <input
                        className="bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                        value={item.processor}
                        onChange={(event) => updateProcessorCodeRow(index, 'processor', event.target.value)}
                        placeholder="Procesadora"
                        disabled={saving}
                      />
                      <input
                        className="bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                        value={item.code}
                        onChange={(event) => updateProcessorCodeRow(index, 'code', event.target.value)}
                        placeholder="Codigo"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:opacity-60"
                        onClick={() => removeProcessorCodeRow(index)}
                        disabled={saving}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Adhesion por comercio
              </p>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                placeholder="Buscar comercio para adhesion..."
                value={adhesionMerchantQuery}
                onChange={(event) => setAdhesionMerchantQuery(event.target.value)}
                disabled={saving}
              />
              <div className="space-y-2">
                {adhesionMerchantSearchTerm.length < minSearchChars ? (
                  <p className="text-xs text-on-surface-variant">
                    Escribe al menos {minSearchChars} caracteres para buscar comercios.
                  </p>
                ) : adhesionMerchantSearchResults.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No hay comercios que coincidan.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {adhesionMerchantSearchResults.map((merchant) => {
                      const alreadySelected = form.adhesiones.some((item) => item.merchantId === merchant.id);
                      return (
                        <button
                          key={merchant.id}
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800 hover:border-slate-300 disabled:opacity-60"
                          onClick={() => addAdhesionMerchant(merchant.id)}
                          disabled={saving || alreadySelected}
                        >
                          {merchant.nombre}
                          {alreadySelected ? ' · Ya agregado' : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {selectedAdhesions.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No hay adhesiones cargadas.</p>
                ) : (
                  selectedAdhesions.map((adhesion) => (
                    <div key={adhesion.merchantId} className="grid gap-2 rounded-lg bg-surface-container-low px-3 py-2 md:grid-cols-[1fr_220px_auto] md:items-center">
                      <span className="text-sm font-medium text-on-surface">{adhesion.merchantNombre}</span>
                      <select
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={adhesion.status}
                        onChange={(event) => updateAdhesionStatus(adhesion.merchantId, event.target.value as CampaignAdhesionStatus)}
                        disabled={saving}
                      >
                        {adhesionStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:opacity-60"
                        onClick={() => removeAdhesionMerchant(adhesion.merchantId)}
                        disabled={saving}
                      >
                        Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Elegibilidad (Banco → Marca → Tipo → Segmento → Alianza → BINES)
                </p>
                {binConfigs.length === 0 ? (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    No hay BINES configurados. Cargalos en Configuracion → BINES.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Marca</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eligibilityDimensionOptions.network.map((value) => (
                      <label key={`network-${value}`} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={form.eligibility.network.includes(value)}
                          onChange={(event) => toggleEligibilityValue('network', value, event.target.checked)}
                          disabled={saving}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo de tarjeta</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eligibilityDimensionOptions.cardType.map((value) => (
                      <label key={`cardType-${value}`} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={form.eligibility.cardType.includes(value)}
                          onChange={(event) => toggleEligibilityValue('cardType', value, event.target.checked)}
                          disabled={saving}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Segmento</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eligibilityDimensionOptions.segment.map((value) => (
                      <label key={`segment-${value}`} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={form.eligibility.segment.includes(value)}
                          onChange={(event) => toggleEligibilityValue('segment', value, event.target.checked)}
                          disabled={saving}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Programa / Alianza</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eligibilityDimensionOptions.alliance.map((value) => (
                      <label key={`alliance-${value}`} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={form.eligibility.alliance.includes(value)}
                          onChange={(event) => toggleEligibilityValue('alliance', value, event.target.checked)}
                          disabled={saving}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Canal</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eligibilityDimensionOptions.channel.map((value) => (
                      <label key={`channel-${value}`} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={form.eligibility.channel.includes(value)}
                          onChange={(event) => toggleEligibilityValue('channel', value, event.target.checked)}
                          disabled={saving}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Producto</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eligibilityDimensionOptions.product.map((value) => (
                      <label key={`product-${value}`} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={form.eligibility.product.includes(value)}
                          onChange={(event) => toggleEligibilityValue('product', value, event.target.checked)}
                          disabled={saving}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  BINES finales override (uno por linea)
                </label>
                <textarea
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm min-h-[100px]"
                  value={binesOverrideText}
                  onChange={(event) => setBinesOverrideFromText(event.target.value)}
                  placeholder={'450781\n450782'}
                  disabled={saving}
                />
              </div>

              <div className="rounded-xl bg-surface-container-low px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  BINES resultantes ({calculatedResolvedBines.length})
                </p>
                <p className="mt-2 text-xs text-on-surface-variant break-all">
                  {calculatedResolvedBines.length > 0 ? calculatedResolvedBines.join(', ') : 'Sin BINES resultantes'}
                </p>
              </div>
            </div>

            {isRubrosMode ? (
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Rubros objetivo</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="Buscar rubro por nombre..."
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                  disabled={saving}
                />
                <p className="mt-2 text-xs text-on-surface-variant">
                  Escribe al menos {minSearchChars} caracteres. Se muestran hasta {maxSearchResults} resultados.
                </p>
                <div className="mt-2 space-y-2">
                  {categorySearchTerm.length < minSearchChars ? (
                    <p className="text-xs text-on-surface-variant">
                      No listamos todos los rubros para evitar una vista masiva.
                    </p>
                  ) : categorySearchResults.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">No hay rubros que coincidan con la busqueda.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {categorySearchResults.map((category) => {
                        const checked = form.categoryIds.includes(category.id);
                        return (
                          <label key={category.id} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={checked}
                              onChange={(event) =>
                                updateForm({
                                  categoryIds: toggleSelection(form.categoryIds, category.id, event.target.checked),
                                })
                              }
                              disabled={saving}
                            />
                            {category.nombre}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Seleccionados ({selectedCategories.length})
                  </p>
                  {selectedCategories.length === 0 ? (
                    <p className="mt-2 text-xs text-on-surface-variant">No hay rubros seleccionados.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCategories.map((category) => (
                        <span key={category.id} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs">
                          <span>{category.nombre}</span>
                          <button
                            type="button"
                            className="font-semibold text-rose-700 disabled:text-rose-300"
                            onClick={() =>
                              updateForm({
                                categoryIds: form.categoryIds.filter((item) => item !== category.id),
                              })
                            }
                            disabled={saving}
                          >
                            Quitar
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {isRetailerMode ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Retailers completos</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    placeholder="Buscar retailer por nombre..."
                    value={retailerQuery}
                    onChange={(event) => setRetailerQuery(event.target.value)}
                    disabled={saving}
                  />
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Escribe al menos {minSearchChars} caracteres. Se muestran hasta {maxSearchResults} resultados.
                  </p>
                  <div className="mt-2 space-y-2">
                    {retailerSearchTerm.length < minSearchChars ? (
                      <p className="text-xs text-on-surface-variant">
                        No listamos todos los retailers para evitar una vista masiva.
                      </p>
                    ) : retailerSearchResults.length === 0 ? (
                      <p className="text-xs text-on-surface-variant">No hay retailers que coincidan con la busqueda.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {retailerSearchResults.map((retailer) => {
                          const checked = form.retailerIds.includes(retailer.id);
                          return (
                            <label key={retailer.id} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={checked}
                                onChange={(event) =>
                                  updateForm({
                                    retailerIds: toggleSelection(form.retailerIds, retailer.id, event.target.checked),
                                  })
                                }
                                disabled={saving}
                              />
                              {retailer.nombre}
                              {retailer.activo ? null : <span className="text-xs text-rose-600">(Inactivo)</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      Seleccionados ({selectedRetailers.length})
                    </p>
                    {selectedRetailers.length === 0 ? (
                      <p className="mt-2 text-xs text-on-surface-variant">No hay retailers seleccionados.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedRetailers.map((retailer) => (
                          <span key={retailer.id} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs">
                            <span>{retailer.nombre}</span>
                            <button
                              type="button"
                              className="font-semibold text-rose-700 disabled:text-rose-300"
                              onClick={() =>
                                updateForm({
                                  retailerIds: form.retailerIds.filter((item) => item !== retailer.id),
                                })
                              }
                              disabled={saving}
                            >
                              Quitar
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">PDV puntuales</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    placeholder="Buscar PDV por nombre, retailer, comercio, direccion o shopping..."
                    value={branchQuery}
                    onChange={(event) => setBranchQuery(event.target.value)}
                    disabled={saving}
                  />
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Escribe al menos {minSearchChars} caracteres. Se muestran hasta {maxSearchResults} resultados.
                  </p>
                  <div className="mt-2 space-y-2">
                    {branchSearchTerm.length < minSearchChars ? (
                      <p className="text-xs text-on-surface-variant">
                        No listamos todos los PDV para evitar una vista masiva.
                      </p>
                    ) : branchSearchResults.length === 0 ? (
                      <p className="text-xs text-on-surface-variant">No hay PDV que coincidan con la busqueda.</p>
                    ) : (
                      <div className="space-y-2">
                        {branchSearchResults.map((branch) => {
                          const checked = form.branchIds.includes(branch.id);
                          const retailerSelected = Boolean(
                            branch.retailerId && form.retailerIds.includes(branch.retailerId),
                          );
                          const branchDisabled = retailerSelected || saving;
                          const detailParts = [branch.retailerNombre, branch.merchantNombre, branch.direccion, branch.shoppingNombre]
                            .filter(Boolean)
                            .join(' · ');

                          return (
                            <label key={branch.id} className="inline-flex w-full items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary mt-0.5"
                                checked={checked}
                                onChange={(event) =>
                                  updateForm({
                                    branchIds: toggleSelection(form.branchIds, branch.id, event.target.checked),
                                  })
                                }
                                disabled={branchDisabled}
                              />
                              <span>
                                <span className="font-medium text-on-surface">{branch.nombre}</span>
                                <span className="block text-xs text-on-surface-variant">
                                  {detailParts || 'Sin detalle'}
                                  {retailerSelected ? ' · Cubierto por retailer seleccionado' : ''}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      Seleccionados ({selectedBranches.length})
                    </p>
                    {selectedBranches.length === 0 ? (
                      <p className="mt-2 text-xs text-on-surface-variant">No hay PDV seleccionados.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedBranches.map((branch) => {
                          const retailerSelected = Boolean(
                            branch.retailerId && form.retailerIds.includes(branch.retailerId),
                          );
                          const detailParts = [branch.retailerNombre, branch.merchantNombre, branch.direccion, branch.shoppingNombre]
                            .filter(Boolean)
                            .join(' · ');

                          return (
                            <div key={branch.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-sm">
                              <span>
                                <span className="font-medium text-on-surface">{branch.nombre}</span>
                                <span className="block text-xs text-on-surface-variant">
                                  {detailParts || 'Sin detalle'}
                                  {retailerSelected ? ' · Cubierto por retailer seleccionado' : ''}
                                </span>
                              </span>
                              <button
                                type="button"
                                className="text-xs font-semibold text-rose-700 disabled:text-rose-300"
                                onClick={() =>
                                  updateForm({
                                    branchIds: form.branchIds.filter((item) => item !== branch.id),
                                  })
                                }
                                disabled={saving}
                              >
                                Quitar
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {isShoppingMode ? (
              <div className="space-y-4">
                <label className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.targetAllShoppings}
                    onChange={(event) =>
                      updateForm({
                        targetAllShoppings: event.target.checked,
                        shoppingIds: event.target.checked ? [] : form.shoppingIds,
                      })
                    }
                    disabled={saving || savingShoppingGroup}
                  />
                  Todos los shoppings activos
                </label>

                {!form.targetAllShoppings ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Grupos de shoppings</label>
                      <input
                        className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                        placeholder="Buscar grupo por nombre..."
                        value={shoppingGroupQuery}
                        onChange={(event) => setShoppingGroupQuery(event.target.value)}
                        disabled={saving || savingShoppingGroup}
                      />
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Escribe al menos {minSearchChars} caracteres. Se muestran hasta {maxSearchResults} resultados.
                      </p>
                      <div className="mt-2 space-y-2">
                        {shoppingGroups.length === 0 ? (
                          <p className="text-xs text-on-surface-variant">No hay grupos cargados para este banco.</p>
                        ) : shoppingGroupSearchTerm.length < minSearchChars ? (
                          <p className="text-xs text-on-surface-variant">
                            No listamos todos los grupos para evitar una vista masiva.
                          </p>
                        ) : shoppingGroupSearchResults.length === 0 ? (
                          <p className="text-xs text-on-surface-variant">No hay grupos que coincidan con la busqueda.</p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {shoppingGroupSearchResults.map((group) => {
                              const selectedCount = group.shoppingIds.filter((item) => form.shoppingIds.includes(item)).length;
                              const checked = selectedCount === group.shoppingIds.length && selectedCount > 0;
                              const partial = selectedCount > 0 && !checked;

                              return (
                                <label key={group.key} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-primary"
                                    checked={checked}
                                    onChange={(event) => onToggleShoppingGroup(group, event.target.checked)}
                                    disabled={saving || savingShoppingGroup}
                                  />
                                  <span>
                                    {group.nombre}
                                    <span className="ml-1 text-xs text-on-surface-variant">({group.shoppingIds.length})</span>
                                    {partial ? (
                                      <span className="ml-1 text-xs text-amber-700">(Parcial)</span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                          Grupos completos seleccionados ({selectedShoppingGroups.length})
                        </p>
                        {selectedShoppingGroups.length === 0 ? (
                          <p className="mt-2 text-xs text-on-surface-variant">No hay grupos seleccionados completos.</p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedShoppingGroups.map((group) => (
                              <span key={group.key} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs">
                                <span>
                                  {group.nombre} ({group.shoppingIds.length})
                                </span>
                                <button
                                  type="button"
                                  className="font-semibold text-rose-700 disabled:text-rose-300"
                                  onClick={() => onToggleShoppingGroup(group, false)}
                                  disabled={saving || savingShoppingGroup}
                                >
                                  Quitar
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Generar grupo desde seleccionados</label>
                          <input
                            className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                            placeholder="Ej: Grupo IRSA"
                            value={shoppingGroupName}
                            onChange={(event) => setShoppingGroupName(event.target.value)}
                            disabled={saving || savingShoppingGroup}
                          />
                        </div>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                          onClick={saveGroupOnSelectedShoppings}
                          disabled={saving || savingShoppingGroup}
                        >
                          {savingShoppingGroup ? 'Guardando...' : 'Guardar grupo'}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                          onClick={clearGroupOnSelectedShoppings}
                          disabled={saving || savingShoppingGroup}
                        >
                          Quitar grupo
                        </button>
                      </div>
                    </div>

                    <hr className="border-slate-200/70" />

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Shoppings especificos</label>
                      <input
                        className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                        placeholder="Buscar shopping por nombre..."
                        value={shoppingQuery}
                        onChange={(event) => setShoppingQuery(event.target.value)}
                        disabled={saving || savingShoppingGroup}
                      />
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Escribe al menos {minSearchChars} caracteres. Se muestran hasta {maxSearchResults} resultados.
                      </p>
                      <div className="mt-2 space-y-2">
                        {shoppingSearchTerm.length < minSearchChars ? (
                          <p className="text-xs text-on-surface-variant">
                            No listamos todos los shoppings para evitar una vista masiva.
                          </p>
                        ) : shoppingSearchResults.length === 0 ? (
                          <p className="text-xs text-on-surface-variant">No hay shoppings que coincidan con la busqueda.</p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {shoppingSearchResults.map((shopping) => {
                              const checked = form.shoppingIds.includes(shopping.id);
                              return (
                                <label key={shopping.id} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-primary"
                                    checked={checked}
                                    onChange={(event) =>
                                      updateForm({
                                        shoppingIds: toggleSelection(form.shoppingIds, shopping.id, event.target.checked),
                                      })
                                    }
                                    disabled={saving || savingShoppingGroup}
                                  />
                                  {shopping.nombre}
                                  {shopping.grupo ? (
                                    <span className="text-xs text-on-surface-variant">(Grupo: {shopping.grupo})</span>
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                          Seleccionados ({selectedShoppings.length})
                        </p>
                        {selectedShoppings.length === 0 ? (
                          <p className="mt-2 text-xs text-on-surface-variant">No hay shoppings seleccionados.</p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedShoppings.map((shopping) => (
                              <span key={shopping.id} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs">
                                <span>{shopping.nombre}</span>
                                <button
                                  type="button"
                                  className="font-semibold text-rose-700 disabled:text-rose-300"
                                  onClick={() =>
                                    updateForm({
                                      shoppingIds: form.shoppingIds.filter((item) => item !== shopping.id),
                                    })
                                  }
                                  disabled={saving || savingShoppingGroup}
                                >
                                  Quitar
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isLocationMode ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nivel de ubicacion</label>
                    <select
                      className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                      value={form.locationLevel}
                      onChange={(event) => {
                        setLocationQuery('');
                        updateForm({
                          locationLevel: event.target.value as CampaignLocationLevel | '',
                          locationValues: [],
                        });
                      }}
                      disabled={saving}
                    >
                      <option value="">Seleccionar...</option>
                      {locationLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {form.locationLevel ? (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      {form.locationLevel === 'COUNTRY'
                        ? 'Paises'
                        : form.locationLevel === 'PROVINCE'
                          ? 'Provincias'
                          : 'Ciudades'}
                    </label>
                    <input
                      className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                      placeholder="Buscar ubicacion..."
                      value={locationQuery}
                      onChange={(event) => setLocationQuery(event.target.value)}
                      disabled={saving}
                    />
                    <p className="mt-2 text-xs text-on-surface-variant">
                      Escribe al menos {minSearchChars} caracteres. Se muestran hasta {maxSearchResults} resultados.
                    </p>
                    <div className="mt-2 space-y-2">
                      {locationSearchTerm.length < minSearchChars ? (
                        <p className="text-xs text-on-surface-variant">
                          No listamos todas las ubicaciones para evitar una vista masiva.
                        </p>
                      ) : locationSearchResults.length === 0 ? (
                        <p className="text-xs text-on-surface-variant">No hay ubicaciones que coincidan con la busqueda.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {locationSearchResults.map((locationValue) => {
                            const checked = form.locationValues.includes(locationValue);
                            return (
                              <label key={locationValue} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={checked}
                                  onChange={(event) =>
                                    updateForm({
                                      locationValues: toggleSelection(form.locationValues, locationValue, event.target.checked),
                                    })
                                  }
                                  disabled={saving}
                                />
                                {locationValue}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Seleccionadas ({form.locationValues.length})
                  </p>
                  {form.locationValues.length === 0 ? (
                    <p className="mt-2 text-xs text-on-surface-variant">No hay ubicaciones seleccionadas.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {form.locationValues.map((locationValue) => (
                        <span key={locationValue} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs">
                          <span>{locationValue}</span>
                          <button
                            type="button"
                            className="font-semibold text-rose-700 disabled:text-rose-300"
                            onClick={() =>
                              updateForm({
                                locationValues: form.locationValues.filter((item) => item !== locationValue),
                              })
                            }
                            disabled={saving}
                          >
                            Quitar
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                disabled={saving || loadingCatalogs}
              >
                {saving ? 'Guardando...' : editingCampaignId ? 'Guardar cambios' : 'Crear campana'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-on-surface">Listado de Campanas</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as '' | Exclude<CampaignStatus, 'ARCHIVED'>)}
              >
                {nonArchivedStatuses.map((status) => (
                  <option key={status || 'ALL'} value={status}>
                    {status ? statusLabel[status] : 'Todos los estados'}
                  </option>
                ))}
              </select>
              <input
                className="bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nombre..."
              />
            </div>
          </div>

          <div className="text-xs text-on-surface-variant">
            Mostrando {items.length} campanas activas/no archivadas.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1180px]">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Tipo</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado comercial</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Codigos</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Vigencia</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Dias</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Medios</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Targets</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-sm text-on-surface-variant">
                      Cargando campanas...
                    </td>
                  </tr>
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-sm text-on-surface-variant">
                      No hay campanas para mostrar.
                    </td>
                  </tr>
                ) : null}

                {items.map((campaign) => {
                  const rowBusy = busyActionKey?.startsWith(`${campaign.id}:`) || false;
                  return (
                    <tr key={campaign.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-on-surface">{campaign.nombre}</td>
                      <td className="px-4 py-3 text-sm text-on-surface">
                        {campaign.campaignTypeConfig?.nombre ?? '-'}
                        {campaign.campaignTypeConfig ? (
                          <span className="block text-[11px] text-on-surface-variant">
                            {benefitTypeLabel[campaign.campaignTypeConfig.benefitType]}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[campaign.estado]}`}>
                          {statusLabel[campaign.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {commercialStatusLabel[campaign.commercialStatus]}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {campaign.codigoInterno || campaign.codigoExterno ? (
                          <>
                            {campaign.codigoInterno ? <span className="block">INT: {campaign.codigoInterno}</span> : null}
                            {campaign.codigoExterno ? <span className="block">EXT: {campaign.codigoExterno}</span> : null}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{formatRange(campaign.fechaVigDesde, campaign.fechaVigHasta)}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{campaign.dias.join(', ')}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{paymentSummary(campaign)}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{campaignTargetsSummary(campaign)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3 flex-wrap">
                          <button
                            type="button"
                            className="text-xs font-bold text-primary hover:underline disabled:opacity-60"
                            onClick={() => loadCampaignIntoForm(campaign)}
                            disabled={saving || rowBusy}
                          >
                            Editar
                          </button>

                          {transitionActions[campaign.estado].map((action) => {
                            const actionKey = `${campaign.id}:${action.endpoint}`;
                            return (
                              <button
                                key={action.endpoint}
                                type="button"
                                className="text-xs font-bold text-slate-700 hover:underline disabled:opacity-60"
                                disabled={saving || busyActionKey === actionKey}
                                onClick={() =>
                                  runCampaignAction(
                                    campaign.id,
                                    action.endpoint,
                                    `Campana ${action.label.toLowerCase()} correctamente.`,
                                  )
                                }
                              >
                                {action.label}
                              </button>
                            );
                          })}

                          <button
                            type="button"
                            className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-60"
                            disabled={saving || busyActionKey === `${campaign.id}:archive`}
                            onClick={() => runCampaignAction(campaign.id, 'archive', 'Campana archivada.')}
                          >
                            Archivar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-on-surface">Archivadas (Tecnico)</h2>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setShowArchived((previous) => !previous)}
            >
              {showArchived ? 'Ocultar' : 'Mostrar'} ({archivedItems.length})
            </button>
          </div>

          {showArchived ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado previo</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Archivada</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {archivedItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                        No hay campanas archivadas.
                      </td>
                    </tr>
                  ) : null}

                  {archivedItems.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 text-sm text-on-surface">{campaign.nombre}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {campaign.estadoAnterior ? statusLabel[campaign.estadoAnterior] : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {campaign.archivedAt ? formatDate(campaign.archivedAt) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            className="text-xs font-bold text-primary hover:underline disabled:opacity-60"
                            disabled={busyActionKey === `${campaign.id}:restore`}
                            onClick={() => runCampaignAction(campaign.id, 'restore', 'Campana restaurada.')}
                          >
                            Restaurar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
