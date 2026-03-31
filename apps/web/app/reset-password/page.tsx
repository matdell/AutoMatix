'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AutoMatixLogo from '@/app/_components/AutoMatixLogo';
import { apiJson } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [bankSlug, setBankSlug] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiJson('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          bankSlug: bankSlug.trim() || undefined,
        }),
      });
      setMessage('Si el email existe, enviaremos un link para restablecer la contraseña.');
      setEmail('');
      setBankSlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiJson('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });
      setMessage('Contraseña actualizada. Ya podes iniciar sesion.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-surface text-on-surface flex min-h-screen items-center justify-center p-6 selection:bg-primary-container selection:text-on-primary-container">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl p-8 shadow-[0px_12px_32px_rgba(42,52,57,0.08)]">
        <div className="mb-8 flex items-center justify-center">
          <AutoMatixLogo className="h-10 w-48" showSubtitle={false} />
        </div>
        <h1 className="text-xl font-semibold text-on-surface mb-2">
          {token ? 'Restablecer contraseña' : 'Recuperar acceso'}
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          {token
            ? 'Ingresa una nueva contraseña para tu cuenta.'
            : 'Te enviaremos un correo con el link para restablecer tu contraseña.'}
        </p>

        {message ? (
          <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl mb-4">{message}</div>
        ) : null}
        {error ? (
          <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl mb-4">{error}</div>
        ) : null}

        {token ? (
          <form className="space-y-4" onSubmit={resetPassword}>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Nueva contraseña
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Confirmar contraseña
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>
            <button
              className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={requestReset}>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Email institucional
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Banco (slug) opcional
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                type="text"
                value={bankSlug}
                onChange={(event) => setBankSlug(event.target.value)}
                placeholder="banco-andino"
              />
            </div>
            <button
              className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperacion'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
