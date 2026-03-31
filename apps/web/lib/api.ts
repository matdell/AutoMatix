export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('user');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

async function parseError(response: Response) {
  try {
    const data = await response.json();
    if (Array.isArray(data?.message)) {
      return data.message.join(', ');
    }
    return data?.message || 'Error inesperado';
  } catch {
    return 'Error inesperado';
  }
}

export async function apiJson<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await apiFetch(path, { ...options, headers });
  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function apiText(path: string, options: RequestInit = {}) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }
  return response.text();
}
