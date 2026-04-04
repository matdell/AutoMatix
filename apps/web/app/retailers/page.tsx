'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson, clearToken, getToken } from '@/lib/api';

type MerchantBrandLink = {
  brandId: string;
  brand?: {
    id: string;
    nombre: string;
    activo: boolean;
  } | null;
};

type Merchant = {
  id: string;
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  estado?: 'ACTIVE' | 'PENDING' | 'RESTRICTED' | string;
  brands?: MerchantBrandLink[];
};

type Brand = {
  id: string;
  nombre: string;
  activo: boolean;
};

type RetailerRow = {
  id: string;
  nombre: string;
  activo: boolean;
  merchants: Merchant[];
};

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-widest text-slate-500"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

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

function buildRetailerRows(merchants: Merchant[], knownBrands: Brand[]) {
  const byBrand = new Map<string, RetailerRow>();

  for (const brand of knownBrands) {
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
}

export default function RetailersPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expandedRetailerId, setExpandedRetailerId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retailerNombre, setRetailerNombre] = useState('');
  const [retailerSitioWeb, setRetailerSitioWeb] = useState('');
  const [retailerEmail, setRetailerEmail] = useState('');
  const [retailerTelefono, setRetailerTelefono] = useState('');
  const [retailerProcessor, setRetailerProcessor] = useState('');
  const [retailerActivo, setRetailerActivo] = useState(true);

  const canView =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BANK_OPS' ||
    role === 'BANK_APPROVER' ||
    role === 'BRAND_ADMIN' ||
    role === 'LEGAL_ENTITY_ADMIN' ||
    role === 'MERCHANT_ADMIN' ||
    role === 'MERCHANT_USER';

  const canCreate = role === 'SUPERADMIN' || role === 'BANK_ADMIN';
  const canListBrands = role === 'SUPERADMIN' || role === 'BANK_ADMIN' || role === 'BRAND_ADMIN';

  useEffect(() => {
    if (!getToken()) {
      setRoleResolved(true);
      router.push('/login');
      return;
    }
    const raw = window.localStorage.getItem('user');
    if (!raw) {
      clearToken();
      setRole(null);
      setRoleResolved(true);
      router.push('/login');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setRole(parsed?.role ?? null);
    } catch {
      clearToken();
      setRole(null);
      router.push('/login');
    }
    setRoleResolved(true);
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const merchantsPromise = apiJson<Merchant[]>('/merchants');
      const brandsPromise = canListBrands
        ? apiJson<Brand[]>('/brands').catch(() => [])
        : Promise.resolve<Brand[]>([]);
      const [merchantData, brandData] = await Promise.all([merchantsPromise, brandsPromise]);
      setMerchants(merchantData);
      setBrands(brandData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los retailers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    void loadData();
  }, [canView, canListBrands]);

  useEffect(() => {
    setExpandedRetailerId(null);
  }, [search]);

  const retailerRows = useMemo(() => buildRetailerRows(merchants, brands), [merchants, brands]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRetailerRows = useMemo(() => {
    if (!normalizedSearch) return retailerRows;
    return retailerRows.filter((row) => {
      if (row.nombre.toLowerCase().includes(normalizedSearch)) return true;
      return row.merchants.some((merchant) => {
        const text = `${merchantDisplayName(merchant)} ${merchant.cuit || ''}`.toLowerCase();
        return text.includes(normalizedSearch);
      });
    });
  }, [retailerRows, normalizedSearch]);

  const totalRetailers = retailerRows.filter((row) => row.id !== '__no_brand__').length;
  const merchantsWithoutRetailer = merchants.filter((merchant) => (merchant.brands || []).length === 0).length;

  const resetRetailerForm = () => {
    setRetailerNombre('');
    setRetailerSitioWeb('');
    setRetailerEmail('');
    setRetailerTelefono('');
    setRetailerProcessor('');
    setRetailerActivo(true);
  };

  const onCreateRetailer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiJson('/brands', {
        method: 'POST',
        body: JSON.stringify({
          nombre: retailerNombre.trim(),
          sitioWeb: retailerSitioWeb.trim() || undefined,
          emailPrincipal: retailerEmail.trim() || undefined,
          telefonoPrincipal: retailerTelefono.trim() || undefined,
          processor: retailerProcessor.trim() || undefined,
          activo: retailerActivo,
        }),
      });

      setSuccess('Retailer creado correctamente.');
      setShowCreateModal(false);
      resetRetailerForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el retailer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Retailers</h1>
        {canCreate ? (
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={() => {
              resetRetailerForm();
              setShowCreateModal(true);
            }}
          >
            Nuevo retailer
          </button>
        ) : null}
      </header>

      <div className="pt-24 px-8 pb-12 space-y-6">
        {!roleResolved ? (
          <div className="text-sm text-on-surface-variant bg-surface-container-low/40 px-4 py-3 rounded-xl">
            Cargando sesion...
          </div>
        ) : !canView ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            No tienes permisos para acceder a esta seccion.
          </div>
        ) : (
          <>
            {error ? <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div> : null}
            {success ? (
              <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{success}</div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2">
              <div className="bg-surface-container-lowest rounded-xl px-4 py-4 shadow-[0px_8px_24px_rgba(42,52,57,0.06)]">
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Retailers</div>
                <div className="mt-1 text-2xl font-extrabold text-on-surface">{totalRetailers}</div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl px-4 py-4 shadow-[0px_8px_24px_rgba(42,52,57,0.06)]">
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razones sin retailer</div>
                <div className="mt-1 text-2xl font-extrabold text-on-surface">{merchantsWithoutRetailer}</div>
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-on-surface-variant">Expande un retailer para ver sus razones sociales.</div>
                <input
                  type="text"
                  className="w-full md:w-96 bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                  placeholder="Buscar retailer, razon social o CUIT..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-3 w-10">&nbsp;</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Retailer</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razones sociales</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                          Cargando retailers...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && filteredRetailerRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                          No hay resultados para este filtro.
                        </td>
                      </tr>
                    ) : null}
                    {filteredRetailerRows.map((row) => {
                      const expanded = expandedRetailerId === row.id;
                      return (
                        <Fragment key={row.id}>
                          <tr className="hover:bg-surface-container-low transition-colors">
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                aria-expanded={expanded}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => setExpandedRetailerId((prev) => (prev === row.id ? null : row.id))}
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
                          </tr>
                          {expanded ? (
                            <tr>
                              <td colSpan={4} className="px-4 pb-4">
                                <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4">
                                  <div className="mb-3 text-sm font-semibold text-slate-900">Razones sociales vinculadas</div>
                                  {row.merchants.length === 0 ? (
                                    <div className="text-sm text-slate-500">Sin razones sociales vinculadas.</div>
                                  ) : (
                                    <div className="space-y-2">
                                      {row.merchants.map((merchant) => (
                                        <div key={merchant.id} className="rounded-lg border border-slate-200/70 bg-white px-3 py-2">
                                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                              <div className="text-sm font-semibold text-slate-800">{merchantDisplayName(merchant)}</div>
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
                                        </div>
                                      ))}
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
              </div>
            </section>
          </>
        )}
      </div>

      <Modal open={showCreateModal} title="Crear retailer" onClose={() => setShowCreateModal(false)}>
        <form onSubmit={onCreateRetailer} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre *</label>
            <input
              className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
              value={retailerNombre}
              onChange={(event) => setRetailerNombre(event.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Sitio web</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={retailerSitioWeb}
                onChange={(event) => setRetailerSitioWeb(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={retailerEmail}
                onChange={(event) => setRetailerEmail(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Telefono</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={retailerTelefono}
                onChange={(event) => setRetailerTelefono(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Processor</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={retailerProcessor}
                onChange={(event) => setRetailerProcessor(event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={retailerActivo}
              onChange={(event) => setRetailerActivo(event.target.checked)}
            />
            Retailer activo
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700"
              onClick={() => setShowCreateModal(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
