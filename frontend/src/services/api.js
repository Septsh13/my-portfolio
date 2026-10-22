const base = import.meta.env.VITE_API_URL || '';
let csrfToken = '';

export async function getCsrf() {
  const response = await fetch(`${base}/api/auth/csrf`, { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not start a secure session.');
  csrfToken = data.csrfToken;
  return csrfToken;
}

export function setCsrf(value) { csrfToken = value || ''; }

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) await getCsrf();
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(`${base}${path}`, { ...options, method, headers, credentials: 'include' });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data;
}
