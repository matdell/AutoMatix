'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';

type MerchantBrandLink = {
  brandId: string;
  brand?: {
    id: string;
    nombre: string;
    activo: boolean;
  } | null;
};

type MerchantBranch = {
  id: string;
  nombre: string;
  activo?: boolean;
  processor?: string | null;
  retailerId?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  shopping?: {
    id: string;
    nombre: string;
  } | null;
  retailer?: {
    id: string;
    nombre: string;
  } | null;
  establishments?: Array<{
    cardNetwork: string;
    number: string;
  }>;
};

type Merchant = {
  id: string;
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  estado?: 'ACTIVE' | 'PENDING' | 'RESTRICTED' | string;
  categoria?: string | null;
  brands?: MerchantBrandLink[];
  branches?: MerchantBranch[];
};

type BrandRow = {
  id: string;
  nombre: string;
  activo: boolean;
  merchants: Merchant[];
};

type CardCodeConfig = {
  id: string;
  network: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

type ProcessorConfig = {
  id: string;
  nombre: string;
  active: boolean;
  sortOrder: number;
};

type ShoppingConfig = {
  id: string;
  nombre: string;
  activo: boolean;
};

type BrandSummary = {
  id: string;
  nombre: string;
  activo: boolean;
};

type CategoryItem = {
  id: string;
  nombre: string;
  activo: boolean;
};

type BranchFormMode = 'create' | 'edit';
type MerchantFormMode = 'create' | 'edit';
type BrandFormMode = 'create' | 'edit';

const viewLabels = {
  brands: 'Retailers',
  merchants: 'Razones sociales',
} as const;

function merchantDisplayName(merchant: Merchant) {
  return merchant.razonSocial?.trim() || merchant.nombre;
}

function merchantStatusBadge(status?: string) {
  if (status === 'ACTIVE') {
    return 'bg-primary-container text-on-primary-container';
  }
  if (status === 'RESTRICTED') {
    return 'bg-error-container text-on-error-container';
  }
  return 'bg-secondary-container text-on-secondary-container';
}

function branchLocation(branch: MerchantBranch) {
  const parts = [branch.direccion, branch.ciudad, branch.provincia]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  return parts.length > 0 ? parts.join(', ') : '-';
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractBrandsFromMerchants(merchants: Merchant[]) {
  const map = new Map<string, BrandSummary>();
  for (const merchant of merchants) {
    for (const link of merchant.brands || []) {
      if (!link.brand) continue;
      if (!map.has(link.brand.id)) {
        map.set(link.brand.id, {
          id: link.brand.id,
          nombre: link.brand.nombre,
          activo: link.brand.activo,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export default function ComerciosPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [brandsCatalog, setBrandsCatalog] = useState<BrandSummary[]>([]);
  const [categoriesCatalog, setCategoriesCatalog] = useState<CategoryItem[]>([]);
  const [activeCardConfigs, setActiveCardConfigs] = useState<CardCodeConfig[]>([]);
  const [activeProcessorConfigs, setActiveProcessorConfigs] = useState<ProcessorConfig[]>([]);
  const [shoppingConfigs, setShoppingConfigs] = useState<ShoppingConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [view, setView] = useState<'brands' | 'merchants'>('brands');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState<MerchantBranch | null>(null);
  const [branchCodeDraft, setBranchCodeDraft] = useState<Record<string, string>>({});
  const [savingBranchCodes, setSavingBranchCodes] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchFormMode, setBranchFormMode] = useState<BranchFormMode>('create');
  const [branchFormMerchantId, setBranchFormMerchantId] = useState('');
  const [branchFormBranchId, setBranchFormBranchId] = useState<string | null>(null);
  const [branchFormName, setBranchFormName] = useState('');
  const [branchFormAddress, setBranchFormAddress] = useState('');
  const [branchFormCity, setBranchFormCity] = useState('');
  const [branchFormProvince, setBranchFormProvince] = useState('');
  const [branchFormCountry, setBranchFormCountry] = useState('Argentina');
  const [branchFormRetailerId, setBranchFormRetailerId] = useState('');
  const [branchFormRetailerOptions, setBranchFormRetailerOptions] = useState<Array<{ id: string; nombre: string }>>([]);
  const [branchFormProcessor, setBranchFormProcessor] = useState('');
  const [branchFormCodeDraft, setBranchFormCodeDraft] = useState<Record<string, string>>({});
  const [branchFormShoppingId, setBranchFormShoppingId] = useState('');
  const [branchFormShoppingQuery, setBranchFormShoppingQuery] = useState('');
  const [branchFormShoppingOpen, setBranchFormShoppingOpen] = useState(false);
  const [branchFormShoppingHighlightedIndex, setBranchFormShoppingHighlightedIndex] = useState(-1);
  const [branchFormActive, setBranchFormActive] = useState(true);
  const [branchFormSaving, setBranchFormSaving] = useState(false);
  const [branchDeletingId, setBranchDeletingId] = useState<string | null>(null);
  const [branchTogglingId, setBranchTogglingId] = useState<string | null>(null);
  const shoppingPickerRef = useRef<HTMLDivElement | null>(null);

  const [merchantModalOpen, setMerchantModalOpen] = useState(false);
  const [merchantFormMode, setMerchantFormMode] = useState<MerchantFormMode>('create');
  const [merchantFormId, setMerchantFormId] = useState<string | null>(null);
  const [merchantFormNombre, setMerchantFormNombre] = useState('');
  const [merchantFormRazonSocial, setMerchantFormRazonSocial] = useState('');
  const [merchantFormCategoria, setMerchantFormCategoria] = useState('');
  const [merchantFormCuit, setMerchantFormCuit] = useState('');
  const [merchantFormEstado, setMerchantFormEstado] = useState<'ACTIVE' | 'PENDING' | 'RESTRICTED'>('ACTIVE');
  const [merchantFormBrandIds, setMerchantFormBrandIds] = useState<string[]>([]);
  const [merchantFormSaving, setMerchantFormSaving] = useState(false);

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandFormMode, setBrandFormMode] = useState<BrandFormMode>('create');
  const [brandFormId, setBrandFormId] = useState<string | null>(null);
  const [brandFormNombre, setBrandFormNombre] = useState('');
  const [brandFormActivo, setBrandFormActivo] = useState(true);
  const [brandFormSaving, setBrandFormSaving] = useState(false);

  const canView =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BANK_OPS' ||
    role === 'BANK_APPROVER' ||
    role === 'BRAND_ADMIN' ||
    role === 'LEGAL_ENTITY_ADMIN' ||
    role === 'MERCHANT_ADMIN' ||
    role === 'MERCHANT_USER';
  const canManageBranches =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BANK_OPS' ||
    role === 'BRAND_ADMIN' ||
    role === 'LEGAL_ENTITY_ADMIN' ||
    role === 'MERCHANT_ADMIN' ||
    role === 'MERCHANT_USER';
  const canDeleteBranches =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BRAND_ADMIN' ||
    role === 'LEGAL_ENTITY_ADMIN' ||
    role === 'MERCHANT_ADMIN';
  const canCreateBrands = role === 'SUPERADMIN' || role === 'BANK_ADMIN';
  const canEditBrands = role === 'SUPERADMIN' || role === 'BANK_ADMIN' || role === 'BRAND_ADMIN';
  const canCreateMerchants =
    role === 'SUPERADMIN' || role === 'BANK_ADMIN' || role === 'BANK_OPS' || role === 'BRAND_ADMIN';
  const canEditMerchants =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BANK_OPS' ||
    role === 'BRAND_ADMIN' ||
    role === 'LEGAL_ENTITY_ADMIN' ||
    role === 'MERCHANT_ADMIN' ||
    role === 'MERCHANT_USER';
  const needsBankSelection = role === 'SUPERADMIN' && !selectedBankId;

  const withBankQuery = (path: string) => {
    if (role !== 'SUPERADMIN' || !selectedBankId) {
      return path;
    }
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}bankId=${encodeURIComponent(selectedBankId)}`;
  };

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    const raw = window.localStorage.getItem('user');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setRole(parsed?.role ?? null);
      setSelectedBankId(window.localStorage.getItem('superadmin-bank-id'));
    } catch {
      setRole(null);
    }
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [merchantsData, cardConfigs, processorConfigs, shoppingsData, categoriesData] = await Promise.all([
        apiJson<Merchant[]>(withBankQuery('/merchants')),
        apiJson<CardCodeConfig[]>(withBankQuery('/banks/me/card-code-configs?activeOnly=1')),
        apiJson<ProcessorConfig[]>(withBankQuery('/banks/me/processor-configs?activeOnly=1')),
        apiJson<ShoppingConfig[]>(withBankQuery('/banks/me/shoppings')),
        apiJson<CategoryItem[]>(withBankQuery('/banks/me/categories?activeOnly=1')),
      ]);
      const fallbackBrands = extractBrandsFromMerchants(merchantsData);
      setMerchants(merchantsData);
      setActiveCardConfigs(cardConfigs);
      setActiveProcessorConfigs(processorConfigs);
      setShoppingConfigs(shoppingsData);
      setCategoriesCatalog(categoriesData);
      setBrandsCatalog(fallbackBrands);

      try {
        const brandsData = await apiJson<BrandSummary[]>(withBankQuery('/brands'));
        setBrandsCatalog(brandsData);
      } catch {
        setBrandsCatalog(fallbackBrands);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los comercios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView || needsBankSelection) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, selectedBankId, needsBankSelection]);

  useEffect(() => {
    setExpandedId(null);
  }, [view, search]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView === 'brands' || requestedView === 'merchants') {
      setView(requestedView);
    }
  }, []);

  useEffect(() => {
    if (!branchFormShoppingOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!shoppingPickerRef.current) return;
      if (!shoppingPickerRef.current.contains(event.target as Node)) {
        setBranchFormShoppingOpen(false);
        setBranchFormShoppingHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [branchFormShoppingOpen]);

  const brandRows = useMemo(() => {
    const byBrand = new Map<string, BrandRow>();

    for (const brand of brandsCatalog) {
      byBrand.set(brand.id, {
        id: brand.id,
        nombre: brand.nombre,
        activo: brand.activo,
        merchants: [],
      });
    }

    for (const merchant of merchants) {
      const links = (merchant.brands || []).filter((link) => Boolean(link.brand));
      if (links.length === 0) {
        const existing = byBrand.get('__no_brand__');
        if (existing) {
          existing.merchants.push(merchant);
        } else {
          byBrand.set('__no_brand__', {
            id: '__no_brand__',
            nombre: 'Sin retailer',
            activo: true,
            merchants: [merchant],
          });
        }
        continue;
      }

      const seen = new Set<string>();
      for (const link of links) {
        if (!link.brand || seen.has(link.brand.id)) continue;
        seen.add(link.brand.id);

        const existing = byBrand.get(link.brand.id);
        if (existing) {
          existing.nombre = link.brand.nombre;
          existing.activo = link.brand.activo;
          existing.merchants.push(merchant);
        } else {
          byBrand.set(link.brand.id, {
            id: link.brand.id,
            nombre: link.brand.nombre,
            activo: link.brand.activo,
            merchants: [merchant],
          });
        }
      }
    }

    return Array.from(byBrand.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [merchants, brandsCatalog]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredBrandRows = useMemo(() => {
    if (!normalizedSearch) return brandRows;
    return brandRows.filter((row) => {
      if (row.nombre.toLowerCase().includes(normalizedSearch)) return true;
      return row.merchants.some((merchant) => {
        const text = `${merchantDisplayName(merchant)} ${merchant.cuit || ''}`.toLowerCase();
        return text.includes(normalizedSearch);
      });
    });
  }, [brandRows, normalizedSearch]);

  const filteredMerchants = useMemo(() => {
    if (!normalizedSearch) return merchants;
    return merchants.filter((merchant) => {
      const merchantText = `${merchantDisplayName(merchant)} ${merchant.cuit || ''}`.toLowerCase();
      if (merchantText.includes(normalizedSearch)) return true;
      return (merchant.brands || []).some((link) =>
        link.brand?.nombre.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [merchants, normalizedSearch]);

  const merchantById = useMemo(() => {
    const map = new Map<string, Merchant>();
    for (const merchant of merchants) {
      map.set(merchant.id, merchant);
    }
    return map;
  }, [merchants]);
  const selectableBrands = useMemo(
    () => brandsCatalog.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [brandsCatalog],
  );

  const totalBrands = brandRows.filter((row) => row.id !== '__no_brand__').length;
  const totalMerchants = merchants.length;
  const merchantsWithoutBrand = merchants.filter((merchant) => (merchant.brands || []).length === 0).length;
  const cardCodeLabelsByNetwork = useMemo(
    () => new Map(activeCardConfigs.map((item) => [item.network, item.label])),
    [activeCardConfigs],
  );
  const selectedShopping = useMemo(
    () => shoppingConfigs.find((item) => item.id === branchFormShoppingId) || null,
    [shoppingConfigs, branchFormShoppingId],
  );
  const normalizedShoppingQuery = normalizeSearchValue(branchFormShoppingQuery);
  const visibleShoppingChoices = useMemo(
    () =>
      shoppingConfigs
        .filter((item) => item.activo || item.id === branchFormShoppingId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [shoppingConfigs, branchFormShoppingId],
  );
  const filteredShoppingChoices = useMemo(() => {
    if (!normalizedShoppingQuery) return visibleShoppingChoices;
    return visibleShoppingChoices.filter((item) =>
      normalizeSearchValue(item.nombre).includes(normalizedShoppingQuery),
    );
  }, [visibleShoppingChoices, normalizedShoppingQuery]);
  const shoppingOptions = filteredShoppingChoices.slice(0, 20);
  const hasMoreShoppingOptions = filteredShoppingChoices.length > shoppingOptions.length;
  const shoppingKeyboardOptions = useMemo(
    () => [{ id: '', nombre: 'Sin shopping', activo: true }, ...shoppingOptions],
    [shoppingOptions],
  );

  useEffect(() => {
    if (!branchFormShoppingOpen) return;
    const selectedIndex = shoppingKeyboardOptions.findIndex((item) => item.id === branchFormShoppingId);
    setBranchFormShoppingHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [branchFormShoppingOpen, shoppingKeyboardOptions, branchFormShoppingId]);

  const buildBranchCodeDraft = (establishments?: MerchantBranch['establishments']) => {
    const byNetwork = new Map((establishments || []).map((item) => [item.cardNetwork, item.number]));
    return Object.fromEntries(
      activeCardConfigs.map((config) => [config.network, byNetwork.get(config.network) || '']),
    ) as Record<string, string>;
  };

  const openBranchCodesModal = (branch: MerchantBranch) => {
    setBranchCodeDraft(buildBranchCodeDraft(branch.establishments));
    setEditingBranch(branch);
  };

  const closeBranchCodesModal = () => {
    setEditingBranch(null);
    setBranchCodeDraft({});
  };

  const saveBranchCodes = async () => {
    if (!editingBranch) return;
    setSavingBranchCodes(true);
    setError(null);
    setSuccess(null);
    try {
      const establishments = activeCardConfigs
        .map((config) => ({
          cardNetwork: config.network,
          number: (branchCodeDraft[config.network] || '').trim(),
        }))
        .filter((item) => item.number !== '');

      await apiJson(`/branches/${editingBranch.id}`, {
        method: 'PUT',
        body: JSON.stringify({ establishments }),
      });

      setSuccess(`Codigos de comercio guardados para ${editingBranch.nombre}.`);
      closeBranchCodesModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los codigos del PDV');
    } finally {
      setSavingBranchCodes(false);
    }
  };

  const getMerchantRetailerOptions = (merchant: Merchant) =>
    (merchant.brands || [])
      .map((link) => link.brand)
      .filter((brand): brand is { id: string; nombre: string; activo: boolean } => Boolean(brand))
      .map((brand) => ({ id: brand.id, nombre: brand.nombre }));

  const selectShopping = (shoppingId: string) => {
    if (!shoppingId) {
      setBranchFormShoppingId('');
      setBranchFormShoppingQuery('');
      setBranchFormShoppingOpen(false);
      setBranchFormShoppingHighlightedIndex(-1);
      return;
    }

    const shopping = shoppingConfigs.find((item) => item.id === shoppingId);
    setBranchFormShoppingId(shoppingId);
    setBranchFormShoppingQuery(shopping?.nombre || '');
    setBranchFormShoppingOpen(false);
    setBranchFormShoppingHighlightedIndex(-1);
  };

  const onShoppingQueryChange = (value: string) => {
    setBranchFormShoppingQuery(value);
    setBranchFormShoppingOpen(true);
    setBranchFormShoppingHighlightedIndex(0);

    const normalized = normalizeSearchValue(value);
    if (!normalized) {
      setBranchFormShoppingId('');
      return;
    }

    const exactMatch = visibleShoppingChoices.find(
      (item) => normalizeSearchValue(item.nombre) === normalized,
    );
    if (exactMatch) {
      setBranchFormShoppingId(exactMatch.id);
      return;
    }
    setBranchFormShoppingId('');
  };

  const onShoppingInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (branchFormShoppingOpen) {
        event.preventDefault();
        setBranchFormShoppingOpen(false);
        setBranchFormShoppingHighlightedIndex(-1);
      }
      return;
    }

    if (event.key === 'Tab') {
      setBranchFormShoppingOpen(false);
      setBranchFormShoppingHighlightedIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (shoppingKeyboardOptions.length === 0) {
        return;
      }

      setBranchFormShoppingOpen(true);
      setBranchFormShoppingHighlightedIndex((previous) => {
        const fallbackIndex = shoppingKeyboardOptions.findIndex((item) => item.id === branchFormShoppingId);

        if (previous < 0) {
          return fallbackIndex >= 0 ? fallbackIndex : 0;
        }

        if (event.key === 'ArrowDown') {
          return (previous + 1) % shoppingKeyboardOptions.length;
        }
        return (previous - 1 + shoppingKeyboardOptions.length) % shoppingKeyboardOptions.length;
      });
      return;
    }

    if (event.key === 'Enter' && branchFormShoppingOpen) {
      event.preventDefault();
      if (shoppingKeyboardOptions.length === 0) {
        return;
      }

      const safeIndex =
        branchFormShoppingHighlightedIndex >= 0
          ? branchFormShoppingHighlightedIndex
          : Math.max(0, shoppingKeyboardOptions.findIndex((item) => item.id === branchFormShoppingId));
      const candidate = shoppingKeyboardOptions[safeIndex];
      if (candidate) {
        selectShopping(candidate.id);
      }
    }
  };

  const resetBranchForm = () => {
    setBranchFormMerchantId('');
    setBranchFormBranchId(null);
    setBranchFormName('');
    setBranchFormAddress('');
    setBranchFormCity('');
    setBranchFormProvince('');
    setBranchFormCountry('Argentina');
    setBranchFormRetailerId('');
    setBranchFormRetailerOptions([]);
    setBranchFormProcessor('');
    setBranchFormCodeDraft({});
    setBranchFormShoppingId('');
    setBranchFormShoppingQuery('');
    setBranchFormShoppingOpen(false);
    setBranchFormShoppingHighlightedIndex(-1);
    setBranchFormActive(true);
  };

  const openCreateBranchModal = (merchant: Merchant, preferredRetailerId?: string | null) => {
    const options = getMerchantRetailerOptions(merchant);
    const fallbackRetailerId = options.length === 1 ? options[0].id : '';
    setBranchFormMode('create');
    setBranchFormMerchantId(merchant.id);
    setBranchFormBranchId(null);
    setBranchFormName('');
    setBranchFormAddress('');
    setBranchFormCity('');
    setBranchFormProvince('');
    setBranchFormCountry('Argentina');
    setBranchFormRetailerOptions(options);
    setBranchFormRetailerId(preferredRetailerId || fallbackRetailerId);
    setBranchFormProcessor('');
    setBranchFormCodeDraft(buildBranchCodeDraft());
    setBranchFormShoppingId('');
    setBranchFormShoppingQuery('');
    setBranchFormShoppingOpen(false);
    setBranchFormShoppingHighlightedIndex(-1);
    setBranchFormActive(true);
    setBranchModalOpen(true);
  };

  const openEditBranchModal = (merchant: Merchant, branch: MerchantBranch) => {
    const options = getMerchantRetailerOptions(merchant);
    setBranchFormMode('edit');
    setBranchFormMerchantId(merchant.id);
    setBranchFormBranchId(branch.id);
    setBranchFormName(branch.nombre || '');
    setBranchFormAddress(branch.direccion || '');
    setBranchFormCity(branch.ciudad || '');
    setBranchFormProvince(branch.provincia || '');
    setBranchFormCountry('Argentina');
    setBranchFormRetailerOptions(options);
    setBranchFormRetailerId(branch.retailerId || '');
    setBranchFormProcessor(branch.processor || '');
    setBranchFormCodeDraft(buildBranchCodeDraft(branch.establishments));
    setBranchFormShoppingId(branch.shopping?.id || '');
    setBranchFormShoppingQuery(branch.shopping?.nombre || '');
    setBranchFormShoppingOpen(false);
    setBranchFormShoppingHighlightedIndex(-1);
    setBranchFormActive(branch.activo !== false);
    setBranchModalOpen(true);
  };

  const closeBranchFormModal = () => {
    setBranchModalOpen(false);
    setBranchFormSaving(false);
    resetBranchForm();
  };

  const saveBranchForm = async () => {
    const nombre = branchFormName.trim();
    const direccion = branchFormAddress.trim();
    const ciudad = branchFormCity.trim();
    const provincia = branchFormProvince.trim();
    const pais = branchFormCountry.trim() || 'Argentina';

    if (!nombre || !direccion || !ciudad || !provincia || !pais) {
      setError('Completa nombre, direccion, ciudad, provincia y pais del PDV.');
      return;
    }

    if (!branchFormMerchantId) {
      setError('No se encontro la razon social del PDV.');
      return;
    }

    setBranchFormSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const establishments = activeCardConfigs
        .map((config) => ({
          cardNetwork: config.network,
          number: (branchFormCodeDraft[config.network] || '').trim(),
        }))
        .filter((item) => item.number !== '');
      const shoppingIdPayload =
        branchFormMode === 'edit' ? branchFormShoppingId : branchFormShoppingId || undefined;

      const payload = {
        nombre,
        direccion,
        ciudad,
        provincia,
        pais,
        retailerId: branchFormRetailerId || undefined,
        processor: branchFormProcessor.trim() || undefined,
        establishments,
        shoppingId: shoppingIdPayload,
        activo: branchFormActive,
      };

      if (branchFormMode === 'edit' && branchFormBranchId) {
        await apiJson(`/branches/${branchFormBranchId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess(`PDV ${nombre} actualizado.`);
      } else {
        await apiJson(`/merchants/${branchFormMerchantId}/branches`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(`PDV ${nombre} creado.`);
      }

      closeBranchFormModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el PDV');
    } finally {
      setBranchFormSaving(false);
    }
  };

  const toggleBranchActive = async (branch: MerchantBranch, nextActive: boolean) => {
    setBranchTogglingId(branch.id);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/branches/${branch.id}`, {
        method: 'PUT',
        body: JSON.stringify({ activo: nextActive }),
      });
      setSuccess(`PDV ${branch.nombre} ${nextActive ? 'activado' : 'desactivado'}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del PDV');
    } finally {
      setBranchTogglingId(null);
    }
  };

  const deleteBranch = async (branch: MerchantBranch) => {
    if (!window.confirm(`Eliminar el PDV "${branch.nombre}"?`)) {
      return;
    }
    setBranchDeletingId(branch.id);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/branches/${branch.id}`, { method: 'DELETE' });
      setSuccess(`PDV ${branch.nombre} eliminado.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el PDV');
    } finally {
      setBranchDeletingId(null);
    }
  };

  const resetBrandForm = () => {
    setBrandFormId(null);
    setBrandFormNombre('');
    setBrandFormActivo(true);
    setBrandFormMode('create');
  };

  const openCreateBrandModal = () => {
    resetBrandForm();
    setBrandFormMode('create');
    setBrandModalOpen(true);
  };

  const openEditBrandModal = (brand: BrandRow) => {
    if (brand.id === '__no_brand__') return;
    setBrandFormMode('edit');
    setBrandFormId(brand.id);
    setBrandFormNombre(brand.nombre);
    setBrandFormActivo(brand.activo);
    setBrandModalOpen(true);
  };

  const closeBrandModal = () => {
    setBrandModalOpen(false);
    setBrandFormSaving(false);
    resetBrandForm();
  };

  const saveBrandForm = async () => {
    const nombre = brandFormNombre.trim();
    if (!nombre) {
      setError('El nombre del retailer es obligatorio.');
      return;
    }

    setBrandFormSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        nombre,
        activo: brandFormActivo,
      };

      if (brandFormMode === 'edit' && brandFormId) {
        await apiJson(withBankQuery(`/brands/${brandFormId}`), {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccess(`Retailer ${nombre} actualizado.`);
      } else {
        await apiJson(withBankQuery('/brands'), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(`Retailer ${nombre} creado.`);
      }

      closeBrandModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el retailer');
    } finally {
      setBrandFormSaving(false);
    }
  };

  const resetMerchantForm = () => {
    setMerchantFormId(null);
    setMerchantFormMode('create');
    setMerchantFormNombre('');
    setMerchantFormRazonSocial('');
    setMerchantFormCategoria(categoriesCatalog[0]?.nombre || 'General');
    setMerchantFormCuit('');
    setMerchantFormEstado('ACTIVE');
    setMerchantFormBrandIds([]);
  };

  const openCreateMerchantModal = () => {
    resetMerchantForm();
    setMerchantFormMode('create');
    setMerchantModalOpen(true);
  };

  const openEditMerchantModal = (merchant: Merchant) => {
    setMerchantFormMode('edit');
    setMerchantFormId(merchant.id);
    setMerchantFormNombre(merchant.nombre || '');
    setMerchantFormRazonSocial(merchant.razonSocial || '');
    setMerchantFormCategoria(merchant.categoria || categoriesCatalog[0]?.nombre || 'General');
    setMerchantFormCuit(merchant.cuit || '');
    setMerchantFormEstado(
      merchant.estado === 'ACTIVE' || merchant.estado === 'RESTRICTED' ? merchant.estado : 'PENDING',
    );
    setMerchantFormBrandIds((merchant.brands || []).map((item) => item.brandId));
    setMerchantModalOpen(true);
  };

  const closeMerchantModal = () => {
    setMerchantModalOpen(false);
    setMerchantFormSaving(false);
    resetMerchantForm();
  };

  const toggleMerchantBrandSelection = (brandId: string) => {
    setMerchantFormBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId],
    );
  };

  const saveMerchantForm = async () => {
    const nombre = merchantFormNombre.trim();
    const categoria = merchantFormCategoria.trim();
    const razonSocial = merchantFormRazonSocial.trim();

    if (!nombre) {
      setError('El nombre de fantasia de la razon social es obligatorio.');
      return;
    }
    if (!categoria) {
      setError('La categoria de la razon social es obligatoria.');
      return;
    }

    setMerchantFormSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        nombre,
        razonSocial: razonSocial || undefined,
        categoria,
        cuit: merchantFormCuit.trim() || undefined,
        estado: merchantFormEstado,
        brandIds: merchantFormBrandIds,
      };

      if (merchantFormMode === 'edit' && merchantFormId) {
        await apiJson(withBankQuery(`/merchants/${merchantFormId}`), {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess(`Razon social ${razonSocial || nombre} actualizada.`);
      } else {
        await apiJson(withBankQuery('/merchants'), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(`Razon social ${razonSocial || nombre} creada.`);
      }

      closeMerchantModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la razon social');
    } finally {
      setMerchantFormSaving(false);
    }
  };

  const branchFormMerchant = branchFormMerchantId ? merchantById.get(branchFormMerchantId) : null;

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Comercios - Retailers y Razones sociales</h1>
      </header>

      <div className="pt-24 px-8 pb-12 space-y-6">
        {!canView ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            No tienes permisos para acceder a esta seccion.
          </div>
        ) : needsBankSelection ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            Selecciona un banco en SuperAdmin para ver los comercios de Comafi.
          </div>
        ) : (
          <>
            {error ? (
              <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div>
            ) : null}
            {success ? (
              <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{success}</div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-3">
              <div className="bg-surface-container-lowest rounded-xl px-4 py-4 shadow-[0px_8px_24px_rgba(42,52,57,0.06)]">
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Retailers</div>
                <div className="mt-1 text-2xl font-extrabold text-on-surface">{totalBrands}</div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl px-4 py-4 shadow-[0px_8px_24px_rgba(42,52,57,0.06)]">
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razones sociales</div>
                <div className="mt-1 text-2xl font-extrabold text-on-surface">{totalMerchants}</div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl px-4 py-4 shadow-[0px_8px_24px_rgba(42,52,57,0.06)]">
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Sin retailer</div>
                <div className="mt-1 text-2xl font-extrabold text-on-surface">{merchantsWithoutBrand}</div>
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-white">
                  <button
                    type="button"
                    onClick={() => setView('brands')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      view === 'brands' ? 'bg-primary text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {viewLabels.brands}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('merchants')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      view === 'merchants' ? 'bg-primary text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {viewLabels.merchants}
                  </button>
                </div>

                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                  <input
                    type="text"
                    className="w-full md:w-80 bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                    placeholder={
                      view === 'brands'
                        ? 'Buscar retailer o razon social...'
                        : 'Buscar razon social, cuit o retailer...'
                    }
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {view === 'brands' && canCreateBrands ? (
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                      onClick={openCreateBrandModal}
                    >
                      Nuevo retailer
                    </button>
                  ) : null}
                  {view === 'merchants' && canCreateMerchants ? (
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                      onClick={openCreateMerchantModal}
                    >
                      Nueva razon social
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                {view === 'brands' ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-4 py-3 w-10">&nbsp;</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Retailer</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razones sociales</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-sm text-on-surface-variant">
                            Cargando datos...
                          </td>
                        </tr>
                      ) : null}
                      {!loading && filteredBrandRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-sm text-on-surface-variant">
                            No hay resultados para este filtro.
                          </td>
                        </tr>
                      ) : null}
                      {filteredBrandRows.map((row) => {
                        const expanded = expandedId === row.id;
                        return (
                          <Fragment key={row.id}>
                            <tr className="hover:bg-surface-container-low transition-colors">
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                  onClick={() => setExpandedId((prev) => (prev === row.id ? null : row.id))}
                                >
                                  <span className={`text-sm font-bold leading-none transition-transform ${expanded ? 'rotate-90' : ''}`}>
                                    {'>'}
                                  </span>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-on-surface font-semibold">{row.nombre}</td>
                              <td className="px-4 py-3 text-sm text-on-surface-variant">{row.merchants.length}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    row.id === '__no_brand__'
                                      ? 'bg-slate-100 text-slate-600'
                                      : row.activo
                                        ? 'bg-primary-container text-on-primary-container'
                                        : 'bg-surface-variant text-on-surface-variant'
                                  }`}
                                >
                                  {row.id === '__no_brand__' ? 'N/A' : row.activo ? 'Activa' : 'Inactiva'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  {canEditBrands && row.id !== '__no_brand__' ? (
                                    <button
                                      type="button"
                                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                      onClick={() => openEditBrandModal(row)}
                                    >
                                      Editar
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                            {expanded ? (
                              <tr>
                                <td colSpan={5} className="px-4 pb-4">
                                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4">
                                    <div className="mb-3 text-sm font-semibold text-slate-900">Razones sociales vinculadas</div>
                                    {row.merchants.length === 0 ? (
                                      <div className="text-sm text-slate-500">Sin razones sociales vinculadas.</div>
                                    ) : (
                                      <div className="space-y-2">
                                        {row.merchants.map((merchant) => {
                                          const linkedBranches = (merchant.branches || []).filter((branch) =>
                                            row.id === '__no_brand__' ? !branch.retailerId : branch.retailerId === row.id,
                                          );

                                          return (
                                            <div key={merchant.id} className="rounded-lg border border-slate-200/70 bg-white px-3 py-2">
                                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                  <div className="text-sm font-semibold text-slate-800">
                                                    {merchantDisplayName(merchant)}
                                                  </div>
                                                  <div className="text-xs text-slate-500">{merchant.cuit || '-'}</div>
                                                </div>
                                                <span
                                                  className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${merchantStatusBadge(
                                                    merchant.estado,
                                                  )}`}
                                                >
                                                  {merchant.estado || 'PENDING'}
                                                </span>
                                              </div>
                                              <div className="mt-2">
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                    PDV vinculados ({linkedBranches.length})
                                                  </div>
                                                  {canManageBranches ? (
                                                    <button
                                                      type="button"
                                                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                                      onClick={() =>
                                                        openCreateBranchModal(
                                                          merchant,
                                                          row.id === '__no_brand__' ? null : row.id,
                                                        )
                                                      }
                                                    >
                                                      Agregar PDV
                                                    </button>
                                                  ) : null}
                                                </div>
                                                {linkedBranches.length === 0 ? (
                                                  <div className="mt-1 text-xs text-slate-500">
                                                    Sin PDV vinculados a este retailer.
                                                  </div>
                                                ) : (
                                                  <div className="mt-2 space-y-2">
                                                    {linkedBranches.map((branch) => (
                                                      <div
                                                        key={branch.id}
                                                        className="rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2"
                                                      >
                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                          <div>
                                                            <div className="flex items-center gap-2">
                                                              <div className="text-xs font-semibold text-slate-800">{branch.nombre}</div>
                                                              <span
                                                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                                                  branch.activo === false
                                                                    ? 'bg-slate-200 text-slate-700'
                                                                    : 'bg-emerald-100 text-emerald-700'
                                                                }`}
                                                              >
                                                                {branch.activo === false ? 'Inactivo' : 'Activo'}
                                                              </span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-500">
                                                              {(branch.establishments || []).length === 0
                                                                ? 'Sin codigos cargados'
                                                                : (branch.establishments || [])
                                                                    .map((item) => {
                                                                      const label =
                                                                        cardCodeLabelsByNetwork.get(item.cardNetwork) ||
                                                                        item.cardNetwork;
                                                                      return `${label}: ${item.number}`;
                                                                    })
                                                                    .join(' | ')}
                                                            </div>
                                                          </div>
                                                          <div className="flex flex-wrap items-center gap-2">
                                                            {canManageBranches ? (
                                                              <button
                                                                type="button"
                                                                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                                                onClick={() => openEditBranchModal(merchant, branch)}
                                                              >
                                                                Editar
                                                              </button>
                                                            ) : null}
                                                            {canManageBranches ? (
                                                              <button
                                                                type="button"
                                                                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                                                                onClick={() =>
                                                                  toggleBranchActive(branch, branch.activo === false)
                                                                }
                                                                disabled={branchTogglingId === branch.id}
                                                              >
                                                                {branchTogglingId === branch.id
                                                                  ? 'Guardando...'
                                                                  : branch.activo === false
                                                                    ? 'Activar'
                                                                    : 'Desactivar'}
                                                              </button>
                                                            ) : null}
                                                            {canDeleteBranches ? (
                                                              <button
                                                                type="button"
                                                                className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-700 hover:border-red-300 disabled:opacity-60"
                                                                onClick={() => deleteBranch(branch)}
                                                                disabled={branchDeletingId === branch.id}
                                                              >
                                                                {branchDeletingId === branch.id ? 'Eliminando...' : 'Eliminar'}
                                                              </button>
                                                            ) : null}
                                                            <button
                                                              type="button"
                                                              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                                              onClick={() => openBranchCodesModal(branch)}
                                                            >
                                                              Codigos
                                                            </button>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-4 py-3 w-10">&nbsp;</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razon social</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">CUIT</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Retailers vinculados</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-sm text-on-surface-variant">
                            Cargando datos...
                          </td>
                        </tr>
                      ) : null}
                      {!loading && filteredMerchants.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-sm text-on-surface-variant">
                            No hay resultados para este filtro.
                          </td>
                        </tr>
                      ) : null}
                      {filteredMerchants.map((merchant) => {
                        const expanded = expandedId === merchant.id;
                        const linkedBrands = (merchant.brands || [])
                          .map((link) => link.brand)
                          .filter((brand): brand is { id: string; nombre: string; activo: boolean } => Boolean(brand));
                        const linkedBranches = merchant.branches || [];
                        const brandNameById = new Map(linkedBrands.map((brand) => [brand.id, brand.nombre]));

                        return (
                          <Fragment key={merchant.id}>
                            <tr className="hover:bg-surface-container-low transition-colors">
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                  onClick={() => setExpandedId((prev) => (prev === merchant.id ? null : merchant.id))}
                                >
                                  <span className={`text-sm font-bold leading-none transition-transform ${expanded ? 'rotate-90' : ''}`}>
                                    {'>'}
                                  </span>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-on-surface font-semibold">{merchantDisplayName(merchant)}</td>
                              <td className="px-4 py-3 text-sm text-on-surface-variant">{merchant.cuit || '-'}</td>
                              <td className="px-4 py-3 text-sm text-on-surface-variant">{linkedBrands.length}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${merchantStatusBadge(
                                    merchant.estado,
                                  )}`}
                                >
                                  {merchant.estado || 'PENDING'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  {canEditMerchants ? (
                                    <button
                                      type="button"
                                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                      onClick={() => openEditMerchantModal(merchant)}
                                    >
                                      Editar
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                            {expanded ? (
                              <tr>
                                <td colSpan={6} className="px-4 pb-4">
                                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 space-y-4">
                                    <div>
                                      <div className="mb-3 text-sm font-semibold text-slate-900">Retailers vinculados</div>
                                      {linkedBrands.length === 0 ? (
                                        <div className="text-sm text-slate-500">Esta razon social no tiene retailers vinculados.</div>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {linkedBrands.map((brand) => (
                                            <span
                                              key={brand.id}
                                              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                                            >
                                              {brand.nombre}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <div className="mb-3 flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-slate-900">
                                          Puntos de venta ({linkedBranches.length})
                                        </div>
                                        {canManageBranches ? (
                                          <button
                                            type="button"
                                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                            onClick={() => openCreateBranchModal(merchant)}
                                          >
                                            Agregar PDV
                                          </button>
                                        ) : null}
                                      </div>
                                      {linkedBranches.length === 0 ? (
                                        <div className="text-sm text-slate-500">
                                          Esta razon social no tiene puntos de venta cargados.
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {linkedBranches.map((branch) => {
                                            const retailerName =
                                              branch.retailer?.nombre ||
                                              (branch.retailerId ? brandNameById.get(branch.retailerId) : null) ||
                                              'Sin retailer';
                                            const shoppingName = branch.shopping?.nombre || '-';

                                            return (
                                              <div
                                                key={branch.id}
                                                className="rounded-lg border border-slate-200/70 bg-white px-3 py-3"
                                              >
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <div className="text-sm font-semibold text-slate-800">{branch.nombre}</div>
                                                    <span
                                                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                                        branch.activo === false
                                                          ? 'bg-slate-200 text-slate-700'
                                                          : 'bg-emerald-100 text-emerald-700'
                                                      }`}
                                                    >
                                                      {branch.activo === false ? 'Inactivo' : 'Activo'}
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    {canManageBranches ? (
                                                      <button
                                                        type="button"
                                                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                                        onClick={() => openEditBranchModal(merchant, branch)}
                                                      >
                                                        Editar
                                                      </button>
                                                    ) : null}
                                                    {canManageBranches ? (
                                                      <button
                                                        type="button"
                                                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                                                        onClick={() => toggleBranchActive(branch, branch.activo === false)}
                                                        disabled={branchTogglingId === branch.id}
                                                      >
                                                        {branchTogglingId === branch.id
                                                          ? 'Guardando...'
                                                          : branch.activo === false
                                                            ? 'Activar'
                                                            : 'Desactivar'}
                                                      </button>
                                                    ) : null}
                                                    {canDeleteBranches ? (
                                                      <button
                                                        type="button"
                                                        className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-700 hover:border-red-300 disabled:opacity-60"
                                                        onClick={() => deleteBranch(branch)}
                                                        disabled={branchDeletingId === branch.id}
                                                      >
                                                        {branchDeletingId === branch.id ? 'Eliminando...' : 'Eliminar'}
                                                      </button>
                                                    ) : null}
                                                    <button
                                                      type="button"
                                                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                                                      onClick={() => openBranchCodesModal(branch)}
                                                    >
                                                      Codigos
                                                    </button>
                                                  </div>
                                                </div>
                                                <div className="mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                                                  <div>
                                                    <span className="font-semibold text-slate-700">Ubicacion:</span>{' '}
                                                    {branchLocation(branch)}
                                                  </div>
                                                  <div>
                                                    <span className="font-semibold text-slate-700">Shopping:</span> {shoppingName}
                                                  </div>
                                                  <div>
                                                    <span className="font-semibold text-slate-700">Retailer:</span> {retailerName}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {brandModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {brandFormMode === 'edit' ? 'Editar retailer' : 'Nuevo retailer'}
              </h2>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500"
                onClick={closeBrandModal}
                disabled={brandFormSaving}
              >
                Cerrar
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={brandFormNombre}
                  onChange={(event) => setBrandFormNombre(event.target.value)}
                  placeholder="Ej: Farmacity"
                  disabled={brandFormSaving}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={brandFormActivo}
                  onChange={(event) => setBrandFormActivo(event.target.checked)}
                  disabled={brandFormSaving}
                />
                Retailer activo
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200/70 px-6 py-4">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
                onClick={closeBrandModal}
                disabled={brandFormSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300 disabled:opacity-60"
                onClick={saveBrandForm}
                disabled={brandFormSaving}
              >
                {brandFormSaving ? 'Guardando...' : brandFormMode === 'edit' ? 'Guardar cambios' : 'Crear retailer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {merchantModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {merchantFormMode === 'edit' ? 'Editar razon social' : 'Nueva razon social'}
              </h2>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500"
                onClick={closeMerchantModal}
                disabled={merchantFormSaving}
              >
                Cerrar
              </button>
            </div>
            <div className="p-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Nombre fantasia
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={merchantFormNombre}
                  onChange={(event) => setMerchantFormNombre(event.target.value)}
                  placeholder="Ej: Farmacity Recoleta"
                  disabled={merchantFormSaving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Razon social</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={merchantFormRazonSocial}
                  onChange={(event) => setMerchantFormRazonSocial(event.target.value)}
                  placeholder="Ej: Farmacity S.A."
                  disabled={merchantFormSaving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Categoria</label>
                <input
                  list="merchant-categories-list"
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={merchantFormCategoria}
                  onChange={(event) => setMerchantFormCategoria(event.target.value)}
                  placeholder="Ej: Farmacia"
                  disabled={merchantFormSaving}
                />
                <datalist id="merchant-categories-list">
                  {categoriesCatalog.map((item) => (
                    <option key={item.id} value={item.nombre} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">CUIT</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={merchantFormCuit}
                  onChange={(event) => setMerchantFormCuit(event.target.value)}
                  placeholder="30-12345678-9"
                  disabled={merchantFormSaving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={merchantFormEstado}
                  onChange={(event) =>
                    setMerchantFormEstado(event.target.value as 'ACTIVE' | 'PENDING' | 'RESTRICTED')
                  }
                  disabled={merchantFormSaving}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="RESTRICTED">Restringido</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Retailers vinculados
                </div>
                {selectableBrands.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-500">No hay retailers disponibles para vincular.</div>
                ) : (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {selectableBrands.map((brand) => (
                      <label
                        key={brand.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={merchantFormBrandIds.includes(brand.id)}
                          onChange={() => toggleMerchantBrandSelection(brand.id)}
                          disabled={merchantFormSaving}
                        />
                        {brand.nombre}
                        {!brand.activo ? ' (inactivo)' : ''}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200/70 px-6 py-4">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
                onClick={closeMerchantModal}
                disabled={merchantFormSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300 disabled:opacity-60"
                onClick={saveMerchantForm}
                disabled={merchantFormSaving}
              >
                {merchantFormSaving ? 'Guardando...' : merchantFormMode === 'edit' ? 'Guardar cambios' : 'Crear razon social'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {branchModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {branchFormMode === 'edit' ? 'Editar punto de venta' : 'Agregar punto de venta'}
                </h2>
                <div className="text-xs text-slate-500">
                  {branchFormMerchant ? merchantDisplayName(branchFormMerchant) : 'Razon social'}
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500"
                onClick={closeBranchFormModal}
                disabled={branchFormSaving}
              >
                Cerrar
              </button>
            </div>

            <div className="p-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchFormName}
                  onChange={(event) => setBranchFormName(event.target.value)}
                  placeholder="PDV Recoleta"
                  disabled={branchFormSaving}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Ubicacion</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchFormAddress}
                  onChange={(event) => setBranchFormAddress(event.target.value)}
                  placeholder="Av. Santa Fe 1234"
                  disabled={branchFormSaving}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Ciudad</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchFormCity}
                  onChange={(event) => setBranchFormCity(event.target.value)}
                  placeholder="CABA"
                  disabled={branchFormSaving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Provincia</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchFormProvince}
                  onChange={(event) => setBranchFormProvince(event.target.value)}
                  placeholder="Buenos Aires"
                  disabled={branchFormSaving}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Pais</label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchFormCountry}
                  onChange={(event) => setBranchFormCountry(event.target.value)}
                  placeholder="Argentina"
                  disabled={branchFormSaving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Shopping</label>
                <div className="relative mt-2" ref={shoppingPickerRef}>
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={branchFormShoppingQuery}
                    onChange={(event) => onShoppingQueryChange(event.target.value)}
                    onFocus={() => setBranchFormShoppingOpen(true)}
                    onKeyDown={onShoppingInputKeyDown}
                    placeholder="Buscar shopping..."
                    disabled={branchFormSaving}
                  />
                  {branchFormShoppingOpen ? (
                    <div className="absolute z-40 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-[0px_16px_32px_rgba(15,23,42,0.18)]">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 ${
                          branchFormShoppingHighlightedIndex === 0 ? 'bg-slate-100' : ''
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setBranchFormShoppingHighlightedIndex(0)}
                        onClick={() => selectShopping('')}
                      >
                        <span>Sin shopping</span>
                        {branchFormShoppingId === '' ? (
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Seleccionado</span>
                        ) : null}
                      </button>
                      {shoppingOptions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500">No hay shoppings que coincidan con la busqueda.</div>
                      ) : (
                        shoppingOptions.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 ${
                              branchFormShoppingHighlightedIndex === index + 1 ? 'bg-slate-100' : ''
                            }`}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setBranchFormShoppingHighlightedIndex(index + 1)}
                            onClick={() => selectShopping(item.id)}
                          >
                            <span>
                              {item.nombre}
                              {item.activo ? '' : ' (inactivo)'}
                            </span>
                            {branchFormShoppingId === item.id ? (
                              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Seleccionado</span>
                            ) : null}
                          </button>
                        ))
                      )}
                      {hasMoreShoppingOptions ? (
                        <div className="px-3 py-2 text-[11px] text-slate-500">
                          Mostrando 20 resultados. Segui escribiendo para acotar.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {selectedShopping
                    ? `Seleccionado: ${selectedShopping.nombre}${selectedShopping.activo ? '' : ' (inactivo)'}`
                    : 'Sin shopping seleccionado'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Procesador</label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchFormProcessor}
                  onChange={(event) => setBranchFormProcessor(event.target.value)}
                  disabled={branchFormSaving}
                >
                  <option value="">Sin seleccionar</option>
                  {activeProcessorConfigs.map((config) => (
                    <option key={config.id} value={config.nombre}>
                      {config.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Retailer</label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchFormRetailerId}
                  onChange={(event) => setBranchFormRetailerId(event.target.value)}
                  disabled={branchFormSaving}
                >
                  <option value="">Sin seleccionar</option>
                  {branchFormRetailerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Codigos de comercio
                </div>
                {activeCardConfigs.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No hay categorias de codigos de comercio activas en Configuracion.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeCardConfigs.map((config) => (
                      <div key={config.id}>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                          {config.label}
                        </label>
                        <input
                          className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                          value={branchFormCodeDraft[config.network] || ''}
                          onChange={(event) =>
                            setBranchFormCodeDraft((prev) => ({
                              ...prev,
                              [config.network]: event.target.value,
                            }))
                          }
                          placeholder={`Codigo para ${config.label}`}
                          disabled={branchFormSaving}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={branchFormActive}
                    onChange={(event) => setBranchFormActive(event.target.checked)}
                    disabled={branchFormSaving}
                  />
                  PDV activo
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200/70 px-6 py-4">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
                onClick={closeBranchFormModal}
                disabled={branchFormSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300 disabled:opacity-60"
                onClick={saveBranchForm}
                disabled={branchFormSaving}
              >
                {branchFormSaving ? 'Guardando...' : branchFormMode === 'edit' ? 'Guardar cambios' : 'Crear PDV'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingBranch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Codigos de comercio por tarjeta</h2>
                <div className="text-xs text-slate-500">{editingBranch.nombre}</div>
              </div>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500"
                onClick={closeBranchCodesModal}
              >
                Cerrar
              </button>
            </div>
            <div className="p-6 space-y-4">
              {activeCardConfigs.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No hay tarjetas habilitadas para este banco en Configuracion.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCardConfigs.map((config) => (
                    <div key={config.id}>
                      <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                        {config.label}
                      </label>
                      <input
                        className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                        value={branchCodeDraft[config.network] || ''}
                        onChange={(event) =>
                          setBranchCodeDraft((prev) => ({
                            ...prev,
                            [config.network]: event.target.value,
                          }))
                        }
                        placeholder={`Codigo para ${config.label}`}
                        disabled={savingBranchCodes}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
                  onClick={closeBranchCodesModal}
                  disabled={savingBranchCodes}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  onClick={saveBranchCodes}
                  disabled={savingBranchCodes || activeCardConfigs.length === 0}
                >
                  {savingBranchCodes ? 'Guardando...' : 'Guardar codigos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
