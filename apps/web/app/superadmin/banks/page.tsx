'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

type Bank = {
  id: string;
  nombre: string;
  nombreCompleto?: string | null;
  razonSocial?: string | null;
  cuit?: string | null;
  direccionCasaMatriz?: string | null;
  slug: string;
  activo?: boolean;
  paymentMethods?: string[];
  bines?: string[];
  fechaAlta?: string | null;
  createdAt: string;
};

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

type CreatedBank = {
  id: string;
  nombre: string;
  slug: string;
  admin?: { email?: string };
};

type ProvisioningTarget = 'VPS_MANAGED' | 'CUSTOMER_CLOUD' | 'ON_PREM';
type ProvisioningStatus = 'REQUESTED' | 'RUNNING' | 'READY' | 'FAILED' | 'CANCELLED';

type BankProvisioningRequest = {
  id: string;
  bankId: string;
  target: ProvisioningTarget;
  status: ProvisioningStatus;
  provider?: string | null;
  domain?: string | null;
  apiDomain?: string | null;
  region?: string | null;
  config?: Record<string, unknown> | null;
  notes?: string | null;
  errorMessage?: string | null;
  hasCredentials: boolean;
  processedAt?: string | null;
  createdAt: string;
};

type BulkStatus = 'keep' | 'active' | 'inactive';

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
  const [bankStatusFilter, setBankStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showBankModal, setShowBankModal] = useState(false);
  const [showEditBankModal, setShowEditBankModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');

  const [bankNombre, setBankNombre] = useState('');
  const [bankSlug, setBankSlug] = useState('');
  const [bankNombreCompleto, setBankNombreCompleto] = useState('');
  const [bankRazonSocial, setBankRazonSocial] = useState('');
  const [bankCuit, setBankCuit] = useState('');
  const [bankDireccionCasaMatriz, setBankDireccionCasaMatriz] = useState('');
  const [bankFechaAlta, setBankFechaAlta] = useState('');
  const [bankPayments, setBankPayments] = useState('');
  const [bankBines, setBankBines] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [bankSaving, setBankSaving] = useState(false);
  const [bankUpdating, setBankUpdating] = useState(false);
  const [bankDeletingId, setBankDeletingId] = useState<string | null>(null);
  const [bankTogglingId, setBankTogglingId] = useState<string | null>(null);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editNombreCompleto, setEditNombreCompleto] = useState('');
  const [editRazonSocial, setEditRazonSocial] = useState('');
  const [editCuit, setEditCuit] = useState('');
  const [editDireccionCasaMatriz, setEditDireccionCasaMatriz] = useState('');
  const [editFechaAlta, setEditFechaAlta] = useState('');
  const [editPayments, setEditPayments] = useState('');
  const [editBines, setEditBines] = useState('');
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkPayments, setBulkPayments] = useState('');
  const [bulkBines, setBulkBines] = useState('');
  const [bulkActivo, setBulkActivo] = useState<BulkStatus>('keep');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const [branchNombre, setBranchNombre] = useState('');
  const [branchCodigo, setBranchCodigo] = useState('');
  const [branchLocalidad, setBranchLocalidad] = useState('');
  const [branchRegion, setBranchRegion] = useState('');
  const [branchTipo, setBranchTipo] = useState('');
  const [branchDireccion, setBranchDireccion] = useState('');
  const [branchActivo, setBranchActivo] = useState(true);
  const [branchSaving, setBranchSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BankBranch | null>(null);

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisioningBank, setProvisioningBank] = useState<Bank | null>(null);
  const [provisioningRequests, setProvisioningRequests] = useState<BankProvisioningRequest[]>([]);
  const [provisioningLoading, setProvisioningLoading] = useState(false);
  const [provisioningSaving, setProvisioningSaving] = useState(false);
  const [provisioningTarget, setProvisioningTarget] = useState<ProvisioningTarget>('VPS_MANAGED');
  const [provisioningDomain, setProvisioningDomain] = useState('');
  const [provisioningApiDomain, setProvisioningApiDomain] = useState('');
  const [provisioningProvider, setProvisioningProvider] = useState('AWS');
  const [provisioningRegion, setProvisioningRegion] = useState('');
  const [vpsHost, setVpsHost] = useState('');
  const [vpsSshUser, setVpsSshUser] = useState('');
  const [vpsSshPort, setVpsSshPort] = useState('22');
  const [vpsSshPrivateKey, setVpsSshPrivateKey] = useState('');
  const [cloudRoleArn, setCloudRoleArn] = useState('');
  const [cloudAccessKeyId, setCloudAccessKeyId] = useState('');
  const [cloudSecretAccessKey, setCloudSecretAccessKey] = useState('');
  const [onPremEndpoint, setOnPremEndpoint] = useState('');
  const [onPremContactEmail, setOnPremContactEmail] = useState('');
  const [provisioningNotes, setProvisioningNotes] = useState('');

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

  const formatDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

  const toggleSelectBank = (bankId: string) => {
    setSelectedBankIds((prev) =>
      prev.includes(bankId) ? prev.filter((id) => id !== bankId) : [...prev, bankId],
    );
  };

  const clearSelection = () => {
    setSelectedBankIds([]);
  };

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

  const loadProvisioningRequests = async (bankId: string) => {
    setProvisioningLoading(true);
    try {
      const data = await apiJson<BankProvisioningRequest[]>(
        `/banks/${bankId}/provisioning-requests`,
      );
      setProvisioningRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial de provisionamiento');
      setProvisioningRequests([]);
    } finally {
      setProvisioningLoading(false);
    }
  };

  const rerunProvisioningRequest = async (requestId: string) => {
    if (!provisioningBank) return;
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/banks/${provisioningBank.id}/provisioning-requests/${requestId}/run`, {
        method: 'POST',
      });
      setSuccess('Provisionamiento relanzado.');
      await loadProvisioningRequests(provisioningBank.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo relanzar el provisionamiento');
    }
  };

  const openProvisionModal = async (bank: Bank) => {
    setProvisioningBank(bank);
    setProvisioningTarget('VPS_MANAGED');
    setProvisioningDomain(`${bank.slug}.automatixpay.com`);
    setProvisioningApiDomain(`${bank.slug}.automatixpay.com`);
    setProvisioningProvider('AWS');
    setProvisioningRegion('');
    setVpsHost('');
    setVpsSshUser('');
    setVpsSshPort('22');
    setVpsSshPrivateKey('');
    setCloudRoleArn('');
    setCloudAccessKeyId('');
    setCloudSecretAccessKey('');
    setOnPremEndpoint('');
    setOnPremContactEmail('');
    setProvisioningNotes('');
    setShowProvisionModal(true);
    await loadProvisioningRequests(bank.id);
  };

  const provisionStatusClass = (status: ProvisioningStatus) => {
    if (status === 'READY') return 'bg-emerald-50 text-emerald-700';
    if (status === 'FAILED' || status === 'CANCELLED') return 'bg-rose-50 text-rose-700';
    if (status === 'RUNNING') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadBanks();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!showProvisionModal || !provisioningBank) return;
    const timer = window.setInterval(() => {
      void loadProvisioningRequests(provisioningBank.id);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [showProvisionModal, provisioningBank]);

  useEffect(() => {
    if (selectedBankId === '') return;
    window.localStorage.setItem('superadmin-bank-id', selectedBankId);
  }, [selectedBankId]);

  useEffect(() => {
    setPage(1);
  }, [bankStatusFilter, pageSize]);

  useEffect(() => {
    setSelectedBankIds((prev) => prev.filter((id) => banks.some((bank) => bank.id === id)));
  }, [banks]);

  const onCreateBank = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setBankSaving(true);
    try {
      const payload = {
        nombre: bankNombre.trim(),
        slug: bankSlug.trim(),
        nombreCompleto: bankNombreCompleto.trim() || undefined,
        razonSocial: bankRazonSocial.trim() || undefined,
        cuit: bankCuit.trim() || undefined,
        direccionCasaMatriz: bankDireccionCasaMatriz.trim() || undefined,
        fechaAlta: bankFechaAlta || undefined,
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
      setBankNombreCompleto('');
      setBankRazonSocial('');
      setBankCuit('');
      setBankDireccionCasaMatriz('');
      setBankFechaAlta('');
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

  const startEditBank = (bank: Bank) => {
    setEditingBank(bank);
    setEditNombre(bank.nombre || '');
    setEditSlug(bank.slug || '');
    setEditNombreCompleto(bank.nombreCompleto ?? '');
    setEditRazonSocial(bank.razonSocial ?? '');
    setEditCuit(bank.cuit ?? '');
    setEditDireccionCasaMatriz(bank.direccionCasaMatriz ?? '');
    setEditFechaAlta(formatDateInput(bank.fechaAlta));
    setEditPayments((bank.paymentMethods ?? []).join(', '));
    setEditBines((bank.bines ?? []).join(', '));
    setShowEditBankModal(true);
  };

  const onUpdateBank = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBank) return;
    setError(null);
    setSuccess(null);
    setBankUpdating(true);
    try {
      const payload = {
        nombre: editNombre.trim(),
        slug: editSlug.trim(),
        nombreCompleto: editNombreCompleto.trim() || undefined,
        razonSocial: editRazonSocial.trim() || undefined,
        cuit: editCuit.trim() || undefined,
        direccionCasaMatriz: editDireccionCasaMatriz.trim() || undefined,
        fechaAlta: editFechaAlta || undefined,
        paymentMethods: parseList(editPayments),
        bines: parseList(editBines),
      };
      await apiJson(`/banks/${editingBank.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSuccess('Banco actualizado correctamente.');
      setShowEditBankModal(false);
      setEditingBank(null);
      await loadBanks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el banco');
    } finally {
      setBankUpdating(false);
    }
  };

  const toggleBankStatus = async (bank: Bank) => {
    const isActive = bank.activo !== false;
    const confirmText = isActive
      ? 'Vas a desactivar este banco. ¿Querés continuar?'
      : 'Vas a reactivar este banco. ¿Querés continuar?';
    if (!window.confirm(confirmText)) return;
    setError(null);
    setSuccess(null);
    setBankTogglingId(bank.id);
    try {
      await apiJson(`/banks/${bank.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !isActive }),
      });
      setSuccess(isActive ? 'Banco desactivado.' : 'Banco reactivado.');
      await loadBanks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del banco');
    } finally {
      setBankTogglingId(null);
    }
  };

  const deleteBank = async (bank: Bank) => {
    if (!window.confirm(`Eliminar ${bank.nombre}? Esta accion no se puede deshacer.`)) return;
    setError(null);
    setSuccess(null);
    setBankDeletingId(bank.id);
    try {
      await apiJson(`/banks/${bank.id}`, { method: 'DELETE' });
      setSuccess('Banco eliminado correctamente.');
      await loadBanks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el banco');
    } finally {
      setBankDeletingId(null);
    }
  };

  const onBulkUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedBankIds.length === 0) return;
    const payload: Record<string, unknown> = {};
    if (bulkActivo !== 'keep') {
      payload.activo = bulkActivo === 'active';
    }
    if (bulkPayments.trim() !== '') {
      payload.paymentMethods = parseList(bulkPayments);
    }
    if (bulkBines.trim() !== '') {
      payload.bines = parseList(bulkBines);
    }
    if (Object.keys(payload).length === 0) {
      setError('Completa al menos un campo para aplicar cambios masivos.');
      return;
    }
    setError(null);
    setSuccess(null);
    setBulkUpdating(true);
    try {
      for (const id of selectedBankIds) {
        await apiJson(`/banks/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      setSuccess(`Cambios aplicados en ${selectedBankIds.length} bancos.`);
      setShowBulkEditModal(false);
      setBulkPayments('');
      setBulkBines('');
      setBulkActivo('keep');
      clearSelection();
      await loadBanks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron aplicar los cambios masivos');
    } finally {
      setBulkUpdating(false);
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
        direccion: branchDireccion.trim() || undefined,
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
      setBranchDireccion('');
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
        direccion: branchDireccion.trim() || undefined,
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

  const onCreateProvisioningRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!provisioningBank) return;

    const config: Record<string, unknown> = {};
    const credentials: Record<string, unknown> = {};

    if (provisioningTarget === 'VPS_MANAGED') {
      config.host = vpsHost.trim();
      config.sshPort = Number(vpsSshPort || '22');
      credentials.sshUser = vpsSshUser.trim();
      if (vpsSshPrivateKey.trim()) {
        credentials.sshPrivateKey = vpsSshPrivateKey.trim();
      }
    }

    if (provisioningTarget === 'CUSTOMER_CLOUD') {
      if (cloudRoleArn.trim()) {
        credentials.roleArn = cloudRoleArn.trim();
      }
      if (cloudAccessKeyId.trim()) {
        credentials.accessKeyId = cloudAccessKeyId.trim();
      }
      if (cloudSecretAccessKey.trim()) {
        credentials.secretAccessKey = cloudSecretAccessKey.trim();
      }
    }

    if (provisioningTarget === 'ON_PREM') {
      config.endpoint = onPremEndpoint.trim();
      if (onPremContactEmail.trim()) {
        config.contactEmail = onPremContactEmail.trim();
      }
    }

    const payload = {
      target: provisioningTarget,
      domain: provisioningDomain.trim(),
      apiDomain: provisioningApiDomain.trim(),
      provider: provisioningTarget === 'CUSTOMER_CLOUD' ? provisioningProvider.trim() : undefined,
      region: provisioningRegion.trim() || undefined,
      config,
      credentials,
      notes: provisioningNotes.trim() || undefined,
    };

    setProvisioningSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/banks/${provisioningBank.id}/provisioning-requests`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('Solicitud creada. El provisionamiento se ejecuta automaticamente (estado RUNNING/READY).');
      await loadProvisioningRequests(provisioningBank.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la solicitud de provisionamiento');
    } finally {
      setProvisioningSaving(false);
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
    setBranchDireccion(branch.direccion || '');
    setBranchActivo(branch.activo !== false);
    setShowEditBranchModal(true);
  };

  const filteredBanks = useMemo(() => {
    if (bankStatusFilter === 'active') {
      return banks.filter((bank) => bank.activo !== false);
    }
    if (bankStatusFilter === 'inactive') {
      return banks.filter((bank) => bank.activo === false);
    }
    return banks;
  }, [banks, bankStatusFilter]);

  const paginatedBanks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBanks.slice(start, start + pageSize);
  }, [filteredBanks, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredBanks.length / pageSize));

  useEffect(() => {
    if (page > 1 && (page - 1) * pageSize >= filteredBanks.length) {
      setPage(1);
    }
  }, [filteredBanks.length, page, pageSize]);

  const bankIdsOnPage = useMemo(() => paginatedBanks.map((bank) => bank.id), [paginatedBanks]);
  const allOnPageSelected =
    bankIdsOnPage.length > 0 && bankIdsOnPage.every((id) => selectedBankIds.includes(id));
  const someOnPageSelected = bankIdsOnPage.some((id) => selectedBankIds.includes(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
      }),
    [],
  );

  const formatDisplayDate = (value?: string | null) =>
    value ? dateFormatter.format(new Date(value)) : '-';

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
                    Estado
                  </label>
                  <select
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2 text-sm"
                    value={bankStatusFilter}
                    onChange={(event) => setBankStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                  >
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                  </select>
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

              {selectedBankIds.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold">{selectedBankIds.length}</span> bancos seleccionados
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
                      <th className="px-4 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest w-10">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={allOnPageSelected}
                          onChange={() => {
                            if (allOnPageSelected) {
                              setSelectedBankIds((prev) => prev.filter((id) => !bankIdsOnPage.includes(id)));
                            } else {
                              setSelectedBankIds((prev) => {
                                const merged = new Set(prev);
                                bankIdsOnPage.forEach((id) => merged.add(id));
                                return Array.from(merged);
                              });
                            }
                          }}
                        />
                      </th>
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
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Fecha alta
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                        Sucursales
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingBanks ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={9}>
                          Cargando bancos...
                        </td>
                      </tr>
                    ) : null}
                    {loadingBanks === false && paginatedBanks.length === 0 ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={9}>
                          No hay bancos para este filtro.
                        </td>
                      </tr>
                    ) : null}
                    {paginatedBanks.map((bank) => {
                      const expanded = expandedBankId === bank.id;
                      const branches = branchCache[bank.id] || [];
                      const isLoadingBranches = branchLoading[bank.id];
                      const hasCachedBranches = Object.prototype.hasOwnProperty.call(branchCache, bank.id);
                      const isActive = bank.activo !== false;
                      const isSelected = selectedBankIds.includes(bank.id);
                      return (
                        <>
                          <tr
                            key={bank.id}
                            className={`hover:bg-surface-container-low transition-colors ${
                              isSelected ? 'bg-surface-container-low/60' : ''
                            }`}
                          >
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={isSelected}
                                onChange={() => toggleSelectBank(bank.id)}
                              />
                            </td>
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
                              {bank.nombreCompleto ? (
                                <div className="text-xs text-on-surface-variant">{bank.nombreCompleto}</div>
                              ) : null}
                              {bank.razonSocial || bank.cuit ? (
                                <div className="text-xs text-on-surface-variant">
                                  {bank.razonSocial ? `RS ${bank.razonSocial}` : null}
                                  {bank.razonSocial && bank.cuit ? ' • ' : null}
                                  {bank.cuit ? `CUIT ${bank.cuit}` : null}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">{bank.slug}</td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">
                              {dateFormatter.format(new Date(bank.createdAt))}
                            </td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">
                              {formatDisplayDate(bank.fechaAlta)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                  isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                                }`}
                              >
                                {isActive ? 'Activa' : 'Inactiva'}
                              </span>
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
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  className="text-xs font-bold text-slate-700 hover:underline"
                                  onClick={() => openProvisionModal(bank)}
                                >
                                  Provisionar
                                </button>
                                <button
                                  type="button"
                                  className="text-xs font-bold text-primary hover:underline"
                                  onClick={() => startEditBank(bank)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="text-xs font-bold text-amber-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => toggleBankStatus(bank)}
                                  disabled={bankTogglingId === bank.id}
                                >
                                  {isActive ? 'Desactivar' : 'Activar'}
                                </button>
                                <button
                                  type="button"
                                  className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => deleteBank(bank)}
                                  disabled={bankDeletingId === bank.id}
                                >
                                  {bankDeletingId === bank.id ? 'Eliminando...' : 'Eliminar'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr key={`${bank.id}-branches`}>
                              <td colSpan={9} className="px-6 pb-6">
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
                                              Direccion
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
                                              <td className="px-4 py-3 text-sm text-slate-600">{branch.direccion || '-'}</td>
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
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Nombre completo
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bankNombreCompleto}
                onChange={(event) => setBankNombreCompleto(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Razon social
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bankRazonSocial}
                onChange={(event) => setBankRazonSocial(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">CUIT</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bankCuit}
                onChange={(event) => setBankCuit(event.target.value)}
                placeholder="30-12345678-9"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Fecha de alta
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="date"
                value={bankFechaAlta}
                onChange={(event) => setBankFechaAlta(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Direccion casa matriz
            </label>
            <input
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              value={bankDireccionCasaMatriz}
              onChange={(event) => setBankDireccionCasaMatriz(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Tarjetas activas
              </label>
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

      <Modal
        open={showEditBankModal}
        title="Editar banco"
        onClose={() => {
          setShowEditBankModal(false);
          setEditingBank(null);
        }}
      >
        <form onSubmit={onUpdateBank} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={editNombre}
                onChange={(event) => setEditNombre(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Slug</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={editSlug}
                onChange={(event) => setEditSlug(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Nombre completo
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={editNombreCompleto}
                onChange={(event) => setEditNombreCompleto(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Razon social
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={editRazonSocial}
                onChange={(event) => setEditRazonSocial(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">CUIT</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={editCuit}
                onChange={(event) => setEditCuit(event.target.value)}
                placeholder="30-12345678-9"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Fecha de alta
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="date"
                value={editFechaAlta}
                onChange={(event) => setEditFechaAlta(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Direccion casa matriz
            </label>
            <input
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              value={editDireccionCasaMatriz}
              onChange={(event) => setEditDireccionCasaMatriz(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Tarjetas activas
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={editPayments}
                onChange={(event) => setEditPayments(event.target.value)}
                placeholder="Visa, Mastercard"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">BINes</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={editBines}
                onChange={(event) => setEditBines(event.target.value)}
                placeholder="456789, 554433"
              />
            </div>
          </div>
          <button
            className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
            type="submit"
            disabled={bankUpdating}
          >
            {bankUpdating ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>

      <Modal
        open={showBulkEditModal}
        title="Edicion masiva de bancos"
        onClose={() => {
          setShowBulkEditModal(false);
        }}
      >
        <form onSubmit={onBulkUpdate} className="space-y-4">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Se aplicaran los cambios a {selectedBankIds.length} bancos seleccionados.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Estado</label>
              <select
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bulkActivo}
                onChange={(event) => setBulkActivo(event.target.value as BulkStatus)}
              >
                <option value="keep">No cambiar</option>
                <option value="active">Activar</option>
                <option value="inactive">Desactivar</option>
              </select>
            </div>
            <div className="text-xs text-on-surface-variant flex items-end pb-2">
              Usa los campos vacios para mantener el valor actual.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Tarjetas activas
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bulkPayments}
                onChange={(event) => setBulkPayments(event.target.value)}
                placeholder="Visa, Mastercard"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">BINes</label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={bulkBines}
                onChange={(event) => setBulkBines(event.target.value)}
                placeholder="456789, 554433"
              />
            </div>
          </div>
          <button
            className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
            type="submit"
            disabled={bulkUpdating}
          >
            {bulkUpdating ? 'Aplicando...' : 'Aplicar cambios'}
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Direccion
            </label>
            <input
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
              value={branchDireccion}
              onChange={(event) => setBranchDireccion(event.target.value)}
              placeholder="Calle 123, Ciudad"
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
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Direccion
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={branchDireccion}
                onChange={(event) => setBranchDireccion(event.target.value)}
                placeholder="Calle 123, Ciudad"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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

      <Modal
        open={showProvisionModal}
        title={`Provisionar entorno${provisioningBank ? ` - ${provisioningBank.nombre}` : ''}`}
        onClose={() => setShowProvisionModal(false)}
      >
        <form onSubmit={onCreateProvisioningRequest} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Destino
              </label>
              <select
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={provisioningTarget}
                onChange={(event) => setProvisioningTarget(event.target.value as ProvisioningTarget)}
              >
                <option value="VPS_MANAGED">VPS gestionado</option>
                <option value="CUSTOMER_CLOUD">Cloud cliente (AWS/Azure/GCP)</option>
                <option value="ON_PREM">On-prem</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Region
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={provisioningRegion}
                onChange={(event) => setProvisioningRegion(event.target.value)}
                placeholder="us-east-1 / sa-east-1 / on-prem"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Dominio Web
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={provisioningDomain}
                onChange={(event) => setProvisioningDomain(event.target.value)}
                placeholder="bank1.automatixpay.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Dominio API
              </label>
              <input
                className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                value={provisioningApiDomain}
                onChange={(event) => setProvisioningApiDomain(event.target.value)}
                placeholder="bank1.automatixpay.com"
                required
              />
            </div>
          </div>

          {provisioningTarget === 'VPS_MANAGED' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  VPS Host
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={vpsHost}
                  onChange={(event) => setVpsHost(event.target.value)}
                  placeholder="74.208.218.120"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  SSH User
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={vpsSshUser}
                  onChange={(event) => setVpsSshUser(event.target.value)}
                  placeholder="matias"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  SSH Port
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={vpsSshPort}
                  onChange={(event) => setVpsSshPort(event.target.value)}
                  placeholder="22"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  SSH Private Key (opcional)
                </label>
                <textarea
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm min-h-24"
                  value={vpsSshPrivateKey}
                  onChange={(event) => setVpsSshPrivateKey(event.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                />
              </div>
            </div>
          ) : null}

          {provisioningTarget === 'CUSTOMER_CLOUD' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Provider
                </label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={provisioningProvider}
                  onChange={(event) => setProvisioningProvider(event.target.value)}
                >
                  <option value="AWS">AWS</option>
                  <option value="AZURE">Azure</option>
                  <option value="GCP">GCP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Role ARN
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={cloudRoleArn}
                  onChange={(event) => setCloudRoleArn(event.target.value)}
                  placeholder="arn:aws:iam::123:role/Provisioner"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Access Key ID
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={cloudAccessKeyId}
                  onChange={(event) => setCloudAccessKeyId(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Secret Access Key
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={cloudSecretAccessKey}
                  onChange={(event) => setCloudSecretAccessKey(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {provisioningTarget === 'ON_PREM' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Endpoint / Bastion
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={onPremEndpoint}
                  onChange={(event) => setOnPremEndpoint(event.target.value)}
                  placeholder="vpn.bank.local:22"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Contacto tecnico
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={onPremContactEmail}
                  onChange={(event) => setOnPremContactEmail(event.target.value)}
                  placeholder="infra@banco.com"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Notas operativas
            </label>
            <textarea
              className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm min-h-20"
              value={provisioningNotes}
              onChange={(event) => setProvisioningNotes(event.target.value)}
              placeholder="Window de deploy, observaciones, constraints de red..."
            />
          </div>

          <button
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            type="submit"
            disabled={provisioningSaving}
          >
            {provisioningSaving ? 'Guardando solicitud...' : 'Crear solicitud de provisionamiento'}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200/70 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Historial de solicitudes</h3>
          {provisioningLoading ? (
            <div className="text-sm text-slate-500">Cargando...</div>
          ) : provisioningRequests.length === 0 ? (
            <div className="text-sm text-slate-500">Sin solicitudes para este banco.</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {provisioningRequests.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">
                      {new Date(item.createdAt).toLocaleString('es-AR')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${provisionStatusClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                      {(item.status === 'FAILED' || item.status === 'CANCELLED') ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:border-slate-300"
                          onClick={() => rerunProvisioningRequest(item.id)}
                        >
                          Reintentar
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-800">
                    {item.target}
                    {item.provider ? ` • ${item.provider}` : ''}
                    {item.domain ? ` • ${item.domain}` : ''}
                  </div>
                  {item.processedAt ? (
                    <div className="mt-1 text-xs text-slate-500">
                      Procesado: {new Date(item.processedAt).toLocaleString('es-AR')}
                    </div>
                  ) : null}
                  {item.notes ? (
                    <div className="mt-1 text-xs text-slate-500 whitespace-pre-line">{item.notes}</div>
                  ) : null}
                  {item.errorMessage ? (
                    <div className="mt-1 text-xs text-rose-700">{item.errorMessage}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
