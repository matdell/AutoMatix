'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson } from '@/lib/api';
import { useConfigAccess } from '../_access';

type BinConfig = {
  id: string;
  bin: string;
  network: string;
  cardType: string;
  segment?: string | null;
  alliance?: string | null;
  channel?: string | null;
  product?: string | null;
  active: boolean;
};

export default function ConfiguracionBinesPage() {
  const router = useRouter();
  const { isAdmin, needsBankSelection, canManage, withBankQuery } = useConfigAccess(router);

  const [items, setItems] = useState<BinConfig[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, Omit<BinConfig, 'id'>>
  >({});
  const [search, setSearch] = useState('');

  const [newBin, setNewBin] = useState('');
  const [newNetwork, setNewNetwork] = useState('');
  const [newCardType, setNewCardType] = useState('');
  const [newSegment, setNewSegment] = useState('');
  const [newAlliance, setNewAlliance] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [newProduct, setNewProduct] = useState('');
  const [newActive, setNewActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => {
      const haystack = [
        item.bin,
        item.network,
        item.cardType,
        item.segment ?? '',
        item.alliance ?? '',
        item.channel ?? '',
        item.product ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<BinConfig[]>(withBankQuery('/banks/me/bin-configs'));
      setItems(data);
      setDrafts(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            {
              bin: item.bin,
              network: item.network,
              cardType: item.cardType,
              segment: item.segment ?? null,
              alliance: item.alliance ?? null,
              channel: item.channel ?? null,
              product: item.product ?? null,
              active: item.active,
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los BINES');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const updateDraft = (id: string, next: Partial<Omit<BinConfig, 'id'>>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        bin: prev[id]?.bin ?? '',
        network: prev[id]?.network ?? '',
        cardType: prev[id]?.cardType ?? '',
        segment: prev[id]?.segment ?? null,
        alliance: prev[id]?.alliance ?? null,
        channel: prev[id]?.channel ?? null,
        product: prev[id]?.product ?? null,
        active: prev[id]?.active ?? true,
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
      await apiJson(withBankQuery('/banks/me/bin-configs'), {
        method: 'POST',
        body: JSON.stringify({
          bin: newBin.trim(),
          network: newNetwork.trim(),
          cardType: newCardType.trim(),
          segment: newSegment.trim() || undefined,
          alliance: newAlliance.trim() || undefined,
          channel: newChannel.trim() || undefined,
          product: newProduct.trim() || undefined,
          active: newActive,
        }),
      });
      setNewBin('');
      setNewNetwork('');
      setNewCardType('');
      setNewSegment('');
      setNewAlliance('');
      setNewChannel('');
      setNewProduct('');
      setNewActive(true);
      setSuccess('BIN agregado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el BIN');
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
      await apiJson(withBankQuery(`/banks/me/bin-configs/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({
          bin: draft.bin.trim(),
          network: draft.network.trim(),
          cardType: draft.cardType.trim(),
          segment: draft.segment?.trim() || '',
          alliance: draft.alliance?.trim() || '',
          channel: draft.channel?.trim() || '',
          product: draft.product?.trim() || '',
          active: draft.active,
        }),
      });
      setSuccess('BIN actualizado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el BIN');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (item: BinConfig) => {
    if (!window.confirm(`Eliminar BIN ${item.bin}?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiJson(withBankQuery(`/banks/me/bin-configs/${item.id}`), {
        method: 'DELETE',
      });
      setSuccess('BIN eliminado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el BIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Configuracion - BINES</h1>
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
                Configura BINES por banco con niveles de segmentacion (marca, tipo, segmento, alianza, canal y producto).
              </div>

              <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-4 lg:grid-cols-8 md:items-end">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">BIN</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newBin}
                    onChange={(event) => setNewBin(event.target.value)}
                    placeholder="450781"
                    disabled={saving}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Marca</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newNetwork}
                    onChange={(event) => setNewNetwork(event.target.value)}
                    placeholder="Visa"
                    disabled={saving}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipo</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newCardType}
                    onChange={(event) => setNewCardType(event.target.value)}
                    placeholder="Credito"
                    disabled={saving}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Segmento</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newSegment}
                    onChange={(event) => setNewSegment(event.target.value)}
                    placeholder="Platinum"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Alianza</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newAlliance}
                    onChange={(event) => setNewAlliance(event.target.value)}
                    placeholder="Aerolinea X"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Canal</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newChannel}
                    onChange={(event) => setNewChannel(event.target.value)}
                    placeholder="Ecommerce"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Producto</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={newProduct}
                    onChange={(event) => setNewProduct(event.target.value)}
                    placeholder="Individuos"
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center gap-3">
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
                </div>
              </form>

              <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                <input
                  className="bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                  placeholder="Buscar por BIN, marca, tipo, segmento, alianza..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <div className="text-xs text-on-surface-variant">
                  Mostrando {filteredItems.length} de {items.length}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">BIN</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Marca</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Tipo</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Segmento</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Alianza</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Canal</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Producto</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-sm text-on-surface-variant">
                          Cargando BINES...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-sm text-on-surface-variant">
                          No hay BINES para mostrar.
                        </td>
                      </tr>
                    ) : null}
                    {filteredItems.map((item) => {
                      const draft = drafts[item.id] || {
                        bin: item.bin,
                        network: item.network,
                        cardType: item.cardType,
                        segment: item.segment ?? null,
                        alliance: item.alliance ?? null,
                        channel: item.channel ?? null,
                        product: item.product ?? null,
                        active: item.active,
                      };

                      return (
                        <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.bin}
                              onChange={(event) => updateDraft(item.id, { bin: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.network}
                              onChange={(event) => updateDraft(item.id, { network: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.cardType}
                              onChange={(event) => updateDraft(item.id, { cardType: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.segment ?? ''}
                              onChange={(event) => updateDraft(item.id, { segment: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.alliance ?? ''}
                              onChange={(event) => updateDraft(item.id, { alliance: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.channel ?? ''}
                              onChange={(event) => updateDraft(item.id, { channel: event.target.value })}
                              disabled={saving}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm"
                              value={draft.product ?? ''}
                              onChange={(event) => updateDraft(item.id, { product: event.target.value })}
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
