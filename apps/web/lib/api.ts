const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
const normalizedConfiguredApiUrl = configuredApiUrl.replace(/\/+$/, '');
const isLocalhostApiInProduction =
  process.env.NODE_ENV === 'production' &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(normalizedConfiguredApiUrl);

export const API_BASE_URL =
  normalizedConfiguredApiUrl && !isLocalhostApiInProduction
    ? normalizedConfiguredApiUrl
    : '/api';

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
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    if (typeof window !== 'undefined' && token) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw error;
  }
  if (typeof window !== 'undefined') {
    const nextToken = response.headers.get('x-access-token');
    if (nextToken) {
      setToken(nextToken);
    }
    if (response.status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }
  return response;
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
  if (response.status === 401) {
    throw new Error('');
  }
  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function apiText(path: string, options: RequestInit = {}) {
  const response = await apiFetch(path, options);
  if (response.status === 401) {
    throw new Error('');
  }
  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }
  return response.text();
}
