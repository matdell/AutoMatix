'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson, clearToken, getToken } from '@/lib/api';

type BankBranch = {
  id: string;
  nombre: string;
  codigo?: string | null;
  localidad?: string | null;
};

type User = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  bankBranchId?: string | null;
  brandId?: string | null;
  merchantId?: string | null;
  pointOfSaleId?: string | null;
  bankBranch?: { id: string; nombre: string; codigo?: string | null; localidad?: string | null } | null;
  isActive: boolean;
  lastLoginAt?: string | null;
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

const roleLabels: Record<string, string> = {
  BANK_ADMIN: 'Admin Banco',
  BANK_OPS: 'Operaciones Banco',
  BANK_APPROVER: 'Aprobador Banco',
  BANK_BRANCH_MANAGER: 'Sucursal (Manager)',
  BANK_BRANCH_OPERATOR: 'Sucursal (Operador)',
};

const roleOptions = [
  'BANK_ADMIN',
  'BANK_OPS',
  'BANK_APPROVER',
  'BANK_BRANCH_MANAGER',
  'BANK_BRANCH_OPERATOR',
];

const branchRoles = new Set(['BANK_BRANCH_MANAGER', 'BANK_BRANCH_OPERATOR']);
const bankViewerRoles = new Set([
  'SUPERADMIN',
  'BANK_ADMIN',
  'BANK_OPS',
  'BANK_APPROVER',
  'BANK_BRANCH_MANAGER',
  'BANK_BRANCH_OPERATOR',
]);
const branchManagerRoleOptions = ['BANK_BRANCH_MANAGER', 'BANK_BRANCH_OPERATOR'];

export default function BankUsersPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [actorBankBranchId, setActorBankBranchId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<BankBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState('BANK_OPS');
  const [bankBranchId, setBankBranchId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const canView = role ? bankViewerRoles.has(role) : false;
  const managesOnlyBranch = role === 'BANK_BRANCH_MANAGER';
  const canManage = role === 'BANK_ADMIN' || role === 'SUPERADMIN' || managesOnlyBranch;
  const availableRoleOptions = managesOnlyBranch ? branchManagerRoleOptions : roleOptions;
  const needsBranch = branchRoles.has(userRole);
  const columnCount = canManage ? 7 : 6;

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

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
      setActorBankBranchId(null);
      setRoleResolved(true);
      router.push('/login');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setRole(parsed?.role ?? null);
      setActorBankBranchId(parsed?.bankBranchId ?? null);
    } catch {
      clearToken();
      setRole(null);
      setActorBankBranchId(null);
      router.push('/login');
    }
    setRoleResolved(true);
  }, [router]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<User[]>('/users');
      setUsers(data.filter((item) => !item.brandId && !item.merchantId && !item.pointOfSaleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await apiJson<BankBranch[]>('/bank-branches');
      setBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales');
    }
  };

  useEffect(() => {
    if (!canView) return;
    void loadUsers();
    if (canManage) {
      void loadBranches();
    }
  }, [canView, canManage]);

  useEffect(() => {
    if (page > 1 && (page - 1) * pageSize >= users.length) {
      setPage(1);
    }
  }, [users.length, page, pageSize]);

  useEffect(() => {
    if (!managesOnlyBranch) {
      return;
    }
    if (!userRole || !branchRoles.has(userRole)) {
      setUserRole('BANK_BRANCH_OPERATOR');
    }
    if (actorBankBranchId) {
      setBankBranchId(actorBankBranchId);
    }
  }, [actorBankBranchId, managesOnlyBranch, userRole]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));

  const resetForm = () => {
    setNombre('');
    setEmail('');
    setPassword('');
    setUserRole(managesOnlyBranch ? 'BANK_BRANCH_OPERATOR' : 'BANK_OPS');
    setBankBranchId(managesOnlyBranch ? actorBankBranchId || '' : '');
    setIsActive(true);
    setEditingUser(null);
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resolvedBranchId = needsBranch
        ? managesOnlyBranch
          ? actorBankBranchId || undefined
          : bankBranchId || undefined
        : undefined;
      if (needsBranch && !resolvedBranchId) {
        throw new Error('Sucursal requerida para el rol seleccionado');
      }
      await apiJson('/auth/registro', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          password,
          role: userRole,
          bankBranchId: resolvedBranchId,
        }),
      });
      setSuccess('Usuario creado.');
      setShowCreateModal(false);
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (user: User) => {
    if (managesOnlyBranch && !branchRoles.has(user.role)) {
      setError('Solo puedes editar usuarios de sucursal.');
      return;
    }
    setEditingUser(user);
    setNombre(user.nombre || '');
    setEmail(user.email || '');
    setPassword('');
    setUserRole(user.role || (managesOnlyBranch ? 'BANK_BRANCH_OPERATOR' : 'BANK_OPS'));
    setBankBranchId(managesOnlyBranch ? actorBankBranchId || user.bankBranchId || '' : user.bankBranchId || '');
    setIsActive(Boolean(user.isActive));
    setShowEditModal(true);
  };

  const onEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resolvedBranchId = needsBranch
        ? managesOnlyBranch
          ? actorBankBranchId || undefined
          : bankBranchId || undefined
        : '';
      if (needsBranch && !resolvedBranchId) {
        throw new Error('Sucursal requerida para el rol seleccionado');
      }
      await apiJson(`/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          role: userRole,
          isActive,
          bankBranchId: resolvedBranchId,
        }),
      });
      setSuccess('Usuario actualizado.');
      setShowEditModal(false);
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const onDeactivate = async (user: User) => {
    const confirmed = window.confirm(`Desactivar usuario "${user.nombre}"?`);
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/users/${user.id}`, { method: 'DELETE' });
      setSuccess('Usuario desactivado.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el usuario');
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Banco - Usuarios</h1>
        {canManage ? (
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            Nuevo usuario
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

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <div className="flex items-center justify-end gap-3">
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

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Email</th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Rol</th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Sucursal</th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Ultimo acceso</th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
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
                          Cargando usuarios...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && paginatedUsers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-on-surface-variant" colSpan={columnCount}>
                          No hay usuarios cargados.
                        </td>
                      </tr>
                    ) : null}
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 text-sm text-on-surface font-semibold">{user.nombre}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{user.email}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{roleLabels[user.role] || user.role}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{user.bankBranch?.nombre || '-'}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">
                          {user.lastLoginAt ? dateTimeFormatter.format(new Date(user.lastLoginAt)) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{user.isActive ? 'Activo' : 'Inactivo'}</td>
                        {canManage ? (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                className="text-xs font-bold text-primary hover:underline"
                                onClick={() => startEdit(user)}
                              >
                                Editar
                              </button>
                              {user.isActive ? (
                                <button
                                  type="button"
                                  className="text-xs font-bold text-rose-600 hover:underline"
                                  onClick={() => onDeactivate(user)}
                                >
                                  Desactivar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
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

      <Modal open={showCreateModal} title="Crear usuario" onClose={() => setShowCreateModal(false)}>
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
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Email</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Password</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Rol</label>
              <select
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={userRole}
                onChange={(event) => setUserRole(event.target.value)}
              >
                {availableRoleOptions.map((option) => (
                  <option key={option} value={option}>
                    {roleLabels[option] || option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {needsBranch ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Sucursal</label>
              {managesOnlyBranch ? (
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm text-on-surface-variant"
                  value={branches.find((branch) => branch.id === (actorBankBranchId || bankBranchId))?.nombre || 'Sucursal asignada'}
                  readOnly
                />
              ) : (
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={bankBranchId}
                  onChange={(event) => setBankBranchId(event.target.value)}
                  required
                >
                  <option value="">Selecciona una sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.nombre}
                      {branch.localidad ? ` - ${branch.localidad}` : ''}
                      {branch.codigo ? ` - ${branch.codigo}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </Modal>

      <Modal open={showEditModal} title="Editar usuario" onClose={() => setShowEditModal(false)}>
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
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Email</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Rol</label>
              <select
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={userRole}
                onChange={(event) => setUserRole(event.target.value)}
              >
                {availableRoleOptions.map((option) => (
                  <option key={option} value={option}>
                    {roleLabels[option] || option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
              <select
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={isActive ? 'active' : 'inactive'}
                onChange={(event) => setIsActive(event.target.value === 'active')}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
          {needsBranch ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Sucursal</label>
              {managesOnlyBranch ? (
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm text-on-surface-variant"
                  value={branches.find((branch) => branch.id === (actorBankBranchId || bankBranchId))?.nombre || 'Sucursal asignada'}
                  readOnly
                />
              ) : (
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={bankBranchId}
                  onChange={(event) => setBankBranchId(event.target.value)}
                  required
                >
                  <option value="">Selecciona una sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.nombre}
                      {branch.localidad ? ` - ${branch.localidad}` : ''}
                      {branch.codigo ? ` - ${branch.codigo}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>
    </AppShell>
  );
}
