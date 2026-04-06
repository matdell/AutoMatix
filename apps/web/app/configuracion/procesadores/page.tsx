'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson } from '@/lib/api';
import { useConfigAccess } from '../_access';

type ProcessorConfig = {
  id: string;
  nombre: string;
  active: boolean;
  sortOrder: number;
};

export default function ConfiguracionProcesadoresPage() {
  const router = useRouter();
  const { isAdmin, needsBankSelection, canManage, withBankQuery } = useConfigAccess(router);

  const [items, setItems] = useState<ProcessorConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { nombre: string; active: boolean; sortOrder: number }>>({});
  const [newName, setNewName] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [newSortOrder, setNewSortOrder] = useState(999);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.nombre.toLowerCase().includes(normalized));
  }, [items, search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ProcessorConfig[]>(withBankQuery('/banks/me/processor-configs'));
      setItems(data);
      setDrafts(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            {
              nombre: item.nombre,
              active: item.active,
              sortOrder: item.sortOrder,
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los procesadores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const updateDraft = (id: string, next: Partial<{ nombre: string; active: boolean; sortOrder: number }>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        nombre: prev[id]?.nombre ?? '',
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
      await apiJson(withBankQuery('/banks/me/processor-configs'), {
        method: 'POST',
        body: JSON.stringify({
          nombre: newName,
          active: newActive,
          sortOrder: Number.isFinite(newSortOrder) ? newSortOrder : 999,
        }),
      });
      setNewName('');
      setNewActive(true);
      setNewSortOrder(999);
      setSuccess('Procesador agregado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el procesador');
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
      await apiJson(withBankQuery(`/banks/me/processor-configs/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: draft.nombre.trim(),
          active: draft.active,
          sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : 0,
        }),
      });
      setSuccess('Procesador actualizado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el procesador');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (item: ProcessorConfig) => {
    if (!window.confirm(`Eliminar el procesador ${item.nombre}?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery(`/banks/me/processor-configs/${item.id}`), {
        method: 'DELETE',
      });
      setSuccess('Procesador eliminado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el procesador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Configuracion - Procesadores</h1>
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
              <div className="text-sm text-on-surface-variant">Por defecto: Prisma y MODO.</div>

              <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-[1fr_140px_auto_auto] md:items-end">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Ej: Prisma"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Orden</label>
                  <input
                    type="number"
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newSortOrder}
                    onChange={(event) => setNewSortOrder(Number(event.target.value || 0))}
                    disabled={saving}
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={newActive}
                    onChange={(event) => setNewActive(event.target.checked)}
                    disabled={saving}
                  />
                  Activo
                </label>

                <button
                  type="submit"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  disabled={saving}
                >
                  Agregar
                </button>
              </form>

              <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                <input
                  className="bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="Buscar procesador..."
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
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Orden</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                          Cargando procesadores...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                          No hay procesadores para mostrar.
                        </td>
                      </tr>
                    ) : null}
                    {filteredItems.map((item) => {
                      const draft = drafts[item.id] || {
                        nombre: item.nombre,
                        active: item.active,
                        sortOrder: item.sortOrder,
                      };

                      return (
                        <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.nombre}
                              onChange={(event) => updateDraft(item.id, { nombre: event.target.value })}
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
                              {draft.active ? 'Activo' : 'Inactivo'}
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
                                Eliminar
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
