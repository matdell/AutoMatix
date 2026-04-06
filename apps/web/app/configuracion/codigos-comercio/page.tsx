'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson } from '@/lib/api';
import { useConfigAccess } from '../_access';

type CardCodeConfig = {
  id: string;
  network: 'VISA' | 'MASTERCARD' | 'AMEX' | 'CABAL' | 'NARANJA' | 'OTRA' | string;
  label: string;
  active: boolean;
  sortOrder: number;
};

const networkOptions: Array<{ value: CardCodeConfig['network']; label: string }> = [
  { value: 'VISA', label: 'Visa' },
  { value: 'MASTERCARD', label: 'Mastercard' },
  { value: 'AMEX', label: 'American Express' },
  { value: 'CABAL', label: 'Cabal' },
  { value: 'NARANJA', label: 'Naranja' },
  { value: 'OTRA', label: 'Otra' },
];

export default function ConfiguracionCodigosComercioPage() {
  const router = useRouter();
  const { isAdmin, needsBankSelection, canManage, withBankQuery } = useConfigAccess(router);

  const [items, setItems] = useState<CardCodeConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { label: string; active: boolean; sortOrder: number }>>({});
  const [newNetwork, setNewNetwork] = useState<CardCodeConfig['network']>('AMEX');
  const [newLabel, setNewLabel] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableNetworks = useMemo(() => {
    const existing = new Set(items.map((item) => item.network));
    return networkOptions.filter((option) => !existing.has(option.value));
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => {
      const haystack = `${item.network} ${item.label}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<CardCodeConfig[]>(withBankQuery('/banks/me/card-code-configs'));
      setItems(data);
      setDrafts(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            {
              label: item.label,
              active: item.active,
              sortOrder: item.sortOrder,
            },
          ]),
        ),
      );

      const firstAvailable = networkOptions.find((option) => !data.some((item) => item.network === option.value));
      if (firstAvailable) {
        setNewNetwork(firstAvailable.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuracion');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const updateDraft = (id: string, next: Partial<{ label: string; active: boolean; sortOrder: number }>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        label: prev[id]?.label ?? '',
        active: prev[id]?.active ?? false,
        sortOrder: prev[id]?.sortOrder ?? 0,
        ...next,
      },
    }));
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery('/banks/me/card-code-configs'), {
        method: 'POST',
        body: JSON.stringify({
          network: newNetwork,
          label: newLabel.trim() || undefined,
          active: newActive,
        }),
      });
      setNewLabel('');
      setNewActive(true);
      setSuccess('Categoria de codigo de comercio agregada.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la categoria de codigo de comercio');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery(`/banks/me/card-code-configs/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({
          label: draft.label.trim(),
          active: draft.active,
          sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : 0,
        }),
      });
      setSuccess('Categoria de codigo de comercio actualizada.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la categoria de codigo de comercio');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (item: CardCodeConfig) => {
    if (!window.confirm(`Quitar la configuracion para ${item.label}?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery(`/banks/me/card-code-configs/${item.id}`), {
        method: 'DELETE',
      });
      setSuccess('Categoria de codigo de comercio eliminada.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la categoria de codigo de comercio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Configuracion - Codigos de Comercio</h1>
        <a href="/configuracion" className="text-xs font-semibold text-primary hover:underline">
          Volver a Configuracion
        </a>
      </header>

      <div className="pt-24 px-8 pb-12 space-y-6">
        {!isAdmin ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            Solo el administrador del banco puede gestionar esta configuracion.
          </div>
        ) : needsBankSelection ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            Selecciona un banco en SuperAdmin antes de editar esta configuracion.
          </div>
        ) : (
          <>
            {error ? (
              <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div>
            ) : null}
            {success ? (
              <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{success}</div>
            ) : null}

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <div className="text-sm text-on-surface-variant">
                Por defecto se inicializan Visa y Mastercard. Desde aqui puedes agregar, editar, habilitar, deshabilitar y quitar opciones.
              </div>

              <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tarjeta</label>
                  <select
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newNetwork}
                    onChange={(event) => setNewNetwork(event.target.value as CardCodeConfig['network'])}
                    disabled={availableNetworks.length === 0 || saving}
                  >
                    {availableNetworks.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre visible</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newLabel}
                    onChange={(event) => setNewLabel(event.target.value)}
                    placeholder="Ej: American Express"
                    disabled={saving || availableNetworks.length === 0}
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={newActive}
                    onChange={(event) => setNewActive(event.target.checked)}
                    disabled={saving || availableNetworks.length === 0}
                  />
                  Habilitada
                </label>

                <button
                  type="submit"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  disabled={saving || availableNetworks.length === 0}
                >
                  Agregar
                </button>
              </form>

              <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                <input
                  className="bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="Buscar tarjeta o etiqueta..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <div className="text-xs text-on-surface-variant">
                  Mostrando {filteredItems.length} de {items.length}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Tarjeta</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre visible</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Orden</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-sm text-on-surface-variant">
                          Cargando configuracion...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-sm text-on-surface-variant">
                          No hay tarjetas para mostrar.
                        </td>
                      </tr>
                    ) : null}
                    {filteredItems.map((item) => {
                      const draft = drafts[item.id] || {
                        label: item.label,
                        active: item.active,
                        sortOrder: item.sortOrder,
                      };

                      return (
                        <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-3 text-sm font-semibold text-on-surface">{item.network}</td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.label}
                              onChange={(event) => updateDraft(item.id, { label: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3 w-28">
                            <input
                              type="number"
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.sortOrder}
                              onChange={(event) => updateDraft(item.id, { sortOrder: Number(event.target.value || 0) })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={draft.active}
                                onChange={(event) => updateDraft(item.id, { active: event.target.checked })}
                                disabled={saving}
                              />
                              {draft.active ? 'Habilitada' : 'Deshabilitada'}
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                className="text-xs font-bold text-primary hover:underline disabled:opacity-60"
                                onClick={() => onSave(item.id)}
                                disabled={saving}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-60"
                                onClick={() => onRemove(item)}
                                disabled={saving}
                              >
                                Quitar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
