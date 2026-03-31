'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SuperAdminCampaignsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

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

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">SuperAdmin - Campanas</h1>
      </header>

      <div className="pt-24 px-8 pb-12 space-y-8">
        {role !== 'SUPERADMIN' ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
            No tienes permisos para acceder a esta seccion.
          </div>
        ) : (
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Listado de campanas</h2>
              <p className="text-sm text-on-surface-variant">
                Placeholder listo para conectar cuando definamos la morfologia de campanas.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                      Campana
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                      Banco
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <tr className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4 text-sm text-on-surface">Campana en definicion</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">-</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">-</td>
                    <td className="px-6 py-4 text-right text-xs text-on-surface-variant">Proximamente</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
