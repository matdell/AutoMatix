import AppShell from '@/app/_components/AppShell';

export default function DashboardPage() {
  return (
    <AppShell mainClassName="px-10 py-12">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tablero Ejecutivo</h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Resumen rapido de campanas activas, validaciones y comercios en revision.
          </p>
        </div>
        <a
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm font-medium hover:bg-surface-container-high transition-all"
          href="/perfil"
        >
          <span className="material-symbols-outlined text-base">account_circle</span>
          Perfil
        </a>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Campanas Activas</div>
          <div className="text-3xl font-extrabold text-primary mt-3">18</div>
          <p className="text-xs text-on-surface-variant mt-2">3 en etapa de Processor</p>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Invitaciones Pendientes</div>
          <div className="text-3xl font-extrabold text-on-surface mt-3">56</div>
          <p className="text-xs text-on-surface-variant mt-2">Ultimas 24 horas</p>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Errores de Validacion</div>
          <div className="text-3xl font-extrabold text-error mt-3">7</div>
          <p className="text-xs text-on-surface-variant mt-2">Requieren seguimiento</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
          <h2 className="text-lg font-semibold mb-4">Campanas en Flujo</h2>
          <ul className="space-y-4 text-sm">
            <li className="flex items-center justify-between">
              <span>Primavera 12 Cuotas</span>
              <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold uppercase">Activo</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Cashback Regional</span>
              <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase">Procesador</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Descuento Fin de Semana</span>
              <span className="px-3 py-1 rounded-full bg-tertiary-container text-on-tertiary-container text-[10px] font-bold uppercase">Operaciones</span>
            </li>
          </ul>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Proximos Vencimientos</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Auditoria Q2 Comercios</div>
                <div className="text-on-surface-variant text-xs">Vence en 4 dias</div>
              </div>
              <button className="text-primary font-semibold text-xs">Programar</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Renovacion de contratos</div>
                <div className="text-on-surface-variant text-xs">Vence en 9 dias</div>
              </div>
              <button className="text-primary font-semibold text-xs">Ver</button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
