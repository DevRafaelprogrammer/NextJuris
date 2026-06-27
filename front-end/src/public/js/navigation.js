document.addEventListener('DOMContentLoaded', () => {
  const app = document.querySelector('.nj-app');
  const overlay = document.querySelector('.nj-mobile-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const themeBtn = document.getElementById('theme-toggle');
  const searchInput = document.getElementById('global-search');

  document.querySelectorAll('.nj-nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      NJRouter.navigate(item.dataset.page);
    });
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-nav]');
    if (link) {
      e.preventDefault();
      NJRouter.navigate(link.dataset.nav);
    }
  });

  window.addEventListener('popstate', (e) => {
    const page = e.state?.page || NJRouter.getPageFromHash();
    NJRouter.navigate(page, { silent: true, skipHistory: true });
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        app.classList.toggle('mobile-open');
      } else {
        app.classList.toggle('sidebar-collapsed');
        localStorage.setItem('nj-sidebar', app.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
      }
    });
  }

  if (overlay) overlay.addEventListener('click', () => app.classList.remove('mobile-open'));

  const savedSidebar = localStorage.getItem('nj-sidebar');
  if (savedSidebar === 'collapsed' && window.innerWidth > 768) {
    app.classList.add('sidebar-collapsed');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('nj-theme', next);
      themeBtn.querySelector('i').className = next === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    });
  }

  const savedTheme = localStorage.getItem('nj-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeBtn) themeBtn.querySelector('i').className = savedTheme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
  }

  document.querySelectorAll('.nj-nav-group-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      const submenu = toggle.nextElementSibling;
      if (submenu) submenu.classList.toggle('open', !expanded);
    });
  });

  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      NJCommandPalette.open();
      searchInput.blur();
    });
  }

  NJRouter.navigate(NJRouter.getPageFromHash(), { silent: true });
});
