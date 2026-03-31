'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';

const statusLabel: Record<string, string> = {
  INVITED: 'Invitada',
  OPERATIONS: 'Operaciones',
  PROCESSOR: 'Procesador',
  PARTIAL: 'Parcial',
  ACTIVE: 'Activa',
  ARCHIVED: 'Eliminada',
};

const statusStyles: Record<string, string> = {
  INVITED: 'bg-secondary-container text-on-secondary-container',
  OPERATIONS: 'bg-tertiary-container text-on-tertiary-container',
  PROCESSOR: 'bg-surface-variant text-on-surface-variant',
  PARTIAL: 'bg-primary-container text-on-primary-container',
  ACTIVE: 'bg-primary-container text-on-primary-container',
  ARCHIVED: 'bg-surface-variant text-on-surface-variant',
};

type CampaignStatus = keyof typeof statusLabel;

type Campaign = {
  id: string;
  nombre: string;
  tipo: string;
  estado: CampaignStatus;
  estadoAnterior?: CampaignStatus | null;
  fechaInicio: string;
  fechaFin: string;
  merchants: { merchantId: string; branchId?: string | null }[];
  archivedAt?: string | null;
  archivedBy?: { nombre?: string | null; email?: string | null } | null;
};

type Merchant = {
  id: string;
  nombre: string;
};

type Branch = {
  id: string;
  nombre: string;
  direccion?: string | null;
};

type CreatePayload = {
  nombre: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  condiciones?: Record<string, unknown>;
  targets: { merchantId: string; branchId?: string }[];
};

export default function CampanasPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [archived, setArchived] = useState<Campaign[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('DISCOUNT');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [condiciones, setCondiciones] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [branchId, setBranchId] = useState('');

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
      }),
    [],
  );

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  const formatRange = (start: string, end: string) => {
    if (!start || !end) return '-';
    return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
  };

  const load = async (filter = statusFilter, search = searchTerm) => {
    if (!getToken()) {
      setError('Inicia sesion para ver las campanas.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('estado', filter);
      if (search.trim()) params.set('q', search.trim());
      const campaignsUrl = params.toString() ? `/campaigns?${params.toString()}` : '/campaigns';
      const [actives, archivedData] = await Promise.all([
        apiJson<Campaign[]>(campaignsUrl),
        apiJson<Campaign[]>('/campaigns?estado=ARCHIVED'),
      ]);
      setItems(actives);
      setArchived(archivedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar campanas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (!getToken()) return;
    apiJson<Merchant[]>('/merchants')
      .then((data) => setMerchants(data))
      .catch(() => {
        setFormError('No se pudieron cargar los comercios.');
      });
  }, []);

  useEffect(() => {
    if (!merchantId) {
      setBranches([]);
      setBranchId('');
      return;
    }
    apiJson<Branch[]>(`/merchants/${merchantId}/branches`)
      .then((data) => {
        setBranches(data);
        setBranchId((current) => (current && data.find((b) => b.id === current) ? current : ''));
      })
      .catch(() => {
        setBranches([]);
      });
  }, [merchantId]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!merchantId.trim()) {
      setFormError('Ingrese al menos un Merchant ID.');
      return;
    }
    let condicionesParsed: Record<string, unknown> | undefined;
    if (condiciones.trim()) {
      try {
        condicionesParsed = JSON.parse(condiciones);
      } catch {
        setFormError('El JSON de condiciones no es valido.');
        return;
      }
    }

    const payload: CreatePayload = {
      nombre: nombre.trim(),
      tipo,
      fechaInicio,
      fechaFin,
      targets: [
        {
          merchantId: merchantId.trim(),
          ...(branchId.trim() ? { branchId: branchId.trim() } : {}),
        },
      ],
      ...(condicionesParsed ? { condiciones: condicionesParsed } : {}),
    };

    setSaving(true);
    try {
      await apiJson('/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setNombre('');
      setTipo('DISCOUNT');
      setFechaInicio('');
      setFechaFin('');
      setCondiciones('');
      setMerchantId('');
      setBranchId('');

      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear la campana');
    } finally {
      setSaving(false);
    }
  };

  const archiveCampaign = async (id: string) => {
    await apiJson(`/campaigns/${id}/archive`, { method: 'POST' });
    await load();
  };

  const restoreCampaign = async (id: string) => {
    await apiJson(`/campaigns/${id}/restore`, { method: 'POST' });
    await load();
  };

  return (
    <AppShell>

        <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
          <div className="flex items-center space-x-8">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Campanas</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="material-symbols-outlined text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors active:scale-95">
              notifications
            </button>
            <button className="material-symbols-outlined text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors active:scale-95">
              settings
            </button>
          </div>
        </header>

        <div className="pt-24 px-8 pb-12 space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-on-surface tracking-tight mb-2">
                Gestion de Campanas
              </h2>
              <p className="text-on-surface-variant text-sm max-w-lg">
                Cree nuevas campanas, controle el estado y restaure las que fueron eliminadas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr] gap-6">
            <form
              onSubmit={onSubmit}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4"
            >
              <h3 className="text-lg font-semibold">Nueva campana</h3>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Nombre
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="Promo Primavera"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Tipo
                  </label>
                  <select
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={tipo}
                    onChange={(event) => setTipo(event.target.value)}
                  >
                    <option value="DISCOUNT">Descuento</option>
                    <option value="INSTALLMENTS">Cuotas</option>
                    <option value="CASHBACK">Cashback</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Comercio
                  </label>
                  <select
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={merchantId}
                    onChange={(event) => setMerchantId(event.target.value)}
                    required
                  >
                    <option value="">Seleccionar comercio...</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.nombre} · {merchant.id.slice(0, 6)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Fecha inicio
                  </label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    type="date"
                    value={fechaInicio}
                    onChange={(event) => setFechaInicio(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Fecha fin
                  </label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    type="date"
                    value={fechaFin}
                    onChange={(event) => setFechaFin(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Punto de venta (opcional)
                </label>
                <select
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  disabled={!merchantId}
                >
                  <option value="">Todas las sucursales</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.nombre} · {branch.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Condiciones (JSON opcional)
                </label>
                <textarea
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm min-h-[110px]"
                  placeholder='{"porcentaje": 20, "tope": 30000}'
                  value={condiciones}
                  onChange={(event) => setCondiciones(event.target.value)}
                />
              </div>
              {formError ? (
                <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
                  {formError}
                </div>
              ) : null}
              <button
                className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Creando...' : 'Crear campana'}
              </button>
            </form>

            <div className="space-y-6">
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
                <div className="px-6 py-4 flex items-center justify-between bg-surface-container-lowest border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-semibold">Campanas activas</h3>
                    <p className="text-xs text-on-surface-variant">{items.length} registradas</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="uppercase tracking-widest text-[10px] font-semibold">Filtrar</span>
                    <select
                      className="bg-surface-container-low border-none rounded-lg px-3 py-1 text-sm"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="">Todas</option>
                      <option value="INVITED">Invitada</option>
                      <option value="OPERATIONS">Operaciones</option>
                      <option value="PROCESSOR">Procesador</option>
                      <option value="PARTIAL">Parcial</option>
                      <option value="ACTIVE">Activa</option>
                    </select>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                        search
                      </span>
                      <input
                        className="bg-surface-container-low border-none rounded-lg pl-9 pr-3 py-1 text-sm w-44"
                        placeholder="Buscar nombre..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
                {loading ? (
                  <div className="px-6 py-6 text-sm text-on-surface-variant">Cargando campanas...</div>
                ) : error ? (
                  <div className="px-6 py-6 text-sm text-error">{error}</div>
                ) : items.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-on-surface-variant">No hay campanas activas.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Campana
                        </th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Vigencia
                        </th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-on-surface">{item.nombre}</div>
                            <div className="text-xs text-on-surface-variant">{item.merchants?.length || 0} comercios</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface">{item.tipo}</td>
                          <td className="px-6 py-4 text-xs text-on-surface-variant">{formatRange(item.fechaInicio, item.fechaFin)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${statusStyles[item.estado] || ''}`}>
                              {statusLabel[item.estado] || item.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              className="text-xs font-semibold text-error hover:text-error/80"
                              onClick={() => archiveCampaign(item.id)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
                <div className="px-6 py-4 flex items-center justify-between bg-surface-container-lowest border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-semibold">Campanas eliminadas</h3>
                    <p className="text-xs text-on-surface-variant">{archived.length} eliminadas</p>
                  </div>
                </div>
                {loading ? (
                  <div className="px-6 py-6 text-sm text-on-surface-variant">Cargando eliminadas...</div>
                ) : archived.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-on-surface-variant">No hay campanas eliminadas.</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Campana
                        </th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Vigencia
                        </th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {archived.map((item) => {
                        const deletedBy =
                          item.archivedBy?.nombre ||
                          item.archivedBy?.email ||
                          'Sistema';
                        const deletedAt = item.archivedAt
                          ? dateTimeFormatter.format(new Date(item.archivedAt))
                          : 'Sin fecha';
                        const previousState = item.estadoAnterior
                          ? statusLabel[item.estadoAnterior as CampaignStatus] || item.estadoAnterior
                          : 'Sin estado previo';
                        return (
                          <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-on-surface">{item.nombre}</div>
                              <div className="text-xs text-on-surface-variant">{item.merchants?.length || 0} comercios</div>
                              <div className="text-[11px] text-on-surface-variant mt-1">
                                Eliminada por {deletedBy} · {deletedAt}
                              </div>
                              <div className="text-[11px] text-on-surface-variant">
                                Estado previo: {previousState}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-on-surface-variant">{formatRange(item.fechaInicio, item.fechaFin)}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                className="text-xs font-semibold text-primary hover:text-primary/80"
                                onClick={() => restoreCampaign(item.id)}
                              >
                                Restaurar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
    </AppShell>
  );
}
