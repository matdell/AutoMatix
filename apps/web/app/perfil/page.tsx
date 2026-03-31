'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/_components/AppShell';
import { apiJson, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

type UserProfile = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  tenantId: string;
  merchantId?: string | null;
  lastLoginAt?: string | null;
  twoFactorEmailEnabled?: boolean;
  twoFactorTotpEnabled?: boolean;
};

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [twoFactorEmailEnabled, setTwoFactorEmailEnabled] = useState(false);
  const [twoFactorTotpEnabled, setTwoFactorTotpEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);
  const [totpSetup, setTotpSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUrl, setTotpUrl] = useState('');
  const [totpQr, setTotpQr] = useState('');
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError(null);
    apiJson<UserProfile>('/auth/me')
      .then((data) => {
        setUser(data);
        setNombre(data.nombre || '');
        setEmail(data.email || '');
        setTwoFactorEmailEnabled(Boolean(data.twoFactorEmailEnabled));
        setTwoFactorTotpEnabled(Boolean(data.twoFactorTotpEnabled));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil');
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!totpUrl) {
      setTotpQr('');
      return;
    }
    QRCode.toDataURL(totpUrl)
      .then((url) => setTotpQr(url))
      .catch(() => setTotpQr(''));
  }, [totpUrl]);

  const onSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);
    try {
      const updated = await apiJson<UserProfile>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
        }),
      });
      setUser(updated);
      window.localStorage.setItem('user', JSON.stringify(updated));
      setProfileSuccess('Perfil actualizado');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contrasenas no coinciden');
      return;
    }
    setSavingPassword(true);
    try {
      await apiJson('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Contrasena actualizada');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo actualizar la contrasena');
    } finally {
      setSavingPassword(false);
    }
  };

  const updateEmail2fa = async (enabled: boolean) => {
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    setTwoFactorLoading(true);
    try {
      const updated = await apiJson<{ twoFactorEmailEnabled: boolean; twoFactorTotpEnabled: boolean }>('/auth/2fa/email', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setTwoFactorEmailEnabled(updated.twoFactorEmailEnabled);
      setTwoFactorTotpEnabled(updated.twoFactorTotpEnabled);
      setTwoFactorSuccess(enabled ? '2FA por email activado.' : '2FA por email desactivado.');
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'No se pudo actualizar 2FA por email');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const startTotpSetup = async () => {
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    setTwoFactorLoading(true);
    try {
      const data = await apiJson<{ secret: string; otpauthUrl: string }>('/auth/2fa/totp/setup', {
        method: 'POST',
      });
      setTotpSecret(data.secret);
      setTotpUrl(data.otpauthUrl);
      setTotpSetup(true);
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'No se pudo iniciar la configuracion');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const verifyTotp = async () => {
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    if (!totpCode.trim()) {
      setTwoFactorError('Ingresa el codigo de verificacion');
      return;
    }
    setTwoFactorLoading(true);
    try {
      await apiJson('/auth/2fa/totp/verify', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode.trim() }),
      });
      setTwoFactorTotpEnabled(true);
      setTotpSetup(false);
      setTotpSecret('');
      setTotpUrl('');
      setTotpCode('');
      setTwoFactorSuccess('Google Authenticator activado.');
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'No se pudo validar el codigo');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disableTotp = async () => {
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    setTwoFactorLoading(true);
    try {
      await apiJson('/auth/2fa/totp/disable', { method: 'POST' });
      setTwoFactorTotpEnabled(false);
      setTotpSetup(false);
      setTotpSecret('');
      setTotpUrl('');
      setTotpCode('');
      setTwoFactorSuccess('Google Authenticator desactivado.');
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'No se pudo desactivar');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  return (
    <AppShell>

        <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/15 flex items-center justify-between px-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] font-['Inter'] antialiased tracking-tight">
          <div className="flex items-center space-x-8">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tighter">Perfil</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="material-symbols-outlined text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors active:scale-95">
              notifications
            </button>
            <button className="material-symbols-outlined text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors active:scale-95">
              settings
            </button>
          </div>
        </header>

        <div className="pt-24 px-8 pb-12 space-y-8">
          {loading ? (
            <div className="text-sm text-on-surface-variant">Cargando perfil...</div>
          ) : error ? (
            <div className="text-sm text-error">{error}</div>
          ) : user ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
              <form
                onSubmit={onSaveProfile}
                className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4"
              >
                <h3 className="text-lg font-semibold">Datos del perfil</h3>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Email</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs text-on-surface-variant">
                  <div className="bg-surface-container-low rounded-xl px-3 py-2">
                    <div className="uppercase tracking-widest text-[10px] font-semibold">Rol</div>
                    <div className="text-on-surface font-semibold mt-1">{user.role}</div>
                  </div>
                  <div className="bg-surface-container-low rounded-xl px-3 py-2">
                    <div className="uppercase tracking-widest text-[10px] font-semibold">Banco</div>
                    <div className="text-on-surface font-semibold mt-1">{user.tenantId}</div>
                  </div>
                </div>
                {profileError ? (
                  <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
                    {profileError}
                  </div>
                ) : null}
                {profileSuccess ? (
                  <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">
                    {profileSuccess}
                  </div>
                ) : null}
                <button
                  className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                  type="submit"
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>

              <form
                onSubmit={onChangePassword}
                className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4"
              >
                <h3 className="text-lg font-semibold">Cambiar contrasena</h3>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Contrasena actual</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Nueva contrasena</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Confirmar contrasena</label>
                  <input
                    className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
                {passwordError ? (
                  <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
                    {passwordError}
                  </div>
                ) : null}
                {passwordSuccess ? (
                  <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">
                    {passwordSuccess}
                  </div>
                ) : null}
                <button
                  className="w-full bg-surface-container-high text-on-surface font-medium py-3.5 rounded-xl hover:bg-surface-container-highest transition-all active:scale-[0.98]"
                  type="submit"
                  disabled={savingPassword}
                >
                  {savingPassword ? 'Actualizando...' : 'Actualizar contrasena'}
                </button>
              </form>

              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] space-y-4 lg:col-span-2">
                <div>
                  <h3 className="text-lg font-semibold">Seguridad 2FA</h3>
                  <p className="text-sm text-on-surface-variant">
                    Elige uno o ambos metodos para validar tu inicio de sesion.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Codigo por email</div>
                    <div className="text-xs text-slate-500">
                      Recibi un codigo temporal en tu email cada vez que inicies sesion.
                    </div>
                    <button
                      type="button"
                      className="mt-3 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300 disabled:opacity-60"
                      onClick={() => updateEmail2fa(!twoFactorEmailEnabled)}
                      disabled={twoFactorLoading}
                    >
                      {twoFactorEmailEnabled ? 'Desactivar email' : 'Activar email'}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Google Authenticator</div>
                    <div className="text-xs text-slate-500">
                      Usa una app de autenticacion para generar codigos.
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {twoFactorTotpEnabled ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-rose-600 hover:border-rose-200 disabled:opacity-60"
                          onClick={disableTotp}
                          disabled={twoFactorLoading}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:border-slate-300 disabled:opacity-60"
                          onClick={startTotpSetup}
                          disabled={twoFactorLoading}
                        >
                          Configurar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {totpSetup ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4 space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Configurar Google Authenticator</div>
                    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                      <div className="flex items-center justify-center rounded-xl bg-slate-50 p-4">
                        {totpQr ? (
                          <img src={totpQr} alt="QR Google Authenticator" className="h-40 w-40" />
                        ) : (
                          <div className="text-xs text-slate-500">Generando QR...</div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Codigo manual</div>
                          <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-mono text-slate-700">
                            {totpSecret || '---'}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                            Codigo de verificacion
                          </label>
                          <input
                            className="mt-2 w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm"
                            value={totpCode}
                            onChange={(event) => setTotpCode(event.target.value)}
                            placeholder="123456"
                          />
                        </div>
                        <button
                          type="button"
                          className="w-full primary-gradient text-white font-medium py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                          onClick={verifyTotp}
                          disabled={twoFactorLoading}
                        >
                          {twoFactorLoading ? 'Verificando...' : 'Activar Google Authenticator'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {twoFactorError ? (
                  <div className="text-sm text-error bg-error-container/30 px-4 py-3 rounded-xl">
                    {twoFactorError}
                  </div>
                ) : null}
                {twoFactorSuccess ? (
                  <div className="text-sm text-primary bg-primary-container/30 px-4 py-3 rounded-xl">
                    {twoFactorSuccess}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
    </AppShell>
  );
}
