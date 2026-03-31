'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiFetch, apiJson, getToken } from '@/lib/api';

type Bank = {
  id: string;
  nombre: string;
  slug: string;
};

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
  merchantId?: string | null;
  bankBranchId?: string | null;
  bank?: { id: string; nombre: string; slug: string } | null;
  bankBranch?: { id: string; nombre: string; codigo?: string | null; localidad?: string | null } | null;
  isActive: boolean;
  lastLoginAt?: string | null;
};

type ImportResult = {
  created: number;
  errors: { row: number; message: string }[];
};

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'SuperAdmin',
  BANK_ADMIN: 'Admin Banco',
  BANK_OPS: 'Operaciones Banco',
  BANK_APPROVER: 'Aprobador Banco',
  BANK_BRANCH_MANAGER: 'Sucursal (Manager)',
  BANK_BRANCH_OPERATOR: 'Sucursal (Operador)',
  MERCHANT_ADMIN: 'Admin Comercio',
  MERCHANT_USER: 'Usuario Comercio',
};

const roleOptions = [
  'SUPERADMIN',
  'BANK_ADMIN',
  'BANK_OPS',
  'BANK_APPROVER',
  'BANK_BRANCH_MANAGER',
  'BANK_BRANCH_OPERATOR',
  'MERCHANT_ADMIN',
  'MERCHANT_USER',
];

const branchRoles = new Set(['BANK_BRANCH_MANAGER', 'BANK_BRANCH_OPERATOR']);
const merchantRoles = new Set(['MERCHANT_ADMIN', 'MERCHANT_USER']);

const statusPill = (active: boolean) =>
  active
    ? 'bg-primary-container text-on-primary-container'
    : 'bg-surface-variant text-on-surface-variant';

export default function SuperAdminUsersPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userNombre, setUserNombre] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('BANK_ADMIN');
  const [userMerchantId, setUserMerchantId] = useState('');
  const [userBankBranchId, setUserBankBranchId] = useState('');
  const [userActive, setUserActive] = useState(true);

  const isSuperAdmin = role === 'SUPERADMIN';
  const needsBranch = branchRoles.has(userRole);
  const isMerchantRole = merchantRoles.has(userRole);

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: bank.id, label: `${bank.nombre} - ${bank.slug}` })),
    [banks],
  );

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

  const loadUsers = async (bankId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<User[]>(`/users?bankId=${bankId}`);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async (bankId: string) => {
    if (!bankId) return;
    try {
      const data = await apiJson<BankBranch[]>(`/bank-branches?bankId=${bankId}`);
      setBankBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales');
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadBanks();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || !selectedBankId) return;
    window.localStorage.setItem('superadmin-bank-id', selectedBankId);
    loadUsers(selectedBankId);
    loadBranches(selectedBankId);
  }, [isSuperAdmin, selectedBankId]);

  const resetForm = () => {
    setUserNombre('');
    setUserEmail('');
    setUserPassword('');
    setUserRole('BANK_ADMIN');
    setUserMerchantId('');
    setUserBankBranchId('');
    setUserActive(true);
    setEditingUser(null);
    setFormMode(null);
  };

  const startCreate = () => {
    setSuccess(null);
    setImportResult(null);
    setFormMode('create');
    setEditingUser(null);
    setUserNombre('');
    setUserEmail('');
    setUserPassword('');
    setUserRole('BANK_ADMIN');
    setUserMerchantId('');
    setUserBankBranchId('');
    setUserActive(true);
  };

  const startEdit = (user: User) => {
    setSuccess(null);
    setImportResult(null);
    setFormMode('edit');
    setEditingUser(user);
    setUserNombre(user.nombre || '');
    setUserEmail(user.email || '');
    setUserPassword('');
    setUserRole(user.role || 'BANK_ADMIN');
    setUserMerchantId(user.merchantId || '');
    setUserBankBranchId(user.bankBranchId || '');
    setUserActive(Boolean(user.isActive));
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBankId && userRole !== 'SUPERADMIN') {
      setError('Selecciona un banco antes de crear usuarios.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (formMode === 'create') {
        const payload: Record<string, unknown> = {
          nombre: userNombre.trim(),
          email: userEmail.trim(),
          password: userPassword,
          role: userRole,
        };
        if (userRole !== 'SUPERADMIN') {
          payload.tenantId = selectedBankId;
        }
        if (needsBranch) {
          payload.bankBranchId = userBankBranchId || undefined;
        }
        if (isMerchantRole && userMerchantId.trim()) {
          payload.merchantId = userMerchantId.trim();
        }
        await apiJson('/auth/registro', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Usuario creado correctamente.');
      } else if (formMode === 'edit' && editingUser) {
        const payload: Record<string, unknown> = {
          nombre: userNombre.trim(),
          email: userEmail.trim(),
          role: userRole,
          isActive: userActive,
        };
        if (needsBranch) {
          payload.bankBranchId = userBankBranchId || undefined;
        } else if (!needsBranch) {
          payload.bankBranchId = '';
        }
        if (isMerchantRole) {
          payload.merchantId = userMerchantId.trim() || undefined;
        }
        await apiJson(`/users/${editingUser.id}?bankId=${selectedBankId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccess('Usuario actualizado correctamente.');
      }
      resetForm();
      if (selectedBankId) {
        await loadUsers(selectedBankId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const deactivateUser = async (user: User) => {
    const confirmed = window.confirm(`Desactivar a ${user.nombre}?`);
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/users/${user.id}?bankId=${selectedBankId}`, { method: 'DELETE' });
      setSuccess('Usuario desactivado.');
      await loadUsers(selectedBankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el usuario');
    }
  };

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBankId) {
      setError('Selecciona un banco antes de subir el archivo.');
      return;
    }
    const form = event.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput?.files?.[0]) {
      setError('Selecciona un archivo CSV.');
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      const response = await apiFetch(`/users/import?bankId=${selectedBankId}`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
        throw new Error(message || 'No se pudo importar el CSV');
      }
      const result = (await response.json()) as ImportResult;
      setImportResult(result);
      setSuccess(`Importacion finalizada. Usuarios creados: ${result.created}.`);
      await loadUsers(selectedBankId);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar el CSV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">SuperAdmin - Usuarios</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={startCreate}
          >
            Nuevo usuario
          </button>
        </div>
      </header>

      <div className="pt-24 px-8 pb-12 space-y-8">
        {!isSuperAdmin ? (
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
            {importResult?.errors?.length ? (
              <div className="text-sm text-on-surface-variant bg-surface-container-low rounded-xl px-4 py-3">
                {importResult.errors.slice(0, 5).map((issue) => (
                  <div key={`${issue.row}-${issue.message}`}>
                    Fila {issue.row}: {issue.message}
                  </div>
                ))}
                {importResult.errors.length > 5 ? (
                  <div>Se omitieron {importResult.errors.length - 5} errores adicionales.</div>
                ) : null}
              </div>
            ) : null}

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">Usuarios del banco</h2>
                  <p className="text-sm text-on-surface-variant">
                    Administra usuarios, roles y accesos por entidad bancaria.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Banco activo
                  </label>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {formMode ? (
                  <form onSubmit={submitUser} className="bg-surface-container-low rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-on-surface">
                        {formMode === 'create' ? 'Crear usuario' : 'Editar usuario'}
                      </h3>
                      <button
                        className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                        type="button"
                        onClick={resetForm}
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                        <input
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          value={userNombre}
                          onChange={(event) => setUserNombre(event.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Email</label>
                        <input
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          type="email"
                          value={userEmail}
                          onChange={(event) => setUserEmail(event.target.value)}
                          required
                        />
                      </div>
                    </div>
                    {formMode === 'create' ? (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Password</label>
                        <input
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          type="password"
                          value={userPassword}
                          onChange={(event) => setUserPassword(event.target.value)}
                          required
                        />
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Rol</label>
                        <select
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          value={userRole}
                          onChange={(event) => setUserRole(event.target.value)}
                        >
                          {roleOptions.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleLabels[roleOption] ?? roleOption}
                            </option>
                          ))}
                        </select>
                      </div>
                      {formMode === 'edit' ? (
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
                          <select
                            className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                            value={userActive ? 'active' : 'inactive'}
                            onChange={(event) => setUserActive(event.target.value === 'active')}
                          >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                          </select>
                        </div>
                      ) : (
                        <div className="text-xs text-on-surface-variant flex items-end pb-2">
                          Estado inicial: activo
                        </div>
                      )}
                    </div>
                    {needsBranch ? (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Sucursal</label>
                        <select
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          value={userBankBranchId}
                          onChange={(event) => setUserBankBranchId(event.target.value)}
                          required
                        >
                          <option value="">Selecciona una sucursal</option>
                          {bankBranches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.nombre}
                              {branch.localidad ? ` - ${branch.localidad}` : ''}
                              {branch.codigo ? ` - ${branch.codigo}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {isMerchantRole ? (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Merchant ID</label>
                        <input
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          value={userMerchantId}
                          onChange={(event) => setUserMerchantId(event.target.value)}
                          placeholder="merchantId"
                        />
                      </div>
                    ) : null}
                    <button
                      className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? 'Guardando...' : formMode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
                    </button>
                  </form>
                ) : (
                  <div className="bg-surface-container-low rounded-2xl p-6 space-y-3">
                    <h3 className="text-base font-semibold text-on-surface">Acciones rapidas</h3>
                    <p className="text-sm text-on-surface-variant">
                      Crea usuarios o edita desde la tabla con un solo click.
                    </p>
                    <button
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
                      type="button"
                      onClick={startCreate}
                    >
                      Crear nuevo usuario
                    </button>
                  </div>
                )}

                <form onSubmit={handleImport} className="bg-surface-container-low rounded-2xl p-6 space-y-3">
                  <h3 className="text-base font-semibold text-on-surface">Subida masiva (CSV)</h3>
                  <p className="text-xs text-on-surface-variant">
                    Columnas requeridas: nombre, email, password, role. Opcionales: bankBranchId, merchantId.
                  </p>
                  <input className="w-full text-sm" type="file" accept=".csv" />
                  <button
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
                    type="submit"
                    disabled={uploading}
                  >
                    {uploading ? 'Subiendo...' : 'Importar usuarios'}
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Nombre
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Email
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Entidad
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Rol
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Sucursal
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-center">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Ultimo acceso
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={8}>
                          Cargando usuarios...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && users.length === 0 ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={8}>
                          No hay usuarios cargados para este banco.
                        </td>
                      </tr>
                    ) : null}
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-on-surface">{user.nombre}</div>
                          <div className="text-xs text-on-surface-variant">{user.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {user.bank?.nombre ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {roleLabels[user.role] ?? user.role}
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {user.bankBranch?.nombre ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${statusPill(
                              user.isActive,
                            )}`}
                          >
                            {user.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {user.lastLoginAt ? dateTimeFormatter.format(new Date(user.lastLoginAt)) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <a
                              className="text-xs font-bold text-primary hover:underline"
                              href={`/superadmin/users/${user.id}?bankId=${selectedBankId}`}
                            >
                              Ver
                            </a>
                            <button
                              className="text-xs font-bold text-primary hover:underline"
                              type="button"
                              onClick={() => startEdit(user)}
                            >
                              Editar
                            </button>
                            {user.isActive ? (
                              <button
                                className="text-xs font-bold text-rose-500 hover:underline"
                                type="button"
                                onClick={() => deactivateUser(user)}
                              >
                                Desactivar
                              </button>
                            ) : null}
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
    </AppShell>
  );
}
