'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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

type Merchant = {
  id: string;
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  estado?: 'ACTIVE' | 'PENDING' | 'RESTRICTED' | string;
  categoria?: string | null;
  brands?: MerchantBrandLink[];
};

type BrandRow = {
  id: string;
  nombre: string;
  activo: boolean;
  merchants: Merchant[];
};

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

export default function ComerciosPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<'brands' | 'merchants'>('brands');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canView =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BANK_OPS' ||
    role === 'BANK_APPROVER' ||
    role === 'BRAND_ADMIN' ||
    role === 'LEGAL_ENTITY_ADMIN' ||
    role === 'MERCHANT_ADMIN' ||
    role === 'MERCHANT_USER';

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
    } catch {
      setRole(null);
    }
  }, [router]);

  useEffect(() => {
    if (!canView) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiJson<Merchant[]>('/merchants');
        setMerchants(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los comercios');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [canView]);

  useEffect(() => {
    setExpandedId(null);
  }, [view, search]);

  const brandRows = useMemo(() => {
    const byBrand = new Map<string, BrandRow>();

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
  }, [merchants]);

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

  const totalBrands = brandRows.filter((row) => row.id !== '__no_brand__').length;
  const totalMerchants = merchants.length;
  const merchantsWithoutBrand = merchants.filter((merchant) => (merchant.brands || []).length === 0).length;

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
        ) : (
          <>
            {error ? (
              <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div>
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                            Cargando datos...
                          </td>
                        </tr>
                      ) : null}
                      {!loading && filteredBrandRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
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
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-4 py-3 w-10">&nbsp;</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razon social</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">CUIT</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Retailers vinculados</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
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
                      {!loading && filteredMerchants.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-sm text-on-surface-variant">
                            No hay resultados para este filtro.
                          </td>
                        </tr>
                      ) : null}
                      {filteredMerchants.map((merchant) => {
                        const expanded = expandedId === merchant.id;
                        const linkedBrands = (merchant.brands || [])
                          .map((link) => link.brand)
                          .filter((brand): brand is { id: string; nombre: string; activo: boolean } => Boolean(brand));

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
                            </tr>
                            {expanded ? (
                              <tr>
                                <td colSpan={5} className="px-4 pb-4">
                                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4">
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
    </AppShell>
  );
}
