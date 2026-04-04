'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson, clearToken, getToken } from '@/lib/api';

type Category = {
  id: string;
  nombre: string;
  activo: boolean;
};

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
  categoria?: string | null;
  estado?: 'ACTIVE' | 'PENDING' | 'RESTRICTED' | string;
  brands?: MerchantBrandLink[];
};

type Brand = {
  id: string;
  nombre: string;
  activo: boolean;
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
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.25)]">
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

export default function RazonesSocialesPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [actorBrandId, setActorBrandId] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expandedMerchantId, setExpandedMerchantId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null);

  const [merchantNombre, setMerchantNombre] = useState('');
  const [merchantRazonSocial, setMerchantRazonSocial] = useState('');
  const [merchantCuit, setMerchantCuit] = useState('');
  const [merchantCategoriaId, setMerchantCategoriaId] = useState('');
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);

  const canView =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BANK_OPS' ||
    role === 'BANK_APPROVER' ||
    role === 'BRAND_ADMIN' ||
    role === 'LEGAL_ENTITY_ADMIN' ||
    role === 'MERCHANT_ADMIN' ||
    role === 'MERCHANT_USER';

  const canManageMerchants =
    role === 'SUPERADMIN' || role === 'BANK_ADMIN' || role === 'BANK_OPS' || role === 'BRAND_ADMIN';

  const enforceActorBrand = role === 'BRAND_ADMIN' && Boolean(actorBrandId);
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
      setActorBrandId(null);
      setRoleResolved(true);
      router.push('/login');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setRole(parsed?.role ?? null);
      setActorBrandId(parsed?.brandId ?? null);
    } catch {
      clearToken();
      setRole(null);
      setActorBrandId(null);
      router.push('/login');
    }

    setRoleResolved(true);
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const merchantsPromise = apiJson<Merchant[]>('/merchants');
      const brandsPromise = canListBrands ? apiJson<Brand[]>('/brands').catch(() => []) : Promise.resolve<Brand[]>([]);
      const categoriesPromise = canManageMerchants
        ? apiJson<Category[]>('/categories').catch(() => [])
        : Promise.resolve<Category[]>([]);

      const [merchantData, brandData, categoryData] = await Promise.all([
        merchantsPromise,
        brandsPromise,
        categoriesPromise,
      ]);

      setMerchants(merchantData);
      setBrands(brandData);
      setCategories(categoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las razones sociales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    void loadData();
  }, [canView, canListBrands, canManageMerchants]);

  useEffect(() => {
    setExpandedMerchantId(null);
  }, [search]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [categories],
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const brandOptions = useMemo(() => {
    const map = new Map<string, Brand>();
    for (const brand of brands) {
      map.set(brand.id, brand);
    }

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
  }, [brands, merchants]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredMerchants = useMemo(() => {
    if (!normalizedSearch) return merchants;
    return merchants.filter((merchant) => {
      const merchantText = `${merchantDisplayName(merchant)} ${merchant.cuit || ''} ${merchant.categoria || ''}`.toLowerCase();
      if (merchantText.includes(normalizedSearch)) return true;
      return (merchant.brands || []).some((link) =>
        link.brand?.nombre.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [merchants, normalizedSearch]);

  const merchantsWithoutRetailer = merchants.filter((merchant) => (merchant.brands || []).length === 0).length;

  const resetForm = () => {
    setMerchantNombre('');
    setMerchantRazonSocial('');
    setMerchantCuit('');
    setMerchantCategoriaId('');
    setSelectedBrandIds(actorBrandId ? [actorBrandId] : []);
    setEditingMerchantId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEdit = (merchant: Merchant) => {
    setEditingMerchantId(merchant.id);
    setMerchantNombre(merchant.nombre || '');
    setMerchantRazonSocial(merchant.razonSocial || '');
    setMerchantCuit(merchant.cuit || '');

    const categoryMatch = categories.find(
      (category) => category.nombre.toLowerCase() === (merchant.categoria || '').toLowerCase(),
    );
    setMerchantCategoriaId(categoryMatch?.id ?? '');

    if (enforceActorBrand && actorBrandId) {
      setSelectedBrandIds([actorBrandId]);
    } else {
      const ids = (merchant.brands || [])
        .map((link) => link.brand?.id)
        .filter((id): id is string => Boolean(id));
      setSelectedBrandIds(ids);
    }

    setShowEditModal(true);
  };

  const canEditMerchant = (merchant: Merchant) => {
    if (!canManageMerchants) return false;
    if (!enforceActorBrand || !actorBrandId) return true;
    return (merchant.brands || []).some((link) => link.brand?.id === actorBrandId);
  };

  const saveMerchant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const category = categoryById.get(merchantCategoriaId);
    if (!category) {
      setError('La categoria es obligatoria para la razon social');
      return;
    }

    const resolvedBrandIds = enforceActorBrand && actorBrandId ? [actorBrandId] : selectedBrandIds;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        nombre: merchantNombre.trim(),
        razonSocial: merchantRazonSocial.trim() || undefined,
        categoria: category.nombre,
        cuit: merchantCuit.trim() || undefined,
        brandIds: resolvedBrandIds,
      };

      if (showCreateModal) {
        await apiJson('/merchants', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Razon social creada correctamente.');
      } else if (showEditModal && editingMerchantId) {
        await apiJson(`/merchants/${editingMerchantId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess('Razon social actualizada correctamente.');
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la razon social');
    } finally {
      setSaving(false);
    }
  };

  const toggleMerchantStatus = async (merchant: Merchant) => {
    if (!canEditMerchant(merchant)) return;

    const nextStatus = merchant.estado === 'RESTRICTED' ? 'ACTIVE' : 'RESTRICTED';

    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/merchants/${merchant.id}`, {
        method: 'PUT',
        body: JSON.stringify({ estado: nextStatus }),
      });
      setSuccess(nextStatus === 'RESTRICTED' ? 'Razon social dada de baja.' : 'Razon social reactivada.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la razon social');
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Razones sociales</h1>
        {canManageMerchants ? (
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={openCreate}
          >
            Nueva razon social
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
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razones sociales</div>
                <div className="mt-1 text-2xl font-extrabold text-on-surface">{merchants.length}</div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl px-4 py-4 shadow-[0px_8px_24px_rgba(42,52,57,0.06)]">
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Sin retailer</div>
                <div className="mt-1 text-2xl font-extrabold text-on-surface">{merchantsWithoutRetailer}</div>
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-on-surface-variant">Expande una razon social para ver retailers vinculados.</div>
                <input
                  type="text"
                  className="w-full md:w-96 bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                  placeholder="Buscar razon social, CUIT, categoria o retailer..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-3 w-10">&nbsp;</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Razon social</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">CUIT</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Categoria</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Retailers vinculados</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                      {canManageMerchants ? (
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={canManageMerchants ? 7 : 6} className="px-4 py-6 text-sm text-on-surface-variant">
                          Cargando razones sociales...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && filteredMerchants.length === 0 ? (
                      <tr>
                        <td colSpan={canManageMerchants ? 7 : 6} className="px-4 py-6 text-sm text-on-surface-variant">
                          No hay resultados para este filtro.
                        </td>
                      </tr>
                    ) : null}
                    {filteredMerchants.map((merchant) => {
                      const expanded = expandedMerchantId === merchant.id;
                      const linkedBrands = (merchant.brands || [])
                        .map((link) => link.brand)
                        .filter((brand): brand is { id: string; nombre: string; activo: boolean } => Boolean(brand));
                      const editable = canEditMerchant(merchant);

                      return (
                        <Fragment key={merchant.id}>
                          <tr className="hover:bg-surface-container-low transition-colors">
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                aria-expanded={expanded}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => setExpandedMerchantId((prev) => (prev === merchant.id ? null : merchant.id))}
                              >
                                <span className={`text-sm font-bold leading-none transition-transform ${expanded ? 'rotate-90' : ''}`}>
                                  {'>'}
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm text-on-surface font-semibold">{merchantDisplayName(merchant)}</td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">{merchant.cuit || '-'}</td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">{merchant.categoria || '-'}</td>
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
                            {canManageMerchants ? (
                              <td className="px-4 py-3">
                                {editable ? (
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      className="text-xs font-bold text-primary hover:underline"
                                      onClick={() => openEdit(merchant)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="text-xs font-bold text-slate-700 hover:underline"
                                      onClick={() => toggleMerchantStatus(merchant)}
                                    >
                                      {merchant.estado === 'RESTRICTED' ? 'Reactivar' : 'Baja'}
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                          {expanded ? (
                            <tr>
                              <td colSpan={canManageMerchants ? 7 : 6} className="px-4 pb-4">
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
              </div>
            </section>
          </>
        )}
      </div>

      <Modal open={showCreateModal} title="Crear razon social" onClose={() => setShowCreateModal(false)}>
        <form onSubmit={saveMerchant} className="space-y-4">
          {activeCategories.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              No hay categorias activas. Configuralas en Configuracion.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre *</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantNombre}
                onChange={(event) => setMerchantNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Razon social</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantRazonSocial}
                onChange={(event) => setMerchantRazonSocial(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">CUIT</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantCuit}
                onChange={(event) => setMerchantCuit(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Categoria *</label>
              <select
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantCategoriaId}
                onChange={(event) => setMerchantCategoriaId(event.target.value)}
                required
              >
                <option value="">Seleccionar categoria</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {enforceActorBrand && actorBrandId ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              Se vinculara automaticamente a tu retailer.
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Retailers vinculados (opcional)
              </label>
              <select
                multiple
                className="mt-1 h-32 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={selectedBrandIds}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setSelectedBrandIds(values);
                }}
              >
                {brandOptions.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              disabled={saving || activeCategories.length === 0}
            >
              {saving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditModal} title="Editar razon social" onClose={() => setShowEditModal(false)}>
        <form onSubmit={saveMerchant} className="space-y-4">
          {activeCategories.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              No hay categorias activas. Configuralas en Configuracion.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre *</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantNombre}
                onChange={(event) => setMerchantNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Razon social</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantRazonSocial}
                onChange={(event) => setMerchantRazonSocial(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">CUIT</label>
              <input
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantCuit}
                onChange={(event) => setMerchantCuit(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Categoria *</label>
              <select
                className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={merchantCategoriaId}
                onChange={(event) => setMerchantCategoriaId(event.target.value)}
                required
              >
                <option value="">Seleccionar categoria</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {enforceActorBrand && actorBrandId ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              Se mantiene vinculada a tu retailer.
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Retailers vinculados (opcional)
              </label>
              <select
                multiple
                className="mt-1 h-32 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                value={selectedBrandIds}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setSelectedBrandIds(values);
                }}
              >
                {brandOptions.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700"
              onClick={() => setShowEditModal(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
              disabled={saving || activeCategories.length === 0}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
