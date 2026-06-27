const NJToast = (() => {
  let container = null;
  let counter = 0;

  const icons = {
    success: 'ti-circle-check',
    error: 'ti-alert-circle',
    warning: 'ti-alert-triangle',
    info: 'ti-info-circle',
  };

  function ensureContainer() {
    if (container) return;
    container = document.createElement('div');
    container.id = 'nj-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'status');
    document.body.appendChild(container);

    const style = document.createElement('style');
    style.textContent = `
      #nj-toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 420px;
        pointer-events: none;
      }
      .nj-toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        line-height: 1.5;
        border: 0.5px solid;
        pointer-events: auto;
        transform: translateX(120%);
        opacity: 0;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
        cursor: pointer;
        max-width: 100%;
      }
      .nj-toast.visible {
        transform: translateX(0);
        opacity: 1;
      }
      .nj-toast.removing {
        transform: translateX(120%);
        opacity: 0;
      }
      .nj-toast-success {
        background: rgba(29, 158, 117, 0.08);
        border-color: rgba(29, 158, 117, 0.25);
        color: #1D9E75;
      }
      .nj-toast-error {
        background: rgba(192, 57, 43, 0.08);
        border-color: rgba(192, 57, 43, 0.25);
        color: #C0392B;
      }
      .nj-toast-warning {
        background: rgba(201, 170, 113, 0.1);
        border-color: rgba(201, 170, 113, 0.3);
        color: #B89A5F;
      }
      .nj-toast-info {
        background: rgba(143, 163, 177, 0.08);
        border-color: rgba(143, 163, 177, 0.25);
        color: #5A6673;
      }
      @media (prefers-color-scheme: dark) {
        .nj-toast-success { background: rgba(29, 158, 117, 0.15); color: #5DCAA5; }
        .nj-toast-error { background: rgba(192, 57, 43, 0.15); color: #F09595; }
        .nj-toast-warning { background: rgba(201, 170, 113, 0.12); color: #C9AA71; }
        .nj-toast-info { background: rgba(143, 163, 177, 0.12); color: #8FA3B1; }
      }
      .nj-toast i { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
      .nj-toast-body { flex: 1; min-width: 0; }
      .nj-toast-title { font-weight: 500; margin-bottom: 2px; }
      .nj-toast-message { opacity: 0.85; word-break: break-word; }
      .nj-toast-close {
        background: none; border: none; color: inherit; cursor: pointer;
        font-size: 14px; opacity: 0.5; padding: 0; flex-shrink: 0;
        transition: opacity 0.15s;
      }
      .nj-toast-close:hover { opacity: 1; }
      .nj-toast-progress {
        position: absolute; bottom: 0; left: 0; height: 2px;
        background: currentColor; opacity: 0.3; border-radius: 0 0 8px 8px;
        transition: width linear;
      }
      .nj-toast-actions { display: flex; gap: 8px; margin-top: 6px; }
      .nj-toast-action {
        background: none; border: 0.5px solid currentColor; color: inherit;
        padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 500;
        cursor: pointer; font-family: 'Inter', sans-serif; opacity: 0.7;
        transition: opacity 0.15s;
      }
      .nj-toast-action:hover { opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  function show(message, type = 'info', duration = 5000, opts = {}) {
    ensureContainer();
    const id = ++counter;
    const { title, actions, details } = opts;

    const toast = document.createElement('div');
    toast.className = `nj-toast nj-toast-${type}`;
    toast.style.position = 'relative';
    toast.dataset.toastId = String(id);

    let html = `<i class="ti ${icons[type] || icons.info}" aria-hidden="true"></i>`;
    html += '<div class="nj-toast-body">';
    if (title) html += `<div class="nj-toast-title">${esc(title)}</div>`;
    html += `<div class="nj-toast-message">${esc(message)}</div>`;
    if (details) html += `<div class="nj-toast-message" style="font-size:11px;margin-top:4px;opacity:0.7">${esc(details)}</div>`;
    if (actions?.length) {
      html += '<div class="nj-toast-actions">';
      actions.forEach((a, i) => {
        html += `<button class="nj-toast-action" data-action="${i}">${esc(a.label)}</button>`;
      });
      html += '</div>';
    }
    html += '</div>';
    html += '<button class="nj-toast-close" aria-label="Fechar"><i class="ti ti-x"></i></button>';
    if (duration > 0) html += '<div class="nj-toast-progress"></div>';
    toast.innerHTML = html;

    toast.querySelector('.nj-toast-close').addEventListener('click', (e) => { e.stopPropagation(); dismiss(id); });
    toast.addEventListener('click', () => dismiss(id));

    if (actions?.length) {
      toast.querySelectorAll('.nj-toast-action').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(btn.dataset.action);
          actions[idx]?.onClick?.();
          dismiss(id);
        });
      });
    }

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('visible');
      if (duration > 0) {
        const bar = toast.querySelector('.nj-toast-progress');
        if (bar) {
          bar.style.width = '100%';
          requestAnimationFrame(() => {
            bar.style.transitionDuration = duration + 'ms';
            bar.style.width = '0%';
          });
        }
        setTimeout(() => dismiss(id), duration);
      }
    });

    return id;
  }

  function dismiss(id) {
    if (!container) return;
    const toast = container.querySelector(`[data-toast-id="${id}"]`);
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.remove('visible');
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }

  function clear() {
    if (container) container.innerHTML = '';
  }

  function success(message, opts) { return show(message, 'success', 4000, opts); }
  function error(message, opts) { return show(message, 'error', 6000, opts); }
  function warning(message, opts) { return show(message, 'warning', 5000, opts); }
  function info(message, opts) { return show(message, 'info', 5000, opts); }

  function fromApiError(err) {
    if (!err || !err.code) return error('Erro inesperado.');

    const type = err.isServerError || err.isNetworkError ? 'error'
      : err.isAuth || err.isForbidden ? 'warning'
      : err.isValidation || err.isConflict ? 'warning'
      : err.isRateLimit ? 'warning'
      : 'error';

    const opts = {};

    if (err.isValidation && err.details) {
      const fields = Array.isArray(err.details) ? err.details : [];
      if (fields.length > 0) {
        opts.details = fields.map(f => `${f.field}: ${f.message}`).join(' · ');
      }
    }

    if (err.remainingAttempts) {
      opts.details = `${err.remainingAttempts} tentativa${err.remainingAttempts !== '1' ? 's' : ''} restante${err.remainingAttempts !== '1' ? 's' : ''}.`;
    }

    if (err.retryAfterSeconds) {
      const mins = Math.ceil(err.retryAfterSeconds / 60);
      opts.details = `Tente novamente em ${mins} minuto${mins !== 1 ? 's' : ''}.`;
    }

    if (err.isNetworkError) {
      opts.actions = [{ label: 'Tentar novamente', onClick: () => window.location.reload() }];
    }

    if (err.isServerError) {
      opts.title = 'Erro do servidor';
      if (err.requestId) opts.details = `ID: ${err.requestId}`;
    }

    const titleMap = {
      ACCOUNT_LOCKED: 'Conta bloqueada',
      ACCOUNT_SUSPENDED: 'Conta suspensa',
      ACCOUNT_PENDING: 'Aprovacao pendente',
      INVALID_CREDENTIALS: 'Credenciais invalidas',
      DUPLICATE_ENTRY: 'Registro duplicado',
      VALIDATION_ERROR: 'Erro de validacao',
      RATE_LIMIT_EXCEEDED: 'Limite excedido',
      AUTH_RATE_LIMIT: 'Muitas tentativas',
    };
    if (titleMap[err.code]) opts.title = titleMap[err.code];

    return show(err.userMessage, type, err.isServerError ? 8000 : 6000, opts);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  return { show, dismiss, clear, success, error, warning, info, fromApiError };
})();
