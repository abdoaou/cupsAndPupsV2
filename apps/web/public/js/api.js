const API_BASE =
  typeof window !== 'undefined' &&
  typeof window.CUPS_API_URL === 'string' &&
  window.CUPS_API_URL.trim()
    ? window.CUPS_API_URL.replace(/\/$/, '')
    : 'http://localhost:4000/api/v1';

export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem('accessToken'));
}

export function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

export function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('authUser');
}

export function saveUser(user) {
  localStorage.setItem('authUser', JSON.stringify(user));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('authUser') || 'null');
  } catch {
    return null;
  }
}

let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        clearAuth();
        return false;
      }
      saveTokens(data);
      if (data.user) saveUser(data.user);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const hasBody = options.body != null;
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = localStorage.getItem('accessToken');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(apiUrl(path), { ...options, headers });

  if (res.status === 401 && !options._retry && path !== '/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return api(path, { ...options, _retry: true });
    }
    if (window.location.pathname.startsWith('/admin')) {
      window.location.href = '/admin/login';
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || 'Request failed';
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export function isStaffUser(user = getUser()) {
  if (!user?.role) return false;
  return ['ADMIN', 'MANAGER', 'INVENTORY', 'GROOMER', 'BARISTA'].includes(
    user.role,
  );
}

export function canManageProducts(user = getUser()) {
  return ['ADMIN', 'MANAGER', 'INVENTORY'].includes(user?.role);
}

export function canManageMenu(user = getUser()) {
  return ['ADMIN', 'MANAGER', 'BARISTA'].includes(user?.role);
}

export function canViewDashboard(user = getUser()) {
  return ['ADMIN', 'MANAGER'].includes(user?.role);
}
