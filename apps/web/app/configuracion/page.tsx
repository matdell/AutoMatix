'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/_components/AppShell';
import { apiJson } from '@/lib/api';
import { useConfigAccess } from './_access';

const configSections = [
  {
    href: '/configuracion/categorias',
    title: 'Categorias',
    description: 'CRUD de categorias de comercios con soporte de busqueda.',
  },
  {
    href: '/configuracion/codigos-comercio',
    title: 'Categorias de Codigos de Comercio',
    description: 'Tarjetas, nombre visible, orden y estado para cada banco.',
  },
  {
    href: '/configuracion/shoppings',
    title: 'Shoppings',
    description: 'CRUD de shoppings para asociar en los puntos de venta.',
  },
  {
    href: '/configuracion/procesadores',
    title: 'Procesadores',
    description: 'CRUD de procesadores (defaults: Prisma y MODO).',
  },
  {
    href: '/configuracion/bines',
    title: 'BINES',
    description: 'Configuracion de BINES por marca/tipo/segmento/alianza/canal/producto.',
  },
  {
    href: '/configuracion/tipos-campania',
    title: 'Tipos de Campana',
    description: 'CRUD de tipos comerciales de campana + modo de target.',
  },
] as const;

const timezoneSuggestions = [
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Mendoza',
  'America/Sao_Paulo',
  'America/Santiago',
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/New_York',
  'UTC',
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const { isAdmin, needsBankSelection, canManage, withBankQuery } = useConfigAccess(router);

  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
  const [loadingTimezone, setLoadingTimezone] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [timezoneSuccess, setTimezoneSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    setLoadingTimezone(true);
    setTimezoneError(null);
    void apiJson<{ timezone?: string }>(withBankQuery('/banks/me'))
      .then((bank) => {
        setTimezone(bank.timezone?.trim() || 'America/Argentina/Buenos_Aires');
      })
      .catch((error) => {
        setTimezoneError(error instanceof Error ? error.message : 'No se pudo cargar la zona horaria');
      })
      .finally(() => {
        setLoadingTimezone(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const onSaveTimezone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingTimezone(true);
    setTimezoneError(null);
    setTimezoneSuccess(null);
    try {
      await apiJson(withBankQuery('/banks/me'), {
        method: 'PUT',
        body: JSON.stringify({
          timezone: timezone.trim() || 'America/Argentina/Buenos_Aires',
        }),
      });
      setTimezoneSuccess('Zona horaria actualizada.');
    } catch (error) {
      setTimezoneError(error instanceof Error ? error.message : 'No se pudo guardar la zona horaria');
    } finally {
      setSavingTimezone(false);
    }
  };

  return (
    <AppShell>
      <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Configuracion</h1>
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
            {timezoneError ? (
              <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">{timezoneError}</div>
            ) : null}
            {timezoneSuccess ? (
              <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">{timezoneSuccess}</div>
            ) : null}

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <p className="text-sm text-on-surface-variant">
                Selecciona el modulo a gestionar. Cada configuracion tiene su pagina independiente para trabajar mejor con listados grandes.
              </p>
            </section>

            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4">
              <h2 className="text-lg font-semibold text-on-surface">Zona Horaria del Banco</h2>
              <p className="text-sm text-on-surface-variant">
                Se usa para el auto-cierre y auto-finalizacion de campanas. Formato IANA (ejemplo: America/Argentina/Buenos_Aires).
              </p>
              <form onSubmit={onSaveTimezone} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Timezone</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    list="timezone-suggestions"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="America/Argentina/Buenos_Aires"
                    disabled={loadingTimezone || savingTimezone}
                    required
                  />
                  <datalist id="timezone-suggestions">
                    {timezoneSuggestions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
                <button
                  type="submit"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  disabled={loadingTimezone || savingTimezone}
                >
                  Guardar timezone
                </button>
              </form>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {configSections.map((section) => (
                <a
                  key={section.href}
                  href={section.href}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] hover:border-slate-300 transition-colors"
                >
                  <div className="text-base font-bold text-slate-900">{section.title}</div>
                  <div className="mt-2 text-sm text-on-surface-variant">{section.description}</div>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Abrir</div>
                </a>
              ))}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
