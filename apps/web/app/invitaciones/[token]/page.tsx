'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiJson } from '@/lib/api';

export default function InvitacionTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [merchantNombre, setMerchantNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cuit, setCuit] = useState('');
  const [merchantNumber, setMerchantNumber] = useState('');
  const [telefono, setTelefono] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onAccept = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await apiJson(`/invitations/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          email,
          password,
          merchantNombre,
          categoria: categoria || undefined,
          cuit: cuit || undefined,
          merchantNumber: merchantNumber || undefined,
          telefono: telefono || undefined,
        }),
      });
      setStatus('ok');
      setMessage('Invitacion aceptada. Ya podes iniciar sesion.');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'No se pudo aceptar la invitacion');
    } finally {
      setLoading(false);
    }
  };

  const onReject = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await apiJson(`/invitations/${token}/reject`, { method: 'POST' });
      setStatus('ok');
      setMessage('Invitacion rechazada.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'No se pudo rechazar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl p-8 shadow-[0px_12px_32px_rgba(42,52,57,0.06)]">
        <h1 className="text-2xl font-semibold text-on-surface mb-2">Aceptar invitacion</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Completa los datos para habilitar tu acceso.
        </p>

        <form onSubmit={onAccept} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="Nombre completo"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            required
          />
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
          />
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="Contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
          />
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="Nombre del comercio"
            value={merchantNombre}
            onChange={(event) => setMerchantNombre(event.target.value)}
            required
          />
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="Categoria"
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
          />
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="CUIT"
            value={cuit}
            onChange={(event) => setCuit(event.target.value)}
          />
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="Numero de comercio"
            value={merchantNumber}
            onChange={(event) => setMerchantNumber(event.target.value)}
          />
          <input
            className="bg-surface-container-low rounded-xl px-4 py-3 text-sm"
            placeholder="Telefono"
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
          />

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition"
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Aceptar invitacion'}
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface font-semibold hover:bg-surface-container-low transition"
              onClick={onReject}
              disabled={loading}
            >
              Rechazar
            </button>
          </div>
        </form>

        {message ? (
          <div
            className={`mt-6 text-sm rounded-xl px-4 py-3 ${
              status === 'ok'
                ? 'bg-primary-container text-on-primary-container'
                : status === 'error'
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-surface-container-low text-on-surface'
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}
