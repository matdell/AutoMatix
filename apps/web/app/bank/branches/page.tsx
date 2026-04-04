'use client';

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';

type BankBranch = {
  id: string;
  nombre: string;
  codigo?: string | null;
  localidad?: string | null;
  region?: string | null;
  tipo?: string | null;
  direccion?: string | null;
  activo?: boolean;
};

type BranchUser = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  isActive: boolean;
  bankBranchId?: string | null;
  brandId?: string | null;
  merchantId?: string | null;
  pointOfSaleId?: string | null;
};

type BulkStatus = 'keep' | 'active' | 'inactive';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

const roleLabels: Record<string, string> = {
  BANK_ADMIN: 'Admin Banco',
  BANK_OPS: 'Operaciones Banco',
  BANK_APPROVER: 'Aprobador Banco',
  BANK_BRANCH_MANAGER: 'Sucursal (Manager)',
  BANK_BRANCH_OPERATOR: 'Sucursal (Operador)',
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

export default function BankBranchesPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [branches, setBranches] = useState<BankBranch[]>([]);
  const [branchUsers, setBranchUsers] = useState<BranchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BankBranch | null>(null);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const [bulkActivo, setBulkActivo] = useState<BulkStatus>('keep');
  const [bulkLocalidad, setBulkLocalidad] = useState('');
  const [bulkRegion, setBulkRegion] = useState('');
  const [bulkTipo, setBulkTipo] = useState('');
  const [bulkDireccion, setBulkDireccion] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [region, setRegion] = useState('');
  const [tipo, setTipo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [activo, setActivo] = useState(true);

  const canView =
    role === 'SUPERADMIN' ||
    role === 'BANK_ADMIN' ||
    role === 'BANK_OPS' ||
    role === 'BANK_APPROVER' ||
    role === 'BANK_BRANCH_MANAGER' ||
    role === 'BANK_BRANCH_OPERATOR';
  const canManage = role === 'BANK_ADMIN' || role === 'SUPERADMIN';
  const columnCount = canManage ? 8 : 6;

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

  const toggleSelectBranch = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId],
    );
  };

  const clearSelection = () => {
    setSelectedBranchIds([]);
  };

  const loadBranches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<BankBranch[]>('/bank-branches');
      setBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales');
    } finally {
      setLoading(false);
    }
  };

  const loadBranchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await apiJson<BranchUser[]>('/users');
      setBranchUsers(
        data.filter(
          (item) =>
            Boolean(item.bankBranchId) && !item.brandId && !item.merchantId && !item.pointOfSaleId,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios de sucursal');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    void loadBranches();
    void loadBranchUsers();
  }, [canView]);

  useEffect(() => {
    if (page > 1 && (page - 1) * pageSize >= branches.length) {
      setPage(1);
    }
  }, [branches.length, page, pageSize]);

  useEffect(() => {
    const currentIds = new Set(branches.map((branch) => branch.id));
    setSelectedBranchIds((prev) => prev.filter((id) => currentIds.has(id)));
    setExpandedBranchId((prev) => (prev && currentIds.has(prev) ? prev : null));
  }, [branches]);

  const resetForm = () => {
    setNombre('');
    setCodigo('');
    setLocalidad('');
    setRegion('');
    setTipo('');
    setDireccion('');
    setActivo(true);
    setEditingBranch(null);
  };

  const paginatedBranches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return branches.slice(start, start + pageSize);
  }, [branches, page, pageSize]);

  const usersByBranch = useMemo(() => {
    const grouped: Record<string, BranchUser[]> = {};
    for (const user of branchUsers) {
      if (!user.bankBranchId) continue;
      if (!grouped[user.bankBranchId]) {
        grouped[user.bankBranchId] = [];
      }
      grouped[user.bankBranchId].push(user);
    }
    for (const branchId of Object.keys(grouped)) {
      grouped[branchId].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    return grouped;
  }, [branchUsers]);

  const totalPages = Math.max(1, Math.ceil(branches.length / pageSize));
  const branchIdsOnPage = useMemo(() => paginatedBranches.map((branch) => branch.id), [paginatedBranches]);
  const allOnPageSelected =
    branchIdsOnPage.length > 0 && branchIdsOnPage.every((id) => selectedBranchIds.includes(id));
  const someOnPageSelected = branchIdsOnPage.some((id) => selectedBranchIds.includes(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson('/bank-branches', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          codigo: codigo.trim() || undefined,
          localidad: localidad.trim() || undefined,
          region: region.trim() || undefined,
          tipo: tipo.trim() || undefined,
          direccion: direccion.trim() || undefined,
        }),
      });
      setSuccess('Sucursal creada.');
      setShowCreateModal(false);
      resetForm();
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la sucursal');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (branch: BankBranch) => {
    setEditingBranch(branch);
    setNombre(branch.nombre || '');
    setCodigo(branch.codigo || '');
    setLocalidad(branch.localidad || '');
    setRegion(branch.region || '');
    setTipo(branch.tipo || '');
    setDireccion(branch.direccion || '');
    setActivo(branch.activo !== false);
    setShowEditModal(true);
  };

  const onEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBranch) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/bank-branches/${editingBranch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          codigo: codigo.trim() || undefined,
          localidad: localidad.trim() || undefined,
          region: region.trim() || undefined,
          tipo: tipo.trim() || undefined,
          direccion: direccion.trim() || undefined,
          activo,
        }),
      });
      setSuccess('Sucursal actualizada.');
      setShowEditModal(false);
      resetForm();
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la sucursal');
    } finally {
      setSaving(false);
    }
  };

  const onBulkUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedBranchIds.length === 0) return;

    const payload: Record<string, unknown> = {};
    if (bulkActivo !== 'keep') {
      payload.activo = bulkActivo === 'active';
    }
    if (bulkLocalidad.trim() !== '') {
      payload.localidad = bulkLocalidad.trim();
    }
    if (bulkRegion.trim() !== '') {
      payload.region = bulkRegion.trim();
    }
    if (bulkTipo.trim() !== '') {
      payload.tipo = bulkTipo.trim();
    }
    if (bulkDireccion.trim() !== '') {
      payload.direccion = bulkDireccion.trim();
    }

    if (Object.keys(payload).length === 0) {
      setError('Completa al menos un campo para aplicar cambios masivos.');
      return;
    }

    setError(null);
    setSuccess(null);
    setBulkUpdating(true);
    try {
      for (const id of selectedBranchIds) {
        await apiJson(`/bank-branches/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      setSuccess(`Cambios aplicados en ${selectedBranchIds.length} sucursales.`);
      setShowBulkEditModal(false);
      setBulkActivo('keep');
      setBulkLocalidad('');
      setBulkRegion('');
      setBulkTipo('');
      setBulkDireccion('');
      clearSelection();
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron aplicar los cambios masivos');
    } finally {
      setBulkUpdating(false);
    }
  };

  const onDelete = async (branch: BankBranch) => {
    const confirmed = window.confirm(`Eliminar sucursal "${branch.nombre}"?`);
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/bank-branches/${branch.id}`, { method: 'DELETE' });
      setSelectedBranchIds((prev) => prev.filter((id) => id !== branch.id));
      if (expandedBranchId === branch.id) {
        setExpandedBranchId(null);
      }
      setSuccess('Sucursal eliminada.');
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la sucursal');
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Banco - Sucursales</h1>
        {canManage ? (
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            Nueva sucursal
          </button>
        ) : null}
      </header>

      <div className="pt-24 px-8 pb-12 space-y-6">
        {!canView ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            No tienes permisos para acceder a esta seccion.
          </div>
        ) : (
          <>
            {error ? <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div> : null}
            {success ? (
              <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{success}</div>
            ) : null}

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-on-surface-variant">Expande una sucursal para ver sus usuarios asignados.</div>
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

              {canManage && selectedBranchIds.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold">{selectedBranchIds.length}</span> sucursales seleccionadas
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
                      onClick={() => setShowBulkEditModal(true)}
                    >
                      Editar seleccion
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
                      onClick={clearSelection}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      {canManage ? (
                        <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant w-10">
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={allOnPageSelected}
                            onChange={() => {
                              if (allOnPageSelected) {
                                setSelectedBranchIds((prev) =>
                                  prev.filter((id) => !branchIdsOnPage.includes(id)),
                                );
                              } else {
                                setSelectedBranchIds((prev) => {
                                  const merged = new Set(prev);
                                  branchIdsOnPage.forEach((id) => merged.add(id));
                                  return Array.from(merged);
                                });
                              }
                            }}
                          />
                        </th>
                      ) : null}
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant w-10">
                        &nbsp;
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Nombre
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Codigo
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Localidad
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Direccion
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Estado
                      </th>
                      {canManage ? (
                        <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">
                          Acciones
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-on-surface-variant" colSpan={columnCount}>
                          Cargando sucursales...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && paginatedBranches.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-on-surface-variant" colSpan={columnCount}>
                          No hay sucursales cargadas.
                        </td>
                      </tr>
                    ) : null}
                    {paginatedBranches.map((branch) => {
                      const expanded = expandedBranchId === branch.id;
                      const assignedUsers = usersByBranch[branch.id] || [];
                      const isSelected = selectedBranchIds.includes(branch.id);
                      return (
                        <Fragment key={branch.id}>
                          <tr
                            className={`hover:bg-surface-container-low transition-colors ${
                              isSelected ? 'bg-surface-container-low/60' : ''
                            }`}
                          >
                            {canManage ? (
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={isSelected}
                                  onChange={() => toggleSelectBranch(branch.id)}
                                />
                              </td>
                            ) : null}
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                aria-expanded={expanded}
                                aria-label={expanded ? 'Ocultar usuarios asignados' : 'Ver usuarios asignados'}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                onClick={() =>
                                  setExpandedBranchId((prev) => (prev === branch.id ? null : branch.id))
                                }
                              >
                                <span className={`text-sm font-bold leading-none transition-transform ${expanded ? 'rotate-90' : ''}`}>
                                  {'>'}
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm text-on-surface font-semibold">
                              <div>{branch.nombre}</div>
                              <div className="text-xs font-normal text-on-surface-variant">
                                {assignedUsers.length} usuario{assignedUsers.length === 1 ? '' : 's'} asignado
                                {assignedUsers.length === 1 ? '' : 's'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">{branch.codigo || '-'}</td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">{branch.localidad || '-'}</td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">{branch.direccion || '-'}</td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">
                              {branch.activo === false ? 'Inactiva' : 'Activa'}
                            </td>
                            {canManage ? (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-3">
                                  <button
                                    type="button"
                                    className="text-xs font-bold text-primary hover:underline"
                                    onClick={() => startEdit(branch)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs font-bold text-rose-600 hover:underline"
                                    onClick={() => onDelete(branch)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                          {expanded ? (
                            <tr>
                              <td colSpan={columnCount} className="px-4 pb-4">
                                <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4">
                                  <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-900">Usuarios asignados</h3>
                                    <span className="text-xs text-slate-500">{assignedUsers.length} total</span>
                                  </div>
                                  {loadingUsers ? (
                                    <div className="text-sm text-slate-500">Cargando usuarios...</div>
                                  ) : assignedUsers.length === 0 ? (
                                    <div className="text-sm text-slate-500">No hay usuarios asignados a esta sucursal.</div>
                                  ) : (
                                    <div className="space-y-2">
                                      {assignedUsers.map((user) => (
                                        <div
                                          key={user.id}
                                          className="rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2"
                                        >
                                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                              <div className="text-sm font-semibold text-slate-800">{user.nombre}</div>
                                              <div className="text-xs text-slate-500">{user.email}</div>
                                            </div>
                                            <div className="text-xs text-slate-600">
                                              {roleLabels[user.role] || user.role}
                                              <span className="mx-1 text-slate-400">|</span>
                                              {user.isActive ? 'Activo' : 'Inactivo'}
                                            </div>
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

      <Modal open={showCreateModal} title="Crear sucursal" onClose={() => setShowCreateModal(false)}>
        <form onSubmit={onCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Codigo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Localidad</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={localidad}
                onChange={(event) => setLocalidad(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Region</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Direccion</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={direccion}
                onChange={(event) => setDireccion(event.target.value)}
              />
            </div>
          </div>
          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Creando...' : 'Crear sucursal'}
          </button>
        </form>
      </Modal>

      <Modal open={showEditModal} title="Editar sucursal" onClose={() => setShowEditModal(false)}>
        <form onSubmit={onEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Codigo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Localidad</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={localidad}
                onChange={(event) => setLocalidad(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Region</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Direccion</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={direccion}
                onChange={(event) => setDireccion(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
            <select
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              value={activo ? 'active' : 'inactive'}
              onChange={(event) => setActivo(event.target.value === 'active')}
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </select>
          </div>
          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>

      <Modal
        open={showBulkEditModal}
        title="Edicion masiva de sucursales"
        onClose={() => setShowBulkEditModal(false)}
      >
        <form onSubmit={onBulkUpdate} className="space-y-4">
          <p className="text-sm text-slate-600">
            Se aplicaran los cambios a {selectedBranchIds.length} sucursales seleccionadas.
          </p>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
            <select
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              value={bulkActivo}
              onChange={(event) => setBulkActivo(event.target.value as BulkStatus)}
            >
              <option value="keep">No modificar</option>
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Localidad
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bulkLocalidad}
                onChange={(event) => setBulkLocalidad(event.target.value)}
                placeholder="Dejar vacio para no cambiar"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Region</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bulkRegion}
                onChange={(event) => setBulkRegion(event.target.value)}
                placeholder="Dejar vacio para no cambiar"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bulkTipo}
                onChange={(event) => setBulkTipo(event.target.value)}
                placeholder="Dejar vacio para no cambiar"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Direccion
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bulkDireccion}
                onChange={(event) => setBulkDireccion(event.target.value)}
                placeholder="Dejar vacio para no cambiar"
              />
            </div>
          </div>

          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-50"
            type="submit"
            disabled={bulkUpdating}
          >
            {bulkUpdating ? 'Aplicando...' : 'Aplicar cambios'}
          </button>
        </form>
      </Modal>
    </AppShell>
  );
}
