const NJPageLoader = (() => {
  let dashboardLoaded = false;

  async function loadDashboard() {
    if (dashboardLoaded) return;
    dashboardLoaded = true;

    try {
      const data = await NJApi.dashboard.overview();
      const o = data.overview;

      bindValue('stat-reports', o.totalReports);
      bindValue('stat-cases', o.totalCases);
      bindValue('stat-clients', o.totalClients);
      bindValue('stat-precision', o.iaPercentage + '%');

      bindValue('stat-reports-change', `+${Math.round(o.iaGenerated)} por IA`);
      bindValue('stat-value', 'R$ ' + (o.totalValue / 1000).toFixed(0) + 'k');

      const el = document.getElementById('hero-stat-reports');
      if (el) el.textContent = String(o.totalReports);
      const el2 = document.getElementById('hero-stat-precision');
      if (el2) el2.textContent = o.iaPercentage + '%';
    } catch (err) {
      console.warn('Dashboard load failed:', err.message);
    }

    try {
      const activity = await NJApi.dashboard.activity();
      const listEl = document.getElementById('activity-list');
      if (listEl && activity.recentReports?.length) {
        listEl.innerHTML = activity.recentReports.map(r => `
          <li class="nj-list-item" style="padding:10px 16px">
            <div class="nj-list-item-icon"><i class="ti ti-file-text" aria-hidden="true"></i></div>
            <div class="nj-list-item-content">
              <div class="nj-list-item-title">${esc(r.title)}</div>
              <div class="nj-list-item-sub">${esc(r.type)} · ${esc(r.status)}</div>
            </div>
            <div class="nj-list-item-meta">${timeAgo(r.created_at)}</div>
          </li>
        `).join('');
      }

      const deadlineEl = document.getElementById('deadline-list');
      if (deadlineEl && activity.upcomingDeadlines?.length) {
        deadlineEl.innerHTML = activity.upcomingDeadlines.map(e => `
          <div class="nj-timeline-item">
            <div class="nj-timeline-dot${e.priority === 'urgente' ? ' danger' : ''}"></div>
            <div class="nj-timeline-title">${esc(e.title)}</div>
            <div class="nj-timeline-desc"><span class="nj-badge nj-badge-${e.priority === 'urgente' ? 'danger' : 'gold'}">${daysLabel(e.date)}</span></div>
            <div class="nj-timeline-time"><i class="ti ti-clock" style="font-size:12px" aria-hidden="true"></i> ${formatDate(e.date)}</div>
          </div>
        `).join('');
      }
    } catch {}
  }

  async function loadReports() {
    try {
      const result = await NJApi.reports.list({ limit: 10, sort: 'createdAt', order: 'desc' });
      const tbody = document.getElementById('reports-tbody');
      if (!tbody || !result.data?.length) return;

      tbody.innerHTML = result.data.map(r => `
        <tr style="border-bottom:0.5px solid var(--nj-border)">
          <td style="padding:10px 8px">${esc(r.title)}</td>
          <td style="padding:10px 8px;color:var(--nj-text-secondary)">${esc(r.type)}</td>
          <td style="padding:10px 8px;color:var(--nj-text-muted)">${formatDate(r.created_at)}</td>
          <td style="padding:10px 8px;text-align:right"><span class="nj-badge nj-badge-${statusBadge(r.status)}">${esc(r.status)}</span></td>
        </tr>
      `).join('');
    } catch {}
  }

  async function loadCases() {
    try {
      const result = await NJApi.cases.list({ limit: 10 });
      const tbody = document.getElementById('cases-tbody');
      if (!tbody || !result.data?.length) return;

      tbody.innerHTML = result.data.map(c => `
        <tr style="border-bottom:0.5px solid var(--nj-border)">
          <td style="padding:10px 8px;font-family:monospace;font-size:12px">${esc(c.case_number)}</td>
          <td style="padding:10px 8px">${esc(c.parties)}</td>
          <td style="padding:10px 8px;color:var(--nj-text-secondary)">${esc(c.court)}</td>
          <td style="padding:10px 8px;text-align:right"><span class="nj-badge nj-badge-${phaseBadge(c.phase)}">${esc(c.phase)}</span></td>
        </tr>
      `).join('');
    } catch {}
  }

  async function loadClients() {
    try {
      const result = await NJApi.clients.list({ limit: 12, sort: 'name', order: 'asc' });
      const grid = document.getElementById('clients-grid');
      if (!grid || !result.data?.length) return;

      grid.innerHTML = result.data.map(c => {
        const initials = c.name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('');
        return `
          <div style="border:0.5px solid var(--nj-border);border-radius:6px;padding:16px;display:flex;align-items:center;gap:12px">
            <div class="nj-avatar nj-avatar-md">${initials}</div>
            <div>
              <div style="font-size:13px;font-weight:500">${esc(c.name)}</div>
              <div style="font-size:11px;color:var(--nj-text-muted)">${c.type === 'pessoa_fisica' ? 'PF' : 'PJ'} · ${esc(c.area || '')}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch {}
  }

  function bindValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  function daysLabel(iso) {
    const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'Atrasado';
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanha';
    return `${diff} dias`;
  }

  function statusBadge(s) {
    return { finalizado: 'gold', aprovado: 'success', revisao: 'danger', rascunho: 'muted', gerando: 'gold' }[s] || 'muted';
  }

  function phaseBadge(p) {
    return { instrucao: 'gold', recurso: 'danger', conciliacao: 'success', execucao: 'gold', conhecimento: 'muted', arquivado: 'muted' }[p] || 'muted';
  }

  function init() {
    if (typeof NJRouter !== 'undefined') {
      NJRouter.onAfter((pageId) => {
        if (pageId === 'painel') loadDashboard();
        if (pageId === 'relatorios') loadReports();
        if (pageId === 'processos') loadCases();
        if (pageId === 'clientes') loadClients();
      });
    }

    if (!NJAuthGuard.isPublicPath()) loadDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { loadDashboard, loadReports, loadCases, loadClients };
})();
