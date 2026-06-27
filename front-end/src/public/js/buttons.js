const NJButton = (() => {

  function create(opts = {}) {
    const {
      label = '',
      variant = 'secondary',
      size = 'md',
      icon = '',
      iconRight = '',
      pill = false,
      uppercase = false,
      block = false,
      disabled = false,
      loading = false,
      count = null,
      dot = '',
      nav = '',
      href = '',
      type = 'button',
      className = '',
      onClick = null,
    } = opts;

    const isLink = href || nav;
    const el = document.createElement(isLink ? 'a' : 'button');

    const classes = ['nj-btn', `nj-btn-${variant}`, `nj-btn-${size}`];
    if (pill) classes.push('nj-btn-pill');
    if (uppercase) classes.push('nj-btn-uppercase');
    if (block) classes.push('nj-btn-block');
    if (!label && (icon || iconRight)) classes.push('nj-btn-icon-only');
    if (loading) classes.push('nj-btn-loading');
    if (className) classes.push(className);
    el.className = classes.join(' ');

    if (!isLink) el.type = type;
    if (disabled) el.disabled = true;
    if (nav) el.dataset.nav = nav;
    if (href) el.href = href;
    if (!label && icon) el.setAttribute('aria-label', opts.ariaLabel || 'Botao');

    let inner = '';
    if (loading) inner += '<span class="nj-btn-spinner"></span>';
    if (icon && !loading) inner += `<i class="ti ${icon}" aria-hidden="true"></i>`;
    if (dot) inner += `<span class="nj-btn-dot nj-btn-dot-${dot}"></span>`;
    if (label) inner += `<span class="nj-btn-label">${label}</span>`;
    if (count !== null) inner += `<span class="nj-btn-count"><span>${count}</span></span>`;
    if (iconRight) inner += `<i class="ti ${iconRight}" aria-hidden="true"></i>`;
    el.innerHTML = inner;

    if (onClick) el.addEventListener('click', onClick);

    el.addEventListener('click', (e) => {
      if (el.disabled || el.classList.contains('nj-btn-loading')) return;
      createRipple(el, e);
    });

    return el;
  }

  function createRipple(btn, e) {
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'nj-btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  function setLoading(btn, loading, loadingLabel) {
    if (loading) {
      btn.classList.add('nj-btn-loading');
      btn.dataset.originalHtml = btn.innerHTML;
      const label = btn.querySelector('.nj-btn-label');
      if (label && loadingLabel) label.textContent = loadingLabel;
      const existingSpinner = btn.querySelector('.nj-btn-spinner');
      if (!existingSpinner) {
        const spinner = document.createElement('span');
        spinner.className = 'nj-btn-spinner';
        btn.prepend(spinner);
      }
    } else {
      btn.classList.remove('nj-btn-loading');
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  function createGroup(buttons, opts = {}) {
    const { vertical = false, className = '' } = opts;
    const group = document.createElement('div');
    group.className = vertical ? 'nj-btn-group-vertical' : 'nj-btn-group';
    if (className) group.classList.add(className);
    buttons.forEach(btnOpts => {
      const btn = create({ variant: 'secondary', size: 'sm', ...btnOpts });
      group.appendChild(btn);
    });
    return group;
  }

  function createSplit(mainOpts, dropdownOpts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'nj-btn-split';
    wrap.appendChild(create(mainOpts));
    wrap.appendChild(create({
      variant: mainOpts.variant || 'secondary',
      size: mainOpts.size || 'md',
      icon: 'ti-chevron-down',
      ariaLabel: 'Mais opcoes',
      ...dropdownOpts,
    }));
    return wrap;
  }

  function createToggleGroup(options, opts = {}) {
    const { activeIndex = 0, onChange = null } = opts;
    const group = document.createElement('div');
    group.className = 'nj-toggle-group';
    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'nj-toggle-btn' + (i === activeIndex ? ' active' : '');
      btn.type = 'button';
      let html = '';
      if (opt.icon) html += `<i class="ti ${opt.icon}" aria-hidden="true"></i>`;
      if (opt.label) html += opt.label;
      btn.innerHTML = html;
      btn.addEventListener('click', () => {
        group.querySelectorAll('.nj-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onChange) onChange(i, opt);
      });
      group.appendChild(btn);
    });
    return group;
  }

  function createChip(opts = {}) {
    const { label = '', icon = '', active = false, removable = false, onRemove = null, onClick = null } = opts;
    const chip = document.createElement('span');
    chip.className = 'nj-chip' + (active ? ' active' : '');
    let html = '';
    if (icon) html += `<i class="ti ${icon}" aria-hidden="true"></i>`;
    html += label;
    if (removable) html += `<button class="nj-chip-close" aria-label="Remover"><i class="ti ti-x"></i></button>`;
    chip.innerHTML = html;
    if (onClick) chip.addEventListener('click', onClick);
    if (removable) {
      chip.querySelector('.nj-chip-close').addEventListener('click', (e) => {
        e.stopPropagation();
        if (onRemove) onRemove(chip);
        else chip.remove();
      });
    }
    return chip;
  }

  function createChipGroup(chips) {
    const group = document.createElement('div');
    group.className = 'nj-chip-group';
    chips.forEach(c => group.appendChild(createChip(c)));
    return group;
  }

  function init() {
    document.querySelectorAll('.nj-toggle-group').forEach(group => {
      group.querySelectorAll('.nj-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.nj-toggle-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    });

    document.querySelectorAll('.nj-btn-group').forEach(group => {
      group.querySelectorAll('.nj-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (group.dataset.toggle === 'true') {
            group.querySelectorAll('.nj-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          }
        });
      });
    });

    document.querySelectorAll('.nj-chip').forEach(chip => {
      const closeBtn = chip.querySelector('.nj-chip-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          chip.remove();
        });
      }
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.nj-btn:not(.nj-btn-loading):not(:disabled)');
      if (btn) createRipple(btn, e);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { create, setLoading, createGroup, createSplit, createToggleGroup, createChip, createChipGroup };
})();
