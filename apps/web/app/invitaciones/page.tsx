'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';

interface Invitation {
  id: string;
  email: string;
  status: 'INVITED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  token: string;
  expiresAt?: string | null;
  createdAt: string;
  merchant?: { nombre: string } | null;
  branches?: { branchId: string }[];
}

const statusStyles: Record<string, string> = {
  INVITED: 'bg-secondary-container text-on-secondary-container',
  ACCEPTED: 'bg-primary-container text-on-primary-container',
  REJECTED: 'bg-error-container text-on-error-container',
  EXPIRED: 'bg-surface-variant text-on-surface-variant',
};

const statusLabel: Record<string, string> = {
  INVITED: 'Invitado',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Expirado',
};

export default function InvitacionesPage() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [branchIds, setBranchIds] = useState('');
  const [saving, setSaving] = useState(false);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  const load = async () => {
    if (!getToken()) {
      setError('Inicia sesion para ver las invitaciones.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<Invitation[]>('/invitations');
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar invitaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { email };
      if (merchantId.trim()) payload.merchantId = merchantId.trim();
      const branches = branchIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (branches.length) payload.branchIds = branches;

      await apiJson('/invitations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setEmail('');
      setMerchantId('');
      setBranchIds('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear la invitacion');
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async (token: string) => {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(token);
  };

  return (
    <AppShell>

        <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
          <div className="flex items-center space-x-8">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Invitaciones</h1>
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
                Gestion de Invitaciones
              </h2>
              <p className="text-on-surface-variant text-sm max-w-lg">
                Invite comercios, haga seguimiento del estado y comparta accesos seguros.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr] gap-6">
            <form
              onSubmit={onSubmit}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4"
            >
              <h3 className="text-lg font-semibold">Nueva invitacion</h3>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Email del comercio
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="contacto@comercio.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Merchant ID (opcional)
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="merchantId"
                  value={merchantId}
                  onChange={(event) => setMerchantId(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Branch IDs (opcional, separados por coma)
                </label>
                <input
                  className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="branch1, branch2"
                  value={branchIds}
                  onChange={(event) => setBranchIds(event.target.value)}
                />
              </div>
              {formError ? (
                <div className="text-sm text-error bg-error-container/30 px-3 py-2 rounded-xl">{formError}</div>
              ) : null}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition"
                disabled={saving}
              >
                {saving ? 'Enviando...' : 'Enviar invitacion'}
              </button>
            </form>

            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Invitaciones recientes
                </div>
                <button
                  className="text-xs font-semibold text-primary hover:text-primary-dim"
                  onClick={load}
                >
                  Actualizar
                </button>
              </div>
              {loading ? (
                <div className="p-6 text-sm text-on-surface-variant">Cargando invitaciones...</div>
              ) : error ? (
                <div className="p-6 text-sm text-error">{error}</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low/50">
                    <tr>
                      <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Email</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Comercio</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Estado</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Expira</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Token</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4 text-sm">{item.email}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {item.merchant?.nombre || 'Sin asignar'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              statusStyles[item.status] || 'bg-surface-variant text-on-surface-variant'
                            }`}
                          >
                            {statusLabel[item.status] || item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant">
                          {item.expiresAt ? formatter.format(new Date(item.expiresAt)) : 'Sin fecha'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            className="text-xs font-semibold text-primary hover:underline"
                            onClick={() => copyToken(item.token)}
                          >
                            Copiar token
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!items.length ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={5}>
                          No hay invitaciones.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
    </AppShell>
  );
}
