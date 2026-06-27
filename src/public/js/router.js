const NJRouter = (() => {
  const routes = new Map();
  const hooks = { before: [], after: [] };
  let currentRoute = null;
  let previousRoute = null;
  const routeHistory = [];

  const routeRegistry = {
    painel:            { title: 'Painel de controle', subtitle: 'Visao geral do sistema e metricas de desempenho.', eyebrow: 'Visao geral', breadcrumb: ['Painel'], icon: 'ti-layout-dashboard', group: 'principal', keywords: ['dashboard', 'inicio', 'home', 'painel'] },
    relatorios:        { title: 'Relatorios juridicos', subtitle: 'Gerencie e gere relatorios com inteligencia artificial.', eyebrow: 'Documentos', breadcrumb: ['Relatorios'], icon: 'ti-file-text', group: 'principal', keywords: ['relatorio', 'documento', 'gerar', 'parecer'] },
    'novo-relatorio':  { title: 'Novo relatorio', subtitle: 'Selecione o tipo e parametros do relatorio a ser gerado.', eyebrow: 'Gerar relatorio', breadcrumb: ['Relatorios', 'Novo relatorio'], icon: 'ti-plus', group: 'geracao-ia', parent: 'relatorios', keywords: ['novo', 'criar', 'gerar relatorio'] },
    modelos:           { title: 'Modelos de relatorio', subtitle: 'Templates e modelos predefinidos disponiveis.', eyebrow: 'Templates', breadcrumb: ['Relatorios', 'Modelos'], icon: 'ti-template', group: 'geracao-ia', parent: 'relatorios', keywords: ['modelo', 'template', 'predefinido'] },
    historico:         { title: 'Historico de geracoes', subtitle: 'Todos os relatorios gerados anteriormente.', eyebrow: 'Historico', breadcrumb: ['Relatorios', 'Historico'], icon: 'ti-history', group: 'geracao-ia', parent: 'relatorios', keywords: ['historico', 'anteriores', 'passado'] },
    processos:         { title: 'Processos ativos', subtitle: 'Acompanhe andamentos processuais em tempo real.', eyebrow: 'Processos', breadcrumb: ['Processos'], icon: 'ti-gavel', group: 'principal', keywords: ['processo', 'acao', 'judicial', 'andamento'] },
    clientes:          { title: 'Base de clientes', subtitle: 'Cadastro e gestao de clientes do escritorio.', eyebrow: 'Clientes', breadcrumb: ['Clientes'], icon: 'ti-users', group: 'principal', keywords: ['cliente', 'pessoa', 'cadastro', 'contato'] },
    analises:          { title: 'Analises e insights', subtitle: 'Metricas detalhadas e inteligencia de dados juridicos.', eyebrow: 'Inteligencia', breadcrumb: ['Analises'], icon: 'ti-chart-bar', group: 'gestao', keywords: ['analise', 'grafico', 'metrica', 'insight', 'estatistica'] },
    agenda:            { title: 'Agenda e prazos', subtitle: 'Controle de audiencias, prazos e compromissos.', eyebrow: 'Calendario', breadcrumb: ['Agenda'], icon: 'ti-calendar', group: 'gestao', keywords: ['agenda', 'prazo', 'audiencia', 'calendario', 'compromisso'] },
    financeiro:        { title: 'Gestao financeira', subtitle: 'Honorarios, faturamento e controle financeiro.', eyebrow: 'Financeiro', breadcrumb: ['Financeiro'], icon: 'ti-currency-real', group: 'gestao', keywords: ['financeiro', 'honorario', 'faturamento', 'pagamento', 'receita'] },
    documentos:        { title: 'Repositorio de documentos', subtitle: 'Pecas, contratos e modelos armazenados com seguranca.', eyebrow: 'Documentos', breadcrumb: ['Documentos'], icon: 'ti-folder', group: 'gestao', keywords: ['documento', 'arquivo', 'contrato', 'peca', 'modelo'] },
    configuracoes:     { title: 'Configuracoes do sistema', subtitle: 'Preferencias, integracao e parametros gerais.', eyebrow: 'Sistema', breadcrumb: ['Configuracoes'], icon: 'ti-settings', group: 'sistema', keywords: ['configuracao', 'preferencia', 'sistema', 'perfil', 'integracao'] },
  };

  function register(id, meta) {
    routes.set(id, { ...routeRegistry[id], ...meta });
  }

  function getMeta(id) {
    return routes.get(id) || routeRegistry[id] || null;
  }

  function getAllRoutes() {
    const all = {};
    for (const [id, meta] of Object.entries(routeRegistry)) {
      all[id] = routes.has(id) ? { ...meta, ...routes.get(id) } : meta;
    }
    return all;
  }

  function onBefore(fn) { hooks.before.push(fn); }
  function onAfter(fn) { hooks.after.push(fn); }

  function navigate(pageId, opts = {}) {
    const meta = getMeta(pageId);
    if (!meta) return false;

    for (const fn of hooks.before) {
      if (fn(pageId, meta, currentRoute) === false) return false;
    }

    previousRoute = currentRoute;
    currentRoute = pageId;
    if (!opts.skipHistory) {
      routeHistory.push(pageId);
      if (routeHistory.length > 50) routeHistory.shift();
    }

    document.querySelectorAll('.nj-page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) {
      target.classList.add('active');
      target.style.animation = 'none';
      target.offsetHeight;
      target.style.animation = '';
    }

    document.querySelectorAll('.nj-nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageId);
    });

    if (meta.parent) {
      const parentItem = document.querySelector(`.nj-nav-item[data-page="${meta.parent}"]`);
      if (parentItem) parentItem.classList.add('active');
    }

    updateBreadcrumb(pageId, meta);
    updatePageHeader(meta);
    updateActiveIndicators(pageId);

    if (!opts.silent) {
      history.pushState({ page: pageId }, '', '#' + pageId);
    }

    document.title = `NextJuris — ${meta.title}`;

    if (window.innerWidth <= 768) {
      document.querySelector('.nj-app')?.classList.remove('mobile-open');
    }

    for (const fn of hooks.after) fn(pageId, meta, previousRoute);

    return true;
  }

  function updateBreadcrumb(pageId, meta) {
    const container = document.getElementById('breadcrumb-trail');
    if (!container) return;

    const crumbs = meta.breadcrumb || [meta.title];
    let html = `<a class="nj-breadcrumb-item" data-nav="painel" href="#painel">
      <i class="ti ti-home" style="font-size:14px" aria-hidden="true"></i>
    </a>`;

    crumbs.forEach((label, i) => {
      html += `<i class="ti ti-chevron-right nj-breadcrumb-sep" aria-hidden="true"></i>`;
      if (i < crumbs.length - 1) {
        const parentId = findRouteByTitle(label);
        html += `<a class="nj-breadcrumb-item" data-nav="${parentId}" href="#${parentId}">${label}</a>`;
      } else {
        html += `<span class="nj-breadcrumb-item current">${label}</span>`;
      }
    });

    container.innerHTML = html;
    container.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.nav);
      });
    });
  }

  function findRouteByTitle(title) {
    for (const [id, meta] of Object.entries(routeRegistry)) {
      if (meta.breadcrumb && meta.breadcrumb[0] === title && meta.breadcrumb.length === 1) return id;
    }
    return 'painel';
  }

  function updatePageHeader(meta) {
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const eyebrow = document.getElementById('page-eyebrow');
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
    if (eyebrow) {
      const textNode = eyebrow.childNodes[eyebrow.childNodes.length - 1];
      if (textNode) textNode.textContent = ' ' + meta.eyebrow;
    }
  }

  function updateActiveIndicators(pageId) {
    document.querySelectorAll('.nj-quick-link').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === pageId);
    });
  }

  function back() {
    if (routeHistory.length > 1) {
      routeHistory.pop();
      const prev = routeHistory[routeHistory.length - 1];
      navigate(prev, { skipHistory: true });
      return true;
    }
    return false;
  }

  function getPageFromHash() {
    const hash = window.location.hash.slice(1);
    return hash && routeRegistry[hash] ? hash : 'painel';
  }

  function search(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results = [];
    for (const [id, meta] of Object.entries(routeRegistry)) {
      const score = calculateScore(q, id, meta);
      if (score > 0) results.push({ id, meta, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  function calculateScore(query, id, meta) {
    let score = 0;
    if (id.includes(query)) score += 10;
    if (meta.title.toLowerCase().includes(query)) score += 8;
    if (meta.keywords?.some(k => k.includes(query))) score += 6;
    if (meta.eyebrow.toLowerCase().includes(query)) score += 4;
    if (meta.subtitle.toLowerCase().includes(query)) score += 2;
    return score;
  }

  function getRelated(pageId) {
    const meta = getMeta(pageId);
    if (!meta) return [];
    const related = [];
    for (const [id, m] of Object.entries(routeRegistry)) {
      if (id === pageId) continue;
      if (m.group === meta.group) related.push({ id, ...m, reason: 'Mesmo modulo' });
      else if (m.parent === pageId) related.push({ id, ...m, reason: 'Sub-pagina' });
      else if (meta.parent === id) related.push({ id, ...m, reason: 'Pagina pai' });
    }
    return related.slice(0, 5);
  }

  function getQuickActions(pageId) {
    const actions = {
      painel: [
        { label: 'Novo relatorio', icon: 'ti-plus', page: 'novo-relatorio' },
        { label: 'Ver processos', icon: 'ti-gavel', page: 'processos' },
        { label: 'Prazos proximos', icon: 'ti-calendar', page: 'agenda' },
      ],
      relatorios: [
        { label: 'Gerar relatorio', icon: 'ti-sparkles', page: 'novo-relatorio' },
        { label: 'Ver modelos', icon: 'ti-template', page: 'modelos' },
        { label: 'Historico', icon: 'ti-history', page: 'historico' },
      ],
      processos: [
        { label: 'Gerar relatorio', icon: 'ti-file-text', page: 'novo-relatorio' },
        { label: 'Ver agenda', icon: 'ti-calendar', page: 'agenda' },
        { label: 'Analises', icon: 'ti-chart-bar', page: 'analises' },
      ],
      clientes: [
        { label: 'Novo relatorio', icon: 'ti-plus', page: 'novo-relatorio' },
        { label: 'Ver processos', icon: 'ti-gavel', page: 'processos' },
        { label: 'Financeiro', icon: 'ti-currency-real', page: 'financeiro' },
      ],
    };
    return actions[pageId] || [
      { label: 'Ir ao painel', icon: 'ti-layout-dashboard', page: 'painel' },
      { label: 'Novo relatorio', icon: 'ti-plus', page: 'novo-relatorio' },
    ];
  }

  return {
    register, getMeta, getAllRoutes, navigate, back, search,
    getRelated, getQuickActions, onBefore, onAfter, getPageFromHash,
    get current() { return currentRoute; },
    get previous() { return previousRoute; },
    get history() { return [...routeHistory]; },
  };
})();
