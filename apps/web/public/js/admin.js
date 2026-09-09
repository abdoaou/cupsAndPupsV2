import {
  clearAuth,
  getUser,
  saveUser,
  api,
  canManageProducts,
  canManageMenu,
  canViewDashboard,
} from '/js/api.js';

const ADMIN_ROLES = ['ADMIN', 'MANAGER', 'INVENTORY', 'BARISTA'];

export async function ensureAdminUser() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  let user = getUser();
  if (user?.role && ADMIN_ROLES.includes(user.role)) return user;

  try {
    user = await api('/me');
    saveUser(user);
    return user;
  } catch {
    clearAuth();
    return null;
  }
}

export async function requireAdmin({
  products = false,
  dashboard = false,
  menu = false,
} = {}) {
  const user = await ensureAdminUser();

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    window.location.href = '/admin/login';
    return null;
  }

  if (products && !canManageProducts(user)) {
    window.location.href = '/admin';
    return null;
  }

  if (menu && !canManageMenu(user)) {
    window.location.href = '/admin';
    return null;
  }

  if (dashboard && !canViewDashboard(user)) {
    window.location.href = canManageMenu(user)
      ? '/admin/menu'
      : '/admin/products';
    return null;
  }

  return user;
}

export function mountAdminChrome(active = 'dashboard') {
  const user = getUser();
  const nav = document.getElementById('admin-nav');
  const who = document.getElementById('admin-who');

  if (who && user) {
    who.textContent = `${user.firstName || ''} ${user.lastName || ''} · ${user.role}`;
  }

  if (nav) {
    const links = [];
    if (canViewDashboard(user)) {
      links.push({ href: '/admin', id: 'dashboard', label: 'Dashboard' });
      links.push({ href: '/admin/bookings', id: 'bookings', label: 'Bookings' });
    }
    if (canManageMenu(user)) {
      links.push({ href: '/admin/menu', id: 'menu', label: 'Café menu' });
    }
    if (canManageProducts(user)) {
      links.push({ href: '/admin/products', id: 'products', label: 'Products' });
    }
    links.push({ href: '/', id: 'storefront', label: 'Storefront' });

    nav.innerHTML = links
      .map(
        (link) =>
          `<a href="${link.href}" class="${link.id === active ? 'active' : ''}">${link.label}</a>`,
      )
      .join('');
  }

  const logout = document.getElementById('admin-logout');
  if (logout) {
    logout.addEventListener('click', () => {
      clearAuth();
      window.location.href = '/admin/login';
    });
  }
}

export function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

export function formatWhen(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function statusClass(status) {
  return `status status-${String(status || '').toLowerCase()}`;
}

export function showAdminLoadError(targets, err) {
  const message = err?.message || 'Could not load data';
  const nodes = Array.isArray(targets) ? targets : [targets];
  nodes.forEach((el) => {
    if (!el) return;
    if (el.tagName === 'TBODY') {
      const cols = el.closest('table')?.querySelectorAll('thead th').length || 1;
      el.innerHTML = `<tr><td colspan="${cols}" class="empty error">${message}. <a href="/admin/login">Sign in again</a></td></tr>`;
    } else {
      el.innerHTML = `<p class="empty error">${message}. <a href="/admin/login">Sign in again</a></p>`;
    }
  });
}
