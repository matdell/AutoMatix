'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson, clearToken, getToken } from '@/lib/api';

type Category = {
  id: string;
  nombre: string;
  activo: boolean;
};

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.25)]">
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

export default function CategoriasPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [activo, setActivo] = useState(true);

  const canManage = role === 'BANK_ADMIN';

  useEffect(() => {
    if (!getToken()) {
      setRoleResolved(true);
      router.push('/login');
      return;
    }

    const raw = window.localStorage.getItem('user');
    if (!raw) {
      clearToken();
      setRole(null);
      setRoleResolved(true);
      router.push('/login');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setRole(parsed?.role ?? null);
    } catch {
      clearToken();
      setRole(null);
      router.push('/login');
    }

    setRoleResolved(true);
  }, [router]);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<Category[]>('/categories');
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void loadCategories();
  }, [canManage]);

  const resetForm = () => {
    setNombre('');
    setActivo(true);
    setEditingCategoryId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setNombre(category.nombre);
    setActivo(category.activo);
    setShowEditModal(true);
  };

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        nombre: nombre.trim(),
        activo,
      };

      if (showCreateModal) {
        await apiJson('/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Categoria creada correctamente.');
      } else if (showEditModal && editingCategoryId) {
        await apiJson(`/categories/${editingCategoryId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccess('Categoria actualizada correctamente.');
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la categoria');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (category: Category) => {
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !category.activo }),
      });
      setSuccess(category.activo ? 'Categoria dada de baja.' : 'Categoria reactivada.');
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la categoria');
    }
  };

  const removeCategory = async (category: Category) => {
    const confirmed = window.confirm(`Eliminar categoria "${category.nombre}"?`);
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/categories/${category.id}`, { method: 'DELETE' });
      setSuccess('Categoria eliminada.');
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la categoria');
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Configuracion - Categorias</h1>
        {canManage ? (
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300"
            type="button"
            onClick={openCreate}
          >
            Nueva categoria
          </button>
        ) : null}
      </header>

      <div className="pt-24 px-8 pb-12 space-y-6">
        {!roleResolved ? (
          <div className="text-sm text-on-surface-variant bg-surface-container-low/40 px-4 py-3 rounded-xl">
            Cargando sesion...
          </div>
        ) : !canManage ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            Solo Admin Banco puede gestionar categorias.
          </div>
        ) : (
          <>
            {error ? <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{error}</div> : null}
            {success ? (
              <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{success}</div>
            ) : null}

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Categoria</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-sm text-on-surface-variant">
                          Cargando categorias...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && categories.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-sm text-on-surface-variant">
                          No hay categorias cargadas.
                        </td>
                      </tr>
                    ) : null}
                    {categories.map((category) => (
                      <tr key={category.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-on-surface">{category.nombre}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                              category.activo
                                ? 'bg-primary-container text-on-primary-container'
                                : 'bg-surface-variant text-on-surface-variant'
                            }`}
                          >
                            {category.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              className="text-xs font-bold text-primary hover:underline"
                              onClick={() => openEdit(category)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs font-bold text-slate-700 hover:underline"
                              onClick={() => toggleActive(category)}
                            >
                              {category.activo ? 'Baja' : 'Reactivar'}
                            </button>
                            <button
                              type="button"
                              className="text-xs font-bold text-rose-600 hover:underline"
                              onClick={() => removeCategory(category)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <Modal open={showCreateModal} title="Crear categoria" onClose={() => setShowCreateModal(false)}>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre *</label>
            <input
              className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={activo}
              onChange={(event) => setActivo(event.target.checked)}
            />
            Categoria activa
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700"
              onClick={() => setShowCreateModal(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditModal} title="Editar categoria" onClose={() => setShowEditModal(false)}>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre *</label>
            <input
              className="mt-1 w-full rounded-xl bg-surface-container-low px-4 py-2 text-sm"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={activo}
              onChange={(event) => setActivo(event.target.checked)}
            />
            Categoria activa
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700"
              onClick={() => setShowEditModal(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
