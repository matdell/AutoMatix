'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';

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

export default function SuperAdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params?.id as string;

  const [role, setRole] = useState<string | null>(null);
  const [bankId, setBankId] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [userNombre, setUserNombre] = useState('');
  const [userEmail, setUserEmail] = useState('');
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

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  const brandOptions = useMemo(
    () => brands.map((brand) => ({ value: brand.id, label: brand.nombre })),
    [brands],
  );

  const merchantOptions = useMemo(
    () =>
      merchants.map((merchant) => ({
        value: merchant.id,
        label: merchant.cuit ? `${merchant.nombre} · ${merchant.cuit}` : merchant.nombre,
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
    const queryBankId = searchParams.get('bankId');
    const stored = window.localStorage.getItem('superadmin-bank-id');
    setBankId(queryBankId || stored || '');
  }, [searchParams]);

  const loadBranches = async (resolvedBankId: string) => {
    if (!resolvedBankId) return;
    try {
      const data = await apiJson<BankBranch[]>(`/bank-branches?bankId=${resolvedBankId}`);
      setBankBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales');
    }
  };

  const loadBrands = async (resolvedBankId: string) => {
    if (!resolvedBankId) return;
    try {
      const data = await apiJson<Brand[]>(`/brands?bankId=${resolvedBankId}`);
      setBrands(data);
    } catch {
      setBrands([]);
    }
  };

  const loadMerchants = async (resolvedBankId: string) => {
    if (!resolvedBankId) return;
    try {
      const data = await apiJson<Merchant[]>(`/merchants?bankId=${resolvedBankId}`);
      setMerchants(data);
    } catch {
      setMerchants([]);
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
    } catch {
      setPointsOfSale([]);
    }
  };

  const loadUser = async (resolvedBankId: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = resolvedBankId ? `/users/${userId}?bankId=${resolvedBankId}` : `/users/${userId}`;
      const data = await apiJson<User>(url);
      setUser(data);
      setUserNombre(data.nombre || '');
      setUserEmail(data.email || '');
      setUserRole(data.role || 'BANK_ADMIN');
      setUserBrandId(data.brandId || '');
      setUserMerchantId(data.merchantId || '');
      setUserBankBranchId(data.bankBranchId || '');
      setUserPointOfSaleId(data.pointOfSaleId || '');
      setUserActive(Boolean(data.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el usuario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!bankId) return;
    loadUser(bankId);
    loadBranches(bankId);
    loadBrands(bankId);
    loadMerchants(bankId);
  }, [isSuperAdmin, bankId]);

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

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        nombre: userNombre.trim(),
        email: userEmail.trim(),
        role: userRole,
        isActive: userActive,
      };
      if (needsBranch) {
        payload.bankBranchId = userBankBranchId || undefined;
      } else {
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
      await apiJson(`/users/${user.id}?bankId=${bankId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSuccess('Usuario actualizado.');
      await loadUser(bankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const deactivateUser = async () => {
    if (!user) return;
    const confirmed = window.confirm(`Desactivar a ${user.nombre}?`);
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/users/${user.id}?bankId=${bankId}`, { method: 'DELETE' });
      setSuccess('Usuario desactivado.');
      await loadUser(bankId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el usuario');
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <div className="flex items-center space-x-4">
          <button
            className="text-xs font-semibold uppercase tracking-widest text-slate-600"
            type="button"
            onClick={() => router.push('/superadmin/users')}
          >
            Volver
          </button>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">SuperAdmin - Usuario</h1>
        </div>
        {user?.isActive ? (
          <button
            className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-rose-500 hover:border-rose-300"
            type="button"
            onClick={deactivateUser}
          >
            Desactivar
          </button>
        ) : null}
      </header>

      <div className="pt-24 px-8 pb-12 space-y-8">
        {!isSuperAdmin ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            No tienes permisos para acceder a esta seccion.
          </div>
        ) : !bankId ? (
          <div className="text-sm text-on-surface-variant bg-surface-container-low rounded-xl px-4 py-3">
            Selecciona un banco desde la lista de usuarios para ver el detalle.
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
              {loading || !user ? (
                <div className="text-sm text-on-surface-variant">Cargando usuario...</div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold text-on-surface">{user.nombre}</h2>
                    <p className="text-sm text-on-surface-variant">
                      {user.bank?.nombre ?? 'Banco'} - {roleLabels[user.role] ?? user.role}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Ultimo acceso:{' '}
                      {user.lastLoginAt ? dateTimeFormatter.format(new Date(user.lastLoginAt)) : 'Sin registros'}
                    </p>
                  </div>

                  <form onSubmit={onSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                        <input
                          className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                          value={userNombre}
                          onChange={(event) => setUserNombre(event.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Email</label>
                        <input
                          className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                          type="email"
                          value={userEmail}
                          onChange={(event) => setUserEmail(event.target.value)}
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
                          {roleOptions.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleLabels[roleOption] ?? roleOption}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
                        <select
                          className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                          value={userActive ? 'active' : 'inactive'}
                          onChange={(event) => setUserActive(event.target.value === 'active')}
                        >
                          <option value="active">Activo</option>
                          <option value="inactive">Inactivo</option>
                        </select>
                      </div>
                      {needsBranch ? (
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                            Sucursal bancaria
                          </label>
                          <select
                            className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
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
                            className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
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
                            className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
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
                            className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
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
                    </div>

                    <div className="lg:col-span-2">
                      <button
                        className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                        type="submit"
                        disabled={saving}
                      >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
