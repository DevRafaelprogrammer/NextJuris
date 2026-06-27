const NJAuthGuard = (() => {
  const PUBLIC_PATHS = ['/auth', '/auth/login', '/auth/register', '/auth/forgot'];

  function isPublicPath() {
    return PUBLIC_PATHS.includes(window.location.pathname);
  }

  function redirectToLogin() {
    const returnTo = window.location.pathname + window.location.hash;
    if (returnTo !== '/' && returnTo !== '/auth') {
      sessionStorage.setItem('nj_return_to', returnTo);
    }
    window.location.href = '/auth#login';
  }

  function redirectToApp() {
    const returnTo = sessionStorage.getItem('nj_return_to') || '/';
    sessionStorage.removeItem('nj_return_to');
    window.location.href = returnTo;
  }

  function updateUI() {
    const user = NJApi.user;
    if (!user) return;

    document.querySelectorAll('.nj-sidebar-user-name').forEach(el => {
      el.textContent = user.full_name || user.fullName || '';
    });
    document.querySelectorAll('.nj-sidebar-user-role').forEach(el => {
      const oab = user.oab_number && user.oab_state ? `OAB/${user.oab_state} ${user.oab_number}` : user.role;
      el.textContent = oab;
    });
    document.querySelectorAll('.nj-sidebar-avatar').forEach(el => {
      const name = user.full_name || user.fullName || '';
      el.textContent = name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    });

    document.querySelectorAll('[data-bind="user-name"]').forEach(el => el.textContent = user.full_name || '');
    document.querySelectorAll('[data-bind="user-email"]').forEach(el => el.textContent = user.email || '');
    document.querySelectorAll('[data-bind="user-role"]').forEach(el => el.textContent = user.role || '');
  }

  function init() {
    if (isPublicPath()) {
      if (NJApi.isAuthenticated) redirectToApp();
      return;
    }

    if (!NJApi.isAuthenticated) {
      redirectToLogin();
      return;
    }

    updateUI();

    NJApi.on('auth', (user) => {
      if (!user && !isPublicPath()) redirectToLogin();
    });

    NJApi.on('user', updateUI);

    NJApi.auth.me().catch(() => {});

    const logoutLinks = document.querySelectorAll('a[href="/logout"]');
    logoutLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        NJApi.auth.logout();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { redirectToLogin, redirectToApp, updateUI, isPublicPath };
})();
