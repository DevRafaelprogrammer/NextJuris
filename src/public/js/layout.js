document.addEventListener('DOMContentLoaded', () => {
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    const content = document.querySelector('.nj-content');
    if (content) {
      content.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', content.scrollTop > 300);
      });
      scrollBtn.addEventListener('click', () => {
        content.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  document.querySelectorAll('.nj-tabs-bar').forEach(bar => {
    const tabs = bar.querySelectorAll('.nj-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.dataset.tab;
        if (targetId) {
          const parent = bar.parentElement;
          if (parent) {
            parent.querySelectorAll('.nj-tab-panel').forEach(p => {
              p.style.display = p.id === targetId ? 'block' : 'none';
            });
          }
        }
      });
    });
  });

  document.querySelectorAll('.nj-panel-collapse-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.nj-panel');
      if (!panel) return;
      const body = panel.querySelector('.nj-panel-body');
      if (!body) return;
      const collapsed = body.style.display === 'none';
      body.style.display = collapsed ? '' : 'none';
      btn.querySelector('i').className = collapsed ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
    });
  });
});
