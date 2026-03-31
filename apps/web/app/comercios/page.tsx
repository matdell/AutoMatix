import AppShell from '@/app/_components/AppShell';

export default function ComerciosPage() {
  return (
    <AppShell>

        <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
          <div className="flex items-center space-x-8">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Comercios</h1>
            <nav className="hidden md:flex items-center space-x-6">
              <a className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors" href="/dashboard">
                Tablero
              </a>
              <a className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors" href="/campanas">
                Campanas
              </a>
              <a className="text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 py-5" href="#">
                Comercios
              </a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm">
                search
              </span>
              <input
                className="pl-9 pr-4 py-1.5 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500/20 w-64 transition-all duration-300"
                placeholder="Buscar comercios..."
                type="text"
              />
            </div>
            <button className="material-symbols-outlined text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors active:scale-95">
              notifications
            </button>
            <button className="material-symbols-outlined text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors active:scale-95">
              settings
            </button>
            <div className="h-8 w-8 rounded-full bg-slate-200 overflow-hidden ml-2 border border-slate-200">
              <img
                alt="Perfil de Usuario"
                className="h-full w-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuChciMpIKwYqrkOztksb7y3dDPCgS7yIAsm20MB1y8-k105-EMzIG2Tc9yT-6I9tExUEjjxnFuWY194iFm3OK054hDmy6tAIE7EwLShbuKn5TvPVe8lEFu1oqiOJ1lLdzv_hILM01pEFY7bWzh56ry5dmIGNL8fK_6CqlcLSg386Ba2Kwtj1mb0OCuZakSqZeuSQ6YwAJIKpnVogh6oavBo1_MxKbhOrjht2EK138ePVD4XlkL86TTsk9AI_H-F4jB8sgoBd9zL-xA"
              />
            </div>
          </div>
        </header>

        <div className="pt-24 px-8 pb-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-semibold text-on-surface tracking-tight mb-2">
                Directorio de Comercios
              </h2>
              <p className="text-on-surface-variant text-sm max-w-lg">
                Gestione alianzas institucionales y rastree los estados de cumplimiento comercial en toda su red regional.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-5 py-2.5 bg-surface-container-high text-on-surface rounded-xl text-sm font-medium hover:bg-surface-container-highest transition-all duration-200 active:scale-95">
                <span className="material-symbols-outlined text-lg">upload_file</span>
                <span>Carga Masiva (CSV)</span>
              </button>
              <a
                className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-dim text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 transition-all duration-200 active:scale-95"
                href="/campanas"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                <span>Crear Campana</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6 mb-10">
            <div className="bg-surface-container-lowest p-6 rounded-xl border-l-4 border-primary">
              <div className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-1 text-[10px] font-bold">
                Total de Comercios
              </div>
              <div className="text-2xl font-extrabold text-on-surface">1,248</div>
              <div className="mt-2 flex items-center text-xs text-primary font-medium">
                <span className="material-symbols-outlined text-xs mr-1">trending_up</span>
                +12% este mes
              </div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl">
              <div className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-1 text-[10px] font-bold">
                Licencias Activas
              </div>
              <div className="text-2xl font-extrabold text-on-surface">1,102</div>
              <div className="mt-2 flex items-center text-xs text-secondary font-medium">
                <span className="material-symbols-outlined text-xs mr-1">sync</span>
                Verificacion en tiempo real
              </div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl">
              <div className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-1 text-[10px] font-bold">
                Pendiente de Revision
              </div>
              <div className="text-2xl font-extrabold text-on-surface">42</div>
              <div className="mt-2 flex items-center text-xs text-secondary-dim font-medium">
                <span className="material-symbols-outlined text-xs mr-1">schedule</span>
                Tiempo prom. resp. 2h
              </div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl">
              <div className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-1 text-[10px] font-bold">
                Errores de Verificacion
              </div>
              <div className="text-2xl font-extrabold text-error">7</div>
              <div className="mt-2 flex items-center text-xs text-error font-medium">
                <span className="material-symbols-outlined text-xs mr-1">warning</span>
                Accion requerida
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
            <div className="px-6 py-4 flex items-center justify-between bg-surface-container-lowest border-b border-slate-100">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Filtrar por:</span>
                  <select className="text-sm bg-surface-container-low border-none rounded-lg focus:ring-primary/20 cursor-pointer py-1 pl-3 pr-8">
                    <option>Todas las Categorias</option>
                    <option>Minorista</option>
                    <option>Hoteleria</option>
                    <option>Tecnologia</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <select className="text-sm bg-surface-container-low border-none rounded-lg focus:ring-primary/20 cursor-pointer py-1 pl-3 pr-8">
                    <option>Todos los Estados</option>
                    <option>Activo</option>
                    <option>Pendiente</option>
                    <option>Restringido</option>
                  </select>
                </div>
              </div>
              <div className="text-on-surface-variant text-xs font-medium">
                Mostrando 1-10 de 1,248 comercios
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Nombre del Comercio
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                    ID de Comercio
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Ubicacion Principal
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-center">
                    Estado Actual
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary overflow-hidden">
                        <img
                          alt="Logo de Marca"
                          className="h-full w-full object-cover"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuC2WXrApMXR2w9H1PXwENkTIRh3cEAl1ocr6B5KoB0RD0IAoV_MNr5E23CfPQk4KkPWUWpcY39XTuF0bedUwQMcho68HjJBI4qP_m8CGV_NwAJHzDrJbeoLO5YYJRDVjyL6nIZVZdMOzIsLFGIyyoAsxNP019BL2VJciwSS53FPCINrWASBU6Yjq6eVR6VCrICdjsKoIY9P0VfZvvTLF7zKbrWh_LtsH3FnOzBMu1H2MRq1btErhf0KMzoggdM_ZpRZSAGFNX1XXp8"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-on-surface">Lumina Retail Group</div>
                        <div className="text-xs text-on-surface-variant">Logistica Global</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">MID-9920-X1</code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm mr-1.5 opacity-50">pin_drop</span>
                      San Francisco, CA
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-3 py-1 rounded bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-wider">
                      Activo
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a className="inline-flex items-center text-xs font-bold text-primary hover:underline transition-all" href="#">
                      Perfil del Comercio
                      <span className="material-symbols-outlined text-xs ml-1">arrow_forward</span>
                    </a>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary overflow-hidden">
                        <img
                          alt="Logo de Marca"
                          className="h-full w-full object-cover"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBtvfPj74fw7d1N3uPE5957932zjYYn0VoewG6nm6zFRlPbNEviab13VHuI0Q8s22OypL44w9QGRBacH2zbsaWYvIr6GBl6Q8FXkaNc4ydgSBjEMAFgztH0UjLn4oNIT_T0iSO9TBuubZUwcrqKgnc1votWmG4rNVAqRZiYB-AOB4sTY0z0DcR3LJK56JGcV-NVL7bNwwajdpSBwDeEBRZnuxOaIHfPHR08nIRnvHH7SNAon59wAlSvtBF4xUbo5dQgugEMeWoMVmY"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-on-surface">Apex FinTech Hub</div>
                        <div className="text-xs text-on-surface-variant">Soluciones Bancarias</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">MID-4432-A9</code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm mr-1.5 opacity-50">pin_drop</span>
                      Londres, UK
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-3 py-1 rounded bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                      Pendiente
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a className="inline-flex items-center text-xs font-bold text-primary hover:underline transition-all" href="#">
                      Perfil del Comercio
                      <span className="material-symbols-outlined text-xs ml-1">arrow_forward</span>
                    </a>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary overflow-hidden">
                        <img
                          alt="Logo de Marca"
                          className="h-full w-full object-cover"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJlXaVtI92aQeR17EXGjtXAyOmW3PCSdPXhOuf6JIvWpOFMwpBfttOXStv36UNogLXxF7hJ9la7ijk3KgWsCsbDce8idnBQUl5dIHwy71v8fP3RB-N9eZVM4WwFNj_jd_Stsp0D6R2IAM1oGNdfRkeDZFo7PKGffIZypvjBi4pQ7arCagKkEK4m0XXO9pGOHYL1_SgFkk8i8Wlw0QZ9zOE0ZXTsqfk4Yjrtwky3hgDvvdi7U-CJ7BXAkRuf2gfWWLU0d0L7S8rTQ8"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-on-surface">Stratos Ventures</div>
                        <div className="text-xs text-on-surface-variant">Gestion de Patrimonio</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">MID-1120-Q2</code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm mr-1.5 opacity-50">pin_drop</span>
                      Berlin, DE
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-3 py-1 rounded bg-error-container text-on-error-container text-[10px] font-bold uppercase tracking-wider">
                      Restringido
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a className="inline-flex items-center text-xs font-bold text-primary hover:underline transition-all" href="#">
                      Perfil del Comercio
                      <span className="material-symbols-outlined text-xs ml-1">arrow_forward</span>
                    </a>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary overflow-hidden">
                        <img
                          alt="Logo de Marca"
                          className="h-full w-full object-cover"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCBasqnVIIqf37qNzdxhLAyo0aKlSzt87nqe56eIH2Hzwznl1Txq7FcEDznFqHkk-Pru9PfI8BIoe-1LIoL1-xAqOhiZzLB90zJtRG8P-o4SQXp8Nfe7bNm9H4x2FjWaPeohNkFIht7wrVwctHvDVRxR6OOYuZvHKfr1z3a-mV2MY94O8Dg_0cTWfhrzl0AnOfyUPaqjYDZT8F2zysAYx4eAf7QNgssb2T2WqjqbXH3zVax_jTY7aUgUFxZ7zjNyjjVO88INsMu2M"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-on-surface">Azure Hospitality</div>
                        <div className="text-xs text-on-surface-variant">Viajes y Ocio</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">MID-8841-Z5</code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm mr-1.5 opacity-50">pin_drop</span>
                      Tokio, JP
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-3 py-1 rounded bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-wider">
                      Activo
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a className="inline-flex items-center text-xs font-bold text-primary hover:underline transition-all" href="#">
                      Perfil del Comercio
                      <span className="material-symbols-outlined text-xs ml-1">arrow_forward</span>
                    </a>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary overflow-hidden">
                        <div className="text-sm font-bold bg-primary/10 w-full h-full flex items-center justify-center">
                          VN
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-on-surface">Vanguard Networks</div>
                        <div className="text-xs text-on-surface-variant">Ciberseguridad</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">MID-5561-L0</code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm mr-1.5 opacity-50">pin_drop</span>
                      Austin, TX
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-3 py-1 rounded bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-wider">
                      Activo
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a className="inline-flex items-center text-xs font-bold text-primary hover:underline transition-all" href="#">
                      Perfil del Comercio
                      <span className="material-symbols-outlined text-xs ml-1">arrow_forward</span>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="px-6 py-4 bg-surface-container-lowest flex items-center justify-between border-t border-slate-50">
              <button className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
                Anterior
              </button>
              <div className="flex items-center space-x-1">
                <button className="w-8 h-8 flex items-center justify-center rounded bg-primary text-white text-xs font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface text-xs">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface text-xs">3</button>
                <span className="px-2 text-on-surface-variant">...</span>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-on-surface text-xs">125</button>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
                Siguiente
              </button>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-2 bg-surface-container-low/50 p-8 rounded-2xl flex items-center justify-between">
              <div className="max-w-md">
                <h3 className="text-xl font-bold text-on-surface mb-2">
                  Auditoria Institucional Pendiente
                </h3>
                <p className="text-on-surface-variant text-sm mb-4">
                  Su revision trimestral de cumplimiento para comercios del sudeste asiatico vence en 4 dias. Quiere pre-validar los metadatos?
                </p>
                <button className="text-indigo-600 font-bold text-sm flex items-center hover:translate-x-1 transition-transform">
                  Comenzar Validacion <span className="material-symbols-outlined ml-2 text-sm">rocket_launch</span>
                </button>
              </div>
              <div className="hidden lg:block h-32 w-32 bg-indigo-100 rounded-full flex items-center justify-center opacity-50">
                <span className="material-symbols-outlined text-5xl text-indigo-500">assignment_turned_in</span>
              </div>
            </div>
            <div className="bg-indigo-600 p-8 rounded-2xl text-white flex flex-col justify-between shadow-xl shadow-indigo-200">
              <div className="material-symbols-outlined text-3xl">contact_support</div>
              <div>
                <h3 className="font-bold mb-1">Necesita ayuda empresarial?</h3>
                <p className="text-indigo-100 text-xs leading-relaxed">
                  Gestores de cuenta dedicados estan disponibles para integraciones de alto volumen.
                </p>
              </div>
              <button className="mt-4 bg-white text-indigo-600 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors">
                Contactar Soporte
              </button>
            </div>
          </div>
        </div>
    </AppShell>
  );
}
