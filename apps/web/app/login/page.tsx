'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import AutoMatixLogo from '@/app/_components/AutoMatixLogo';
import { API_BASE_URL, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bankSlug, setBankSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          bankSlug: bankSlug || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
        throw new Error(message || 'No se pudo iniciar sesion');
      }
      if (data?.accessToken) {
        setToken(data.accessToken);
        window.localStorage.setItem('user', JSON.stringify(data.user));
      }
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-surface text-on-surface flex min-h-screen items-center justify-center p-6 selection:bg-primary-container selection:text-on-primary-container">
      <div className="w-full max-w-[1100px] grid md:grid-cols-2 bg-surface-container-lowest rounded-xl overflow-hidden ghost-shadow">
        <section className="hidden md:flex flex-col justify-between p-12 bg-surface-container-low relative overflow-hidden">
          <div className="relative z-10">
            <div className="mb-12">
              <AutoMatixLogo className="h-16 w-80" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight leading-[1.1] text-on-surface mb-6">
              Gestion institucional <br />
              fluida para <br />
              <span className="text-primary">escala empresarial.</span>
            </h1>
            <p className="text-on-surface-variant max-w-sm leading-relaxed">
              Acceda a su tablero de campanas con seguridad profesional y analitica precisa.
            </p>
          </div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        </section>
        <section className="flex flex-col justify-center p-8 md:p-16 bg-surface-container-lowest">
          <div className="max-w-md mx-auto w-full">
            <div className="flex md:hidden items-center mb-10">
              <AutoMatixLogo className="h-10 w-48" showSubtitle={false} />
            </div>
            <div className="mb-10">
              <h2 className="text-2xl font-semibold text-on-surface mb-2">Bienvenido de vuelta</h2>
              <p className="text-on-surface-variant text-sm">
                Ingrese sus credenciales para acceder al portal.
              </p>
            </div>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label
                  className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="bankSlug"
                >
                  Banco (slug)
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 text-on-surface text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline-variant"
                    id="bankSlug"
                    name="bankSlug"
                    placeholder="banco-andino"
                    type="text"
                    value={bankSlug}
                    onChange={(event) => setBankSlug(event.target.value)}
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant text-lg">
                    domain
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="email"
                >
                  Email institucional
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 text-on-surface text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline-variant"
                    id="email"
                    name="email"
                    placeholder="nombre@organizacion.com"
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant text-lg">
                    alternate_email
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label
                    className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                    htmlFor="password"
                  >
                    Contrasena
                  </label>
                  <a
                    className="text-xs font-medium text-primary hover:text-primary-dim transition-colors"
                    href="/reset-password"
                  >
                    Olvidaste el acceso?
                  </a>
                </div>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 text-on-surface text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline-variant"
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant text-lg">
                    lock
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <input
                  className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-outline-variant/30 bg-surface-container-low"
                  id="remember"
                  type="checkbox"
                />
                <label className="text-sm text-on-surface-variant" htmlFor="remember">
                  Mantener sesion por 24 horas
                </label>
              </div>
              {error ? (
                <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
                  {error}
                </div>
              ) : null}
              <button
                className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Ingresando...' : 'Ingresar al panel'}
              </button>
            </form>
            <div className="mt-12 pt-8 border-t border-outline-variant/10 text-center">
              <p className="text-sm text-on-surface-variant mb-4">
                Protegido con cifrado de nivel empresarial
              </p>
              <div className="flex justify-center gap-6">
                <div className="flex items-center gap-1.5 grayscale opacity-60">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Cumple PCI</span>
                </div>
                <div className="flex items-center gap-1.5 grayscale opacity-60">
                  <span className="material-symbols-outlined text-sm">enhanced_encryption</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">SSL 256-bit</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer className="fixed bottom-6 w-full flex justify-center gap-8 px-6 text-[11px] font-medium uppercase tracking-[0.1em] text-outline">
        <a className="hover:text-on-surface transition-colors" href="#">
          Terminos de servicio
        </a>
        <a className="hover:text-on-surface transition-colors" href="#">
          Privacidad
        </a>
        <a className="hover:text-on-surface transition-colors" href="#">
          Centro de soporte
        </a>
      </footer>
    </main>
  );
}
