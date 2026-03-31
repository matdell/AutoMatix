'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

type Bank = {
  id: string;
  nombre: string;
  slug: string;
};

type Merchant = {
  id: string;
  nombre: string;
  cuit?: string | null;
};

type BrandLegalEntity = {
  merchantId: string;
  merchant: Merchant;
};

type Brand = {
  id: string;
  nombre: string;
  activo: boolean;
  legalEntities?: BrandLegalEntity[];
  createdAt: string;
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

export default function SuperAdminBrandsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandNombre, setBrandNombre] = useState('');
  const [brandActivo, setBrandActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkBrand, setLinkBrand] = useState<Brand | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');

  const isSuperAdmin = role === 'SUPERADMIN';

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: bank.id, label: `${bank.nombre} - ${bank.slug}` })),
    [banks],
  );

  const merchantOptions = useMemo(
    () =>
      merchants.map((merchant) => ({
        value: merchant.id,
        label: merchant.cuit ? `${merchant.nombre} · ${merchant.cuit}` : merchant.nombre,
      })),
    [merchants],
  );

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

  const loadBanks = async () => {
    setError(null);
    try {
      const data = await apiJson<Bank[]>('/banks');
      setBanks(data);
      const stored = window.localStorage.getItem('superadmin-bank-id');
      const preferred = stored && data.some((bank) => bank.id === stored) ? stored : data[0]?.id;
      if (preferred) {
        setSelectedBankId(preferred);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los bancos');
    }
  };

  const loadBrands = async (bankId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<Brand[]>(`/brands?bankId=${bankId}`);
      setBrands(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las marcas');
    } finally {
      setLoading(false);
    }
  };

  const loadMerchants = async (bankId: string) => {
    try {
      const data = await apiJson<Merchant[]>(`/merchants?bankId=${bankId}`);
      setMerchants(data);
    } catch {
      setMerchants([]);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadBanks();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || !selectedBankId) return;
    window.localStorage.setItem('superadmin-bank-id', selectedBankId);
    loadBrands(selectedBankId);
    loadMerchants(selectedBankId);
  }, [isSuperAdmin, selectedBankId]);

  const openCreate = () => {
    setBrandNombre('');
    setBrandActivo(true);
    setShowCreateModal(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandNombre(brand.nombre);
    setBrandActivo(brand.activo);
    setShowEditModal(true);
  };

  const saveBrand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBankId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (showCreateModal) {
        await apiJson(`/brands?bankId=${selectedBankId}`, {
          method: 'POST',
          body: JSON.stringify({ nombre: brandNombre.trim(), activo: brandActivo }),
        });
        setSuccess('Marca creada correctamente.');
      } else if (showEditModal && editingBrand) {
        await apiJson(`/brands/${editingBrand.id}?bankId=${selectedBankId}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre: brandNombre.trim(), activo: brandActivo }),
        });
        setSuccess('Marca actualizada correctamente.');
      }
      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingBrand(null);
      await loadBrands(selectedBankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la marca');
    } finally {
      setSaving(false);
    }
  };

  const toggleBrand = async (brand: Brand) => {
    if (!selectedBankId) return;
    setError(null);
    try {
      await apiJson(`/brands/${brand.id}?bankId=${selectedBankId}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !brand.activo }),
      });
      await loadBrands(selectedBankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la marca');
    }
  };

  const deleteBrand = async (brand: Brand) => {
    if (!selectedBankId) return;
    const confirmed = window.confirm(`Eliminar la marca ${brand.nombre}?`);
    if (!confirmed) return;
    setError(null);
    try {
      await apiJson(`/brands/${brand.id}?bankId=${selectedBankId}`, { method: 'DELETE' });
      await loadBrands(selectedBankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la marca');
    }
  };

  const openLinkModal = (brand: Brand) => {
    setLinkBrand(brand);
    setSelectedMerchantId('');
    setShowLinkModal(true);
  };

  const linkLegalEntity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBankId || !linkBrand || !selectedMerchantId) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/brands/${linkBrand.id}/legal-entities?bankId=${selectedBankId}`, {
        method: 'POST',
        body: JSON.stringify({ merchantId: selectedMerchantId }),
      });
      await loadBrands(selectedBankId);
      setShowLinkModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular la razon social');
    } finally {
      setSaving(false);
    }
  };

  const unlinkLegalEntity = async (brand: Brand, merchantId: string) => {
    if (!selectedBankId) return;
    setError(null);
    try {
      await apiJson(`/brands/${brand.id}/legal-entities/${merchantId}?bankId=${selectedBankId}`, {
        method: 'DELETE',
      });
      await loadBrands(selectedBankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular la razon social');
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">SuperAdmin - Marcas</h1>
        <button
          className="primary-gradient text-white font-semibold px-4 py-2 rounded-xl shadow"
          type="button"
          onClick={openCreate}
        >
          Crear Marca
        </button>
      </header>

      <div className="pt-24 px-8 pb-12 space-y-8">
        {role !== 'SUPERADMIN' ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            No tienes permisos para acceder a esta seccion.
          </div>
        ) : (
          <>
            {error ? (
              <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div>
            ) : null}
            {success ? (
              <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{success}</div>
            ) : null}

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">Listado de marcas</h2>
                  <p className="text-sm text-on-surface-variant">
                    Gestiona marcas, razones sociales y puntos de venta vinculados.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Banco</label>
                  <select
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                    value={selectedBankId}
                    onChange={(event) => setSelectedBankId(event.target.value)}
                  >
                    {bankOptions.map((bank) => (
                      <option key={bank.value} value={bank.value}>
                        {bank.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Marca
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Razones sociales
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={4}>
                          Cargando marcas...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && brands.length === 0 ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={4}>
                          No hay marcas para este banco.
                        </td>
                      </tr>
                    ) : null}
                    {brands.map((brand) => (
                      <tr key={brand.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-on-surface flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBrandId((current) => (current === brand.id ? null : brand.id))
                              }
                              className="text-xs text-on-surface-variant"
                            >
                              {expandedBrandId === brand.id ? '▾' : '▸'}
                            </button>
                            {brand.nombre}
                          </div>
                          <div className="text-xs text-on-surface-variant">{brand.id.slice(0, 8)}</div>
                          {expandedBrandId === brand.id && brand.legalEntities?.length ? (
                            <div className="mt-3 space-y-2">
                              {brand.legalEntities.map((link) => (
                                <div key={link.merchantId} className="flex items-center justify-between text-xs">
                                  <span>
                                    {link.merchant.nombre}
                                    {link.merchant.cuit ? ` · ${link.merchant.cuit}` : ''}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-rose-500 font-semibold"
                                    onClick={() => unlinkLegalEntity(brand, link.merchantId)}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {brand.legalEntities?.length || 0}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                              brand.activo
                                ? 'bg-primary-container text-on-primary-container'
                                : 'bg-surface-variant text-on-surface-variant'
                            }`}
                          >
                            {brand.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              className="text-xs font-bold text-primary hover:underline"
                              type="button"
                              onClick={() => openLinkModal(brand)}
                            >
                              Vincular RS
                            </button>
                            <button
                              className="text-xs font-bold text-primary hover:underline"
                              type="button"
                              onClick={() => openEdit(brand)}
                            >
                              Editar
                            </button>
                            <button
                              className="text-xs font-bold text-primary hover:underline"
                              type="button"
                              onClick={() => toggleBrand(brand)}
                            >
                              {brand.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              className="text-xs font-bold text-rose-500 hover:underline"
                              type="button"
                              onClick={() => deleteBrand(brand)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <Modal
        open={showCreateModal || showEditModal}
        title={showCreateModal ? 'Crear marca' : 'Editar marca'}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setEditingBrand(null);
        }}
      >
        <form className="space-y-4" onSubmit={saveBrand}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
            <input
              className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
              value={brandNombre}
              onChange={(event) => setBrandNombre(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
            <select
              className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
              value={brandActivo ? 'active' : 'inactive'}
              onChange={(event) => setBrandActivo(event.target.value === 'active')}
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </select>
          </div>
          <button
            className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </Modal>

      <Modal
        open={showLinkModal}
        title="Vincular razon social"
        onClose={() => {
          setShowLinkModal(false);
          setLinkBrand(null);
        }}
      >
        <form className="space-y-4" onSubmit={linkLegalEntity}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Razon social</label>
            <select
              className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
              value={selectedMerchantId}
              onChange={(event) => setSelectedMerchantId(event.target.value)}
              required
            >
              <option value="">Selecciona una razon social</option>
              {merchantOptions.map((merchant) => (
                <option key={merchant.value} value={merchant.value}>
                  {merchant.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Vinculando...' : 'Vincular'}
          </button>
        </form>
      </Modal>
    </AppShell>
  );
}
