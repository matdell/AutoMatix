'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

type Bank = {
  id: string;
  nombre: string;
  slug: string;
  createdAt: string;
};

type BankBranch = {
  id: string;
  nombre: string;
  codigo?: string | null;
  localidad?: string | null;
  region?: string | null;
  tipo?: string | null;
  activo?: boolean;
};

type CreatedBank = {
  id: string;
  nombre: string;
  slug: string;
  admin?: { email?: string };
};

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ open, title, onClose, children }: ModalProps) {
  if (open === false) return null;
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

export default function SuperAdminBanksPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null);
  const [branchCache, setBranchCache] = useState<Record<string, BankBranch[]>>({});
  const [branchLoading, setBranchLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingBanks, setLoadingBanks] = useState(false);

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [showBankModal, setShowBankModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');

  const [bankNombre, setBankNombre] = useState('');
  const [bankSlug, setBankSlug] = useState('');
  const [bankPayments, setBankPayments] = useState('');
  const [bankBines, setBankBines] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [bankSaving, setBankSaving] = useState(false);

  const [branchNombre, setBranchNombre] = useState('');
  const [branchCodigo, setBranchCodigo] = useState('');
  const [branchLocalidad, setBranchLocalidad] = useState('');
  const [branchRegion, setBranchRegion] = useState('');
  const [branchTipo, setBranchTipo] = useState('');
  const [branchActivo, setBranchActivo] = useState(true);
  const [branchSaving, setBranchSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BankBranch | null>(null);

  const isSuperAdmin = role === 'SUPERADMIN';

  useEffect(() => {
    if (getToken() === null) {
      router.push('/login');
      return;
    }
    const raw = window.localStorage.getItem('user');
    if (raw === null) return;
    try {
      const parsed = JSON.parse(raw);
      setRole(parsed?.role ?? null);
    } catch {
      setRole(null);
    }
  }, [router]);

  const parseList = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const loadBanks = async () => {
    setLoadingBanks(true);
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
    } finally {
      setLoadingBanks(false);
    }
  };

  const loadBranches = async (bankId: string) => {
    if (bankId === '') return;
    setBranchLoading((prev) => ({ ...prev, [bankId]: true }));
    try {
      const data = await apiJson<BankBranch[]>(`/bank-branches?bankId=${bankId}`);
      setBranchCache((prev) => ({ ...prev, [bankId]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales');
    } finally {
      setBranchLoading((prev) => ({ ...prev, [bankId]: false }));
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadBanks();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedBankId === '') return;
    window.localStorage.setItem('superadmin-bank-id', selectedBankId);
  }, [selectedBankId]);

  useEffect(() => {
    if (page > 1 && (page - 1) * pageSize >= banks.length) {
      setPage(1);
    }
  }, [banks.length, page, pageSize]);

  const onCreateBank = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setBankSaving(true);
    try {
      const payload = {
        nombre: bankNombre.trim(),
        slug: bankSlug.trim(),
        paymentMethods: parseList(bankPayments),
        bines: parseList(bankBines),
        adminNombre: adminNombre.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
      };
      const created = await apiJson<CreatedBank>('/banks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(`Banco creado: ${created.nombre} (${created.slug}). Admin: ${created.admin?.email || '-'}`);
      setBankNombre('');
      setBankSlug('');
      setBankPayments('');
      setBankBines('');
      setAdminNombre('');
      setAdminEmail('');
      setAdminPassword('');
      setShowBankModal(false);
      await loadBanks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el banco');
    } finally {
      setBankSaving(false);
    }
  };

  const onCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedBankId === '') {
      setError('Selecciona un banco antes de crear sucursales.');
      return;
    }
    setError(null);
    setSuccess(null);
    setBranchSaving(true);
    try {
      const payload = {
        nombre: branchNombre.trim(),
        codigo: branchCodigo.trim() || undefined,
        localidad: branchLocalidad.trim() || undefined,
        region: branchRegion.trim() || undefined,
        tipo: branchTipo.trim() || undefined,
      };
      await apiJson(`/bank-branches?bankId=${selectedBankId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('Sucursal creada correctamente.');
      setBranchNombre('');
      setBranchCodigo('');
      setBranchLocalidad('');
      setBranchRegion('');
      setBranchTipo('');
      setShowBranchModal(false);
      await loadBranches(selectedBankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la sucursal');
    } finally {
      setBranchSaving(false);
    }
  };

  const onUpdateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedBankId === '' || editingBranch === null) return;
    setError(null);
    setSuccess(null);
    setBranchSaving(true);
    try {
      const payload = {
        nombre: branchNombre.trim(),
        codigo: branchCodigo.trim() || undefined,
        localidad: branchLocalidad.trim() || undefined,
        region: branchRegion.trim() || undefined,
        tipo: branchTipo.trim() || undefined,
        activo: branchActivo,
      };
      await apiJson(`/bank-branches/${editingBranch.id}?bankId=${selectedBankId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSuccess('Sucursal actualizada.');
      setShowEditBranchModal(false);
      setEditingBranch(null);
      await loadBranches(selectedBankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la sucursal');
    } finally {
      setBranchSaving(false);
    }
  };

  const toggleExpand = (bankId: string) => {
    if (expandedBankId === bankId) {
      setExpandedBankId(null);
      return;
    }
    setExpandedBankId(bankId);
    if (!branchCache[bankId]) {
      loadBranches(bankId);
    }
  };

  const startEditBranch = (bankId: string, branch: BankBranch) => {
    setSelectedBankId(bankId);
    setEditingBranch(branch);
    setBranchNombre(branch.nombre || '');
    setBranchCodigo(branch.codigo || '');
    setBranchLocalidad(branch.localidad || '');
    setBranchRegion(branch.region || '');
    setBranchTipo(branch.tipo || '');
    setBranchActivo(branch.activo !== false);
    setShowEditBranchModal(true);
  };

  const paginatedBanks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return banks.slice(start, start + pageSize);
  }, [banks, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(banks.length / pageSize));

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
      }),
    [],
  );

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">SuperAdmin - Bancos</h1>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={() => setShowBankModal(true)}
          >
            Crear banco
          </button>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={() => setShowBranchModal(true)}
          >
            Crear sucursal
          </button>
        </div>
      </header>

      <div className="pt-24 px-8 pb-12 space-y-8">
        {isSuperAdmin === false ? (
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
                  <h2 className="text-lg font-semibold text-on-surface">Listado de bancos</h2>
                  <p className="text-sm text-on-surface-variant">Datos principales y sucursales desplegables.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Registros por pagina
                  </label>
                  <select
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    {[25, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest w-10">
                        &nbsp;
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Banco
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Slug
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Creado
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                        Sucursales
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingBanks ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={5}>
                          Cargando bancos...
                        </td>
                      </tr>
                    ) : null}
                    {loadingBanks === false && paginatedBanks.length === 0 ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={5}>
                          No hay bancos cargados.
                        </td>
                      </tr>
                    ) : null}
                    {paginatedBanks.map((bank) => {
                      const expanded = expandedBankId === bank.id;
                      const branches = branchCache[bank.id] || [];
                      const isLoadingBranches = branchLoading[bank.id];
                      const hasCachedBranches = Object.prototype.hasOwnProperty.call(branchCache, bank.id);
                      return (
                        <>
                          <tr key={bank.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                aria-expanded={expanded}
                                aria-label={expanded ? 'Ocultar sucursales' : 'Ver sucursales'}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() => {
                                  setSelectedBankId(bank.id);
                                  toggleExpand(bank.id);
                                }}
                              >
                                <span
                                  className={`material-symbols-outlined text-base transition-transform ${
                                    expanded ? 'rotate-90' : ''
                                  }`}
                                >
                                  chevron_right
                                </span>
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-on-surface font-semibold">{bank.nombre}</div>
                              <div className="text-xs text-on-surface-variant">{bank.id.slice(0, 8)}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">{bank.slug}</td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">
                              {dateFormatter.format(new Date(bank.createdAt))}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs font-semibold text-on-surface-variant">
                                {isLoadingBranches
                                  ? 'Cargando...'
                                  : hasCachedBranches
                                    ? `${branches.length} cargadas`
                                    : 'Sin cargar'}
                              </div>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr key={`${bank.id}-branches`}>
                              <td colSpan={5} className="px-6 pb-6">
                                <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-slate-900">Sucursales</h3>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold uppercase tracking-widest text-primary"
                                      onClick={() => {
                                        setSelectedBankId(bank.id);
                                        setShowBranchModal(true);
                                      }}
                                    >
                                      Nueva sucursal
                                    </button>
                                  </div>
                                  {isLoadingBranches ? (
                                    <div className="text-sm text-slate-500">Cargando sucursales...</div>
                                  ) : branches.length === 0 ? (
                                    <div className="text-sm text-slate-500">No hay sucursales cargadas.</div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse">
                                        <thead>
                                          <tr className="bg-white/60">
                                            <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                              Nombre
                                            </th>
                                            <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                              Localidad
                                            </th>
                                            <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                              Codigo
                                            </th>
                                            <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                              Estado
                                            </th>
                                            <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">
                                              Acciones
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/60">
                                          {branches.map((branch) => (
                                            <tr key={branch.id} className="hover:bg-white/60">
                                              <td className="px-4 py-3 text-sm text-slate-700">{branch.nombre}</td>
                                              <td className="px-4 py-3 text-sm text-slate-600">{branch.localidad || '-'}</td>
                                              <td className="px-4 py-3 text-sm text-slate-600">{branch.codigo || '-'}</td>
                                              <td className="px-4 py-3 text-sm text-slate-600">
                                                {branch.activo === false ? 'Inactiva' : 'Activa'}
                                              </td>
                                              <td className="px-4 py-3 text-right">
                                                <button
                                                  type="button"
                                                  className="text-xs font-bold text-primary hover:underline"
                                                  onClick={() => startEditBranch(bank.id, branch)}
                                                >
                                                  Editar
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-on-surface-variant">
                  Pagina {page} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <Modal open={showBankModal} title="Crear banco" onClose={() => setShowBankModal(false)}>
        <form onSubmit={onCreateBank} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bankNombre}
                onChange={(event) => setBankNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Slug</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bankSlug}
                onChange={(event) => setBankSlug(event.target.value)}
                placeholder="banco-andino"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Medios de pago</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bankPayments}
                onChange={(event) => setBankPayments(event.target.value)}
                placeholder="Visa, Mastercard"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">BINes</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bankBines}
                onChange={(event) => setBankBines(event.target.value)}
                placeholder="456789, 554433"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Admin nombre</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={adminNombre}
                onChange={(event) => setAdminNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Admin email</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Admin password</label>
            <input
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              required
            />
          </div>
          <button
            className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
            type="submit"
            disabled={bankSaving}
          >
            {bankSaving ? 'Creando...' : 'Crear banco'}
          </button>
        </form>
      </Modal>

      <Modal open={showBranchModal} title="Crear sucursal" onClose={() => setShowBranchModal(false)}>
        <form onSubmit={onCreateBranch} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Banco</label>
            <select
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              value={selectedBankId}
              onChange={(event) => setSelectedBankId(event.target.value)}
              required
            >
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.nombre} - {bank.slug}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchNombre}
                onChange={(event) => setBranchNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Codigo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchCodigo}
                onChange={(event) => setBranchCodigo(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Localidad</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchLocalidad}
                onChange={(event) => setBranchLocalidad(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Region</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchRegion}
                onChange={(event) => setBranchRegion(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo</label>
            <input
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              value={branchTipo}
              onChange={(event) => setBranchTipo(event.target.value)}
            />
          </div>
          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            type="submit"
            disabled={branchSaving}
          >
            {branchSaving ? 'Creando...' : 'Crear sucursal'}
          </button>
        </form>
      </Modal>

      <Modal open={showEditBranchModal} title="Editar sucursal" onClose={() => setShowEditBranchModal(false)}>
        <form onSubmit={onUpdateBranch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchNombre}
                onChange={(event) => setBranchNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Codigo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchCodigo}
                onChange={(event) => setBranchCodigo(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Localidad</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchLocalidad}
                onChange={(event) => setBranchLocalidad(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Region</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchRegion}
                onChange={(event) => setBranchRegion(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchTipo}
                onChange={(event) => setBranchTipo(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
              <select
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchActivo ? 'active' : 'inactive'}
                onChange={(event) => setBranchActivo(event.target.value === 'active')}
              >
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
              </select>
            </div>
          </div>
          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            type="submit"
            disabled={branchSaving}
          >
            {branchSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>
    </AppShell>
  );
}
