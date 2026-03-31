'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';

interface ValidationError {
  id: string;
  codigo: string;
  mensaje: string;
  resuelto: boolean;
  createdAt: string;
  merchant: { nombre: string; merchantNumber?: string | null };
}

export default function ValidacionesPage() {
  const [items, setItems] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [running, setRunning] = useState(false);

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
      setError('Inicia sesion para ver los errores de validacion.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ValidationError[]>('/validations/errors');
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar validaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runValidation = async () => {
    setRunning(true);
    setError(null);
    try {
      await apiJson('/validations/run', {
        method: 'POST',
        body: JSON.stringify(merchantId.trim() ? { merchantId: merchantId.trim() } : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar la validacion');
    } finally {
      setRunning(false);
    }
  };

  const resolveError = async (id: string) => {
    try {
      await apiJson(`/validations/errors/${id}/resolve`, { method: 'POST' });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver');
    }
  };

  return (
    <AppShell>

        <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
          <div className="flex items-center space-x-8">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Validaciones</h1>
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
                Errores de Validacion
              </h2>
              <p className="text-on-surface-variant text-sm max-w-lg">
                Ejecute el motor de validacion y resuelva inconsistencias de comercios.
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
            <div className="w-full md:max-w-md">
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
            <button
              className="px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition"
              onClick={runValidation}
              disabled={running}
            >
              {running ? 'Validando...' : 'Ejecutar validacion'}
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                Errores detectados
              </div>
              <button className="text-xs font-semibold text-primary hover:text-primary-dim" onClick={load}>
                Actualizar
              </button>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-on-surface-variant">Cargando errores...</div>
            ) : error ? (
              <div className="p-6 text-sm text-error">{error}</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-surface-container-low/50">
                  <tr>
                    <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Comercio</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Codigo</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Mensaje</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Fecha</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 text-sm">
                        {item.merchant?.nombre}
                        <div className="text-xs text-on-surface-variant">
                          {item.merchant?.merchantNumber || 'Sin MID'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-error">{item.codigo}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{item.mensaje}</td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant">
                        {formatter.format(new Date(item.createdAt))}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="text-xs font-semibold text-primary hover:underline"
                          onClick={() => resolveError(item.id)}
                        >
                          Resolver
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!items.length ? (
                    <tr>
                      <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={5}>
                        No hay errores pendientes.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </div>
    </AppShell>
  );
}
