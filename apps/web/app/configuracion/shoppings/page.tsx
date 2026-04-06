'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson } from '@/lib/api';
import { useConfigAccess } from '../_access';

type ShoppingItem = {
  id: string;
  nombre: string;
  grupo?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

type ShoppingDraft = {
  nombre: string;
  grupo: string;
  activo: boolean;
};

export default function ConfiguracionShoppingsPage() {
  const router = useRouter();
  const { isAdmin, needsBankSelection, canManage, withBankQuery } = useConfigAccess(router);

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ShoppingDraft>>({});
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      if (onlyActive && !item.activo) return false;
      if (!normalizedSearch) return true;

      const haystack = `${item.nombre} ${item.grupo ?? ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [items, onlyActive, search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ShoppingItem[]>(withBankQuery('/banks/me/shoppings'));
      setItems(data);
      setDrafts(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            {
              nombre: item.nombre,
              grupo: item.grupo ?? '',
              activo: item.activo,
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los shoppings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const updateDraft = (id: string, next: Partial<ShoppingDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        nombre: prev[id]?.nombre ?? '',
        grupo: prev[id]?.grupo ?? '',
        activo: prev[id]?.activo ?? true,
        ...next,
      },
    }));
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nombre = newName.trim();
    if (!nombre) {
      setError('El nombre del shopping es obligatorio.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery('/banks/me/shoppings'), {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          grupo: newGroup.trim() || undefined,
          activo: newActive,
        }),
      });
      setNewName('');
      setNewGroup('');
      setNewActive(true);
      setSuccess('Shopping agregado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el shopping');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    const nombre = draft.nombre.trim();
    if (!nombre) {
      setError('El nombre del shopping es obligatorio.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery(`/banks/me/shoppings/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({
          nombre,
          grupo: draft.grupo.trim(),
          activo: draft.activo,
        }),
      });
      setSuccess('Shopping actualizado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el shopping');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (item: ShoppingItem) => {
    if (!window.confirm(`Eliminar el shopping ${item.nombre}?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery(`/banks/me/shoppings/${item.id}`), {
        method: 'DELETE',
      });
      setSuccess('Shopping eliminado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el shopping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Configuracion - Shoppings</h1>
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
                Administra los shoppings y su <span className="font-semibold">grupo</span> para facilitar la carga de campanas.
              </div>

              <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Ej: Alto Palermo"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Grupo</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newGroup}
                    onChange={(event) => setNewGroup(event.target.value)}
                    placeholder="Ej: Grupo IRSA"
                    disabled={saving}
                  />
                </div>

                <label className="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm">
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
            </section>

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <h2 className="text-base font-semibold text-on-surface">Shoppings ({filteredItems.length})</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    className="bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre o grupo..."
                    disabled={saving}
                  />
                  <label className="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={onlyActive}
                      onChange={(event) => setOnlyActive(event.target.checked)}
                      disabled={saving}
                    />
                    Solo activos
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-container-low/60">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Grupo</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Activo</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                          Cargando shoppings...
                        </td>
                      </tr>
                    ) : null}

                    {!loading && filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-on-surface-variant">
                          No hay shoppings para mostrar.
                        </td>
                      </tr>
                    ) : null}

                    {filteredItems.map((item) => {
                      const draft = drafts[item.id];
                      if (!draft) return null;

                      return (
                        <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm"
                              value={draft.nombre}
                              onChange={(event) => updateDraft(item.id, { nombre: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm"
                              value={draft.grupo}
                              onChange={(event) => updateDraft(item.id, { grupo: event.target.value })}
                              placeholder="Sin grupo"
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={draft.activo}
                                onChange={(event) => updateDraft(item.id, { activo: event.target.checked })}
                                disabled={saving}
                              />
                              {draft.activo ? 'Si' : 'No'}
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
                                onClick={() => onSave(item.id)}
                                disabled={saving}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50"
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
