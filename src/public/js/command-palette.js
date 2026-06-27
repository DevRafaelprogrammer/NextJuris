const NJCommandPalette = (() => {
  let overlay, modal, input, resultsList, selectedIndex;
  let isOpen = false;

  function create() {
    overlay = document.createElement('div');
    overlay.className = 'nj-cmd-overlay';
    overlay.addEventListener('click', close);

    modal = document.createElement('div');
    modal.className = 'nj-cmd-modal';
    modal.innerHTML = `
      <div class="nj-cmd-header">
        <i class="ti ti-search nj-cmd-search-icon" aria-hidden="true"></i>
        <input type="text" class="nj-cmd-input" placeholder="Buscar pagina, processo, cliente..." autocomplete="off" spellcheck="false">
        <kbd class="nj-cmd-kbd">Esc</kbd>
      </div>
      <div class="nj-cmd-body">
        <div class="nj-cmd-results"></div>
        <div class="nj-cmd-footer">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    input = modal.querySelector('.nj-cmd-input');
    resultsList = modal.querySelector('.nj-cmd-results');
    selectedIndex = -1;

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown);

    showDefaults();
  }

  function showDefaults() {
    const routes = NJRouter.getAllRoutes();
    const groups = {};
    for (const [id, meta] of Object.entries(routes)) {
      const g = meta.group || 'outros';
      if (!groups[g]) groups[g] = [];
      groups[g].push({ id, ...meta });
    }

    let html = '';
    const groupLabels = {
      'principal': 'Principal',
      'geracao-ia': 'Geracao IA',
      'gestao': 'Gestao',
      'sistema': 'Sistema',
    };

    for (const [group, items] of Object.entries(groups)) {
      html += `<div class="nj-cmd-group-label">${groupLabels[group] || group}</div>`;
      for (const item of items) {
        const isCurrent = NJRouter.current === item.id;
        html += `<div class="nj-cmd-item${isCurrent ? ' current' : ''}" data-page="${item.id}">
          <i class="ti ${item.icon}" aria-hidden="true"></i>
          <div class="nj-cmd-item-content">
            <span class="nj-cmd-item-title">${item.title}</span>
            <span class="nj-cmd-item-sub">${item.eyebrow}</span>
          </div>
          ${isCurrent ? '<span class="nj-cmd-item-badge">Atual</span>' : ''}
          <kbd class="nj-cmd-item-shortcut">#${item.id}</kbd>
        </div>`;
      }
    }
    resultsList.innerHTML = html;
    bindResults();
  }

  function onInput() {
    const q = input.value.trim();
    selectedIndex = -1;
    if (q.length < 2) { showDefaults(); return; }

    const results = NJRouter.search(q);
    if (results.length === 0) {
      resultsList.innerHTML = `<div class="nj-cmd-empty">
        <i class="ti ti-search-off" style="font-size:24px;color:var(--nj-text-muted)" aria-hidden="true"></i>
        <span>Nenhum resultado para "${q}"</span>
      </div>`;
      return;
    }

    let html = `<div class="nj-cmd-group-label">Resultados</div>`;
    results.forEach(r => {
      const highlighted = highlightMatch(r.meta.title, q);
      html += `<div class="nj-cmd-item" data-page="${r.id}">
        <i class="ti ${r.meta.icon}" aria-hidden="true"></i>
        <div class="nj-cmd-item-content">
          <span class="nj-cmd-item-title">${highlighted}</span>
          <span class="nj-cmd-item-sub">${r.meta.subtitle}</span>
        </div>
      </div>`;
    });
    resultsList.innerHTML = html;
    bindResults();
    selectItem(0);
  }

  function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) +
      `<mark class="nj-cmd-highlight">${text.slice(idx, idx + query.length)}</mark>` +
      text.slice(idx + query.length);
  }

  function onKeydown(e) {
    const items = resultsList.querySelectorAll('.nj-cmd-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectItem(Math.min(selectedIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectItem(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        const page = items[selectedIndex].dataset.page;
        close();
        NJRouter.navigate(page);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  }

  function selectItem(idx) {
    const items = resultsList.querySelectorAll('.nj-cmd-item');
    items.forEach(i => i.classList.remove('selected'));
    selectedIndex = idx;
    if (items[idx]) {
      items[idx].classList.add('selected');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function bindResults() {
    resultsList.querySelectorAll('.nj-cmd-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        close();
        NJRouter.navigate(item.dataset.page);
      });
      item.addEventListener('mouseenter', () => selectItem(i));
    });
  }

  function open() {
    if (!overlay) create();
    isOpen = true;
    overlay.classList.add('visible');
    input.value = '';
    selectedIndex = -1;
    showDefaults();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (!overlay) return;
    isOpen = false;
    overlay.classList.remove('visible');
  }

  function toggle() {
    isOpen ? close() : open();
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggle();
    }
  });

  return { open, close, toggle, get isOpen() { return isOpen; } };
})();
