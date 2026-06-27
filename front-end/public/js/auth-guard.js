const NJAuthGuard = (() => {
  const PUBLIC_PATHS = ['/auth', '/auth/login', '/auth/register', '/auth/forgot'];

  function isPublicPath() {
    return PUBLIC_PATHS.includes(window.location.pathname);
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getUserFromCookie() {
    const raw = getCookie('nj_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function hasAuthCookie() {
    return !!getCookie('nj_user');
  }

  function redirectToLogin() {
    const returnTo = window.location.pathname + window.location.hash;
    if (returnTo !== '/' && returnTo !== '/auth') sessionStorage.setItem('nj_return_to', returnTo);
    window.location.href = '/auth#login';
  }

  function redirectToApp() {
    const returnTo = sessionStorage.getItem('nj_return_to') || '/';
    sessionStorage.removeItem('nj_return_to');
    window.location.href = returnTo;
  }

  function hasPermission(permission) {
    const user = getUserFromCookie() || NJApi?.user;
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  }

  function hasRole(...roles) {
    const user = getUserFromCookie() || NJApi?.user;
    if (!user) return false;
    return roles.includes(user.role);
  }

  function isAdmin() {
    return hasRole('admin');
  }

  function applyRoleVisibility() {
    const user = getUserFromCookie() || NJApi?.user;
    if (!user) return;

    document.querySelectorAll('[data-require-role]').forEach(el => {
      const roles = el.dataset.requireRole.split(',').map(r => r.trim());
      el.style.display = roles.includes(user.role) ? '' : 'none';
    });

    document.querySelectorAll('[data-require-permission]').forEach(el => {
      const perms = el.dataset.requirePermission.split(',').map(p => p.trim());
      const userPerms = user.permissions || [];
      const hasAll = perms.every(p => userPerms.includes(p));
      el.style.display = hasAll ? '' : 'none';
    });

    document.querySelectorAll('[data-hide-role]').forEach(el => {
      const roles = el.dataset.hideRole.split(',').map(r => r.trim());
      el.style.display = roles.includes(user.role) ? 'none' : '';
    });

    document.querySelectorAll('[data-min-role]').forEach(el => {
      const hierarchy = { admin: 100, socio: 80, advogado: 60, associado: 50, paralegal: 40, secretaria: 30, estagiario: 20, cliente: 10 };
      const minLevel = hierarchy[el.dataset.minRole] || 0;
      const userLevel = hierarchy[user.role] || 0;
      el.style.display = userLevel >= minLevel ? '' : 'none';
    });
  }

  function updateUI() {
    const user = getUserFromCookie() || NJApi?.user;
    if (!user) return;

    document.querySelectorAll('.nj-sidebar-user-name').forEach(el => {
      el.textContent = user.full_name || '';
    });
    document.querySelectorAll('.nj-sidebar-user-role').forEach(el => {
      el.textContent = user.oab_number && user.oab_state ? `OAB/${user.oab_state} ${user.oab_number}` : user.role;
    });
    document.querySelectorAll('.nj-sidebar-avatar').forEach(el => {
      const name = user.full_name || '';
      el.textContent = name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    });

    document.querySelectorAll('[data-bind="user-name"]').forEach(el => el.textContent = user.full_name || '');
    document.querySelectorAll('[data-bind="user-email"]').forEach(el => el.textContent = user.email || '');
    document.querySelectorAll('[data-bind="user-role"]').forEach(el => {
      const labels = { admin: 'Administrador', socio: 'Socio', advogado: 'Advogado', associado: 'Associado', paralegal: 'Paralegal', secretaria: 'Secretaria', estagiario: 'Estagiario', cliente: 'Cliente' };
      el.textContent = labels[user.role] || user.role;
    });

    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
      const colors = { admin: 'danger', socio: 'gold', advogado: 'success', estagiario: 'muted' };
      roleBadge.className = `nj-badge nj-badge-${colors[user.role] || 'muted'}`;
      const labels = { admin: 'Admin', socio: 'Socio', advogado: 'Advogado', associado: 'Associado', estagiario: 'Estagiario', secretaria: 'Secretaria', paralegal: 'Paralegal', cliente: 'Cliente' };
      roleBadge.textContent = labels[user.role] || user.role;
    }

    applyRoleVisibility();
  }

  function init() {
    if (isPublicPath()) {
      if (hasAuthCookie() || NJApi?.isAuthenticated) redirectToApp();
      return;
    }

    if (!hasAuthCookie() && !NJApi?.isAuthenticated) {
      redirectToLogin();
      return;
    }

    updateUI();

    NJApi?.on('auth', (user) => {
      if (!user && !isPublicPath()) redirectToLogin();
    });

    NJApi?.on('user', () => { updateUI(); });

    NJApi?.auth.me().then(() => updateUI()).catch(() => {});

    document.querySelectorAll('a[href="/logout"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        NJApi?.auth.logout();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { redirectToLogin, redirectToApp, updateUI, isPublicPath, hasPermission, hasRole, isAdmin, applyRoleVisibility };
})();
