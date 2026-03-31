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

type Brand = {
  id: string;
  nombre: string;
  activo?: boolean;
};

type Merchant = {
  id: string;
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  brands?: { brand: { id: string; nombre: string } }[];
};

type PointOfSale = {
  id: string;
  nombre: string;
  direccion?: string | null;
  ciudad?: string | null;
};

type User = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  brandId?: string | null;
  merchantId?: string | null;
  bankBranchId?: string | null;
  pointOfSaleId?: string | null;
  bank?: { id: string; nombre: string; slug: string } | null;
  bankBranch?: { id: string; nombre: string; codigo?: string | null; localidad?: string | null } | null;
  brand?: { id: string; nombre: string } | null;
  merchant?: Merchant | null;
  pointOfSale?: PointOfSale | null;
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
  BRAND_ADMIN: 'Admin Marca',
  LEGAL_ENTITY_ADMIN: 'Admin Razon Social',
  POS_ADMIN: 'Admin PDV',
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
  'BRAND_ADMIN',
  'LEGAL_ENTITY_ADMIN',
  'POS_ADMIN',
  'MERCHANT_ADMIN',
  'MERCHANT_USER',
];

const branchRoles = new Set(['BANK_BRANCH_MANAGER', 'BANK_BRANCH_OPERATOR']);
const brandRoles = new Set(['BRAND_ADMIN']);
const legalEntityRoles = new Set(['LEGAL_ENTITY_ADMIN', 'MERCHANT_ADMIN', 'MERCHANT_USER']);
const pointOfSaleRoles = new Set(['POS_ADMIN']);

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
  const [brands, setBrands] = useState<Brand[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [userPageSize, setUserPageSize] = useState(25);
  const [userPage, setUserPage] = useState(1);
  const [userView, setUserView] = useState<'bank' | 'commercial'>('bank');
  const [userFilter, setUserFilter] = useState<'all' | 'bank' | 'bank-branch' | 'brand' | 'legal-entity' | 'pos'>('all');

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userNombre, setUserNombre] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('BANK_ADMIN');
  const [userBrandId, setUserBrandId] = useState('');
  const [userMerchantId, setUserMerchantId] = useState('');
  const [userBankBranchId, setUserBankBranchId] = useState('');
  const [userPointOfSaleId, setUserPointOfSaleId] = useState('');
  const [userActive, setUserActive] = useState(true);

  const isSuperAdmin = role === 'SUPERADMIN';
  const needsBranch = branchRoles.has(userRole);
  const isBrandRole = brandRoles.has(userRole);
  const isLegalEntityRole = legalEntityRoles.has(userRole);
  const isPointOfSaleRole = pointOfSaleRoles.has(userRole);

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: bank.id, label: `${bank.nombre} - ${bank.slug}` })),
    [banks],
  );

  const brandOptions = useMemo(
    () => brands.map((brand) => ({ value: brand.id, label: brand.nombre })),
    [brands],
  );

  const merchantOptions = useMemo(
    () =>
      merchants.map((merchant) => ({
        value: merchant.id,
        label: merchant.cuit
          ? `${merchant.razonSocial || merchant.nombre} · ${merchant.cuit}`
          : merchant.razonSocial || merchant.nombre,
      })),
    [merchants],
  );

  const pointOfSaleOptions = useMemo(
    () =>
      pointsOfSale.map((pos) => ({
        value: pos.id,
        label: pos.ciudad ? `${pos.nombre} · ${pos.ciudad}` : pos.nombre,
      })),
    [pointsOfSale],
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

  const loadBrands = async (bankId: string) => {
    if (!bankId) return;
    try {
      const data = await apiJson<Brand[]>(`/brands?bankId=${bankId}`);
      setBrands(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las marcas');
    }
  };

  const loadMerchants = async (bankId: string) => {
    if (!bankId) return;
    try {
      const data = await apiJson<Merchant[]>(`/merchants?bankId=${bankId}`);
      setMerchants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las razones sociales');
    }
  };

  const loadPointsOfSale = async (merchantId: string) => {
    if (!merchantId) {
      setPointsOfSale([]);
      return;
    }
    try {
      const data = await apiJson<PointOfSale[]>(`/merchants/${merchantId}/branches`);
      setPointsOfSale(data);
    } catch (err) {
      setPointsOfSale([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los puntos de venta');
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
    loadBrands(selectedBankId);
    loadMerchants(selectedBankId);
  }, [isSuperAdmin, selectedBankId]);

  useEffect(() => {
    if (!isPointOfSaleRole) {
      setPointsOfSale([]);
      setUserPointOfSaleId('');
      return;
    }
    if (userMerchantId) {
      loadPointsOfSale(userMerchantId);
    } else {
      setPointsOfSale([]);
      setUserPointOfSaleId('');
    }
  }, [isPointOfSaleRole, userMerchantId]);

  useEffect(() => {
    if (userPage > 1) {
      setUserPage(1);
    }
  }, [userFilter, userPageSize]);

  useEffect(() => {
    setUserFilter('all');
    setUserPage(1);
  }, [userView]);

  const filteredUsers = useMemo(() => {
    const isCommercial = userView === 'commercial';
    const base = isCommercial
      ? users.filter((user) => Boolean(user.brandId || user.merchantId || user.pointOfSaleId))
      : users.filter((user) => !user.brandId && !user.merchantId && !user.pointOfSaleId);

    switch (userFilter) {
      case 'bank':
        return base.filter((user) => !user.bankBranchId);
      case 'bank-branch':
        return base.filter((user) => Boolean(user.bankBranchId));
      case 'brand':
        return base.filter((user) => Boolean(user.brandId));
      case 'legal-entity':
        return base.filter((user) => Boolean(user.merchantId) && !user.pointOfSaleId);
      case 'pos':
        return base.filter((user) => Boolean(user.pointOfSaleId));
      default:
        return base;
    }
  }, [users, userFilter, userView]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));

  useEffect(() => {
    if (userPage > 1 && (userPage - 1) * userPageSize >= filteredUsers.length) {
      setUserPage(1);
    }
  }, [filteredUsers.length, userPage, userPageSize]);

  const resetForm = () => {
    setUserNombre('');
    setUserEmail('');
    setUserPassword('');
    setUserRole(userView === 'commercial' ? 'BRAND_ADMIN' : 'BANK_ADMIN');
    setUserBrandId('');
    setUserMerchantId('');
    setUserBankBranchId('');
    setUserPointOfSaleId('');
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
    setUserRole(userView === 'commercial' ? 'BRAND_ADMIN' : 'BANK_ADMIN');
    setUserBrandId('');
    setUserMerchantId('');
    setUserBankBranchId('');
    setUserPointOfSaleId('');
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
    setUserBrandId(user.brandId || '');
    setUserMerchantId(user.merchantId || '');
    setUserBankBranchId(user.bankBranchId || '');
    setUserPointOfSaleId(user.pointOfSaleId || '');
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
        if (isBrandRole && userBrandId.trim()) {
          payload.brandId = userBrandId.trim();
        }
        if (isLegalEntityRole && userMerchantId.trim()) {
          payload.merchantId = userMerchantId.trim();
        }
        if (isPointOfSaleRole) {
          if (userMerchantId.trim()) {
            payload.merchantId = userMerchantId.trim();
          }
          if (userPointOfSaleId.trim()) {
            payload.pointOfSaleId = userPointOfSaleId.trim();
          }
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
        if (isBrandRole) {
          payload.brandId = userBrandId.trim() || undefined;
        } else {
          payload.brandId = '';
        }
        if (isLegalEntityRole || isPointOfSaleRole) {
          payload.merchantId = userMerchantId.trim() || undefined;
        } else {
          payload.merchantId = '';
        }
        if (isPointOfSaleRole) {
          payload.pointOfSaleId = userPointOfSaleId.trim() || undefined;
        } else {
          payload.pointOfSaleId = '';
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
                  <h2 className="text-lg font-semibold text-on-surface">Usuarios</h2>
                  <p className="text-sm text-on-surface-variant">
                    Administra usuarios, roles y accesos por nivel.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        userView === 'bank'
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-low text-on-surface-variant'
                      }`}
                      onClick={() => setUserView('bank')}
                    >
                      Usuarios Bancos
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        userView === 'commercial'
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-low text-on-surface-variant'
                      }`}
                      onClick={() => setUserView('commercial')}
                    >
                      Usuarios Marcas
                    </button>
                  </div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Banco
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
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Nivel
                  </label>
                  <select
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                    value={userFilter}
                    onChange={(event) =>
                      setUserFilter(
                        event.target.value as 'all' | 'bank' | 'bank-branch' | 'brand' | 'legal-entity' | 'pos',
                      )
                    }
                  >
                    <option value="all">Todos</option>
                    {userView === 'bank' ? (
                      <>
                        <option value="bank">Banco</option>
                        <option value="bank-branch">Sucursal bancaria</option>
                      </>
                    ) : (
                      <>
                        <option value="brand">Marca</option>
                        <option value="legal-entity">Razon social</option>
                        <option value="pos">PDV</option>
                      </>
                    )}
                  </select>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Registros por pagina
                  </label>
                  <select
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                    value={userPageSize}
                    onChange={(event) => {
                      setUserPageSize(Number(event.target.value));
                      setUserPage(1);
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
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                          Sucursal bancaria
                        </label>
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
                    {isBrandRole ? (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Marca</label>
                        <select
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          value={userBrandId}
                          onChange={(event) => setUserBrandId(event.target.value)}
                          required
                        >
                          <option value="">Selecciona una marca</option>
                          {brandOptions.map((brand) => (
                            <option key={brand.value} value={brand.value}>
                              {brand.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {isLegalEntityRole || isPointOfSaleRole ? (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                          Razon social
                        </label>
                        <select
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          value={userMerchantId}
                          onChange={(event) => setUserMerchantId(event.target.value)}
                          required={isLegalEntityRole || isPointOfSaleRole}
                        >
                          <option value="">Selecciona una razon social</option>
                          {merchantOptions.map((merchant) => (
                            <option key={merchant.value} value={merchant.value}>
                              {merchant.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {isPointOfSaleRole ? (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                          Punto de venta
                        </label>
                        <select
                          className="mt-2 w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm"
                          value={userPointOfSaleId}
                          onChange={(event) => setUserPointOfSaleId(event.target.value)}
                          required
                          disabled={!userMerchantId}
                        >
                          <option value="">Selecciona un PDV</option>
                          {pointOfSaleOptions.map((pos) => (
                            <option key={pos.value} value={pos.value}>
                              {pos.label}
                            </option>
                          ))}
                        </select>
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
                    Columnas requeridas: nombre, email, password, role. Opcionales: bankBranchId, brandId,
                    merchantId, pointOfSaleId.
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
                    {userView === 'bank' ? (
                      <tr className="bg-surface-container-low/50">
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Nombre
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Email
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Banco
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Sucursal bancaria
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Rol
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
                    ) : (
                      <tr className="bg-surface-container-low/50">
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Nombre
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Email
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Marca
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Razon social
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          PDV
                        </th>
                        <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Rol
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
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={userView === 'bank' ? 8 : 9}>
                          Cargando usuarios...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && filteredUsers.length === 0 ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={userView === 'bank' ? 8 : 9}>
                          No hay usuarios para este filtro.
                        </td>
                      </tr>
                    ) : null}
                    {paginatedUsers.map((user) => {
                      const merchantBrand = user.merchant?.brands?.[0]?.brand?.nombre;
                      return (
                        <tr key={user.id} className="hover:bg-surface-container-low transition-colors group">
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-on-surface">{user.nombre}</div>
                            <div className="text-xs text-on-surface-variant">{user.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant">{user.email}</td>
                          {userView === 'bank' ? (
                            <>
                              <td className="px-6 py-4 text-sm text-on-surface-variant">
                                {user.bank?.nombre ?? '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-on-surface-variant">
                                {user.bankBranch?.nombre ?? '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-on-surface-variant">
                                {roleLabels[user.role] ?? user.role}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 py-4 text-sm text-on-surface-variant">
                                {user.brand?.nombre ?? merchantBrand ?? '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-on-surface-variant">
                                {user.merchant?.nombre ?? '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-on-surface-variant">
                                {user.pointOfSale?.nombre ?? '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-on-surface-variant">
                                {roleLabels[user.role] ?? user.role}
                              </td>
                            </>
                          )}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-on-surface-variant">
                  Pagina {userPage} de {totalUserPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    type="button"
                    onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                    disabled={userPage === 1}
                  >
                    Anterior
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    type="button"
                    onClick={() => setUserPage((prev) => Math.min(totalUserPages, prev + 1))}
                    disabled={userPage === totalUserPages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
