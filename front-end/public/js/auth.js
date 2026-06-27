const NJAuth = (() => {
  let currentPage = 'login';

  function navigate(page) {
    document.querySelectorAll('.nj-auth-page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('auth-' + page);
    if (target) target.classList.add('active');
    currentPage = page;
    history.pushState({ authPage: page }, '', '/auth#' + page);
    clearAlerts();
    clearErrors();
  }

  function clearAlerts() {
    document.querySelectorAll('.nj-auth-alert').forEach(a => a.classList.remove('visible'));
  }

  function clearErrors() {
    document.querySelectorAll('.nj-auth-input.error').forEach(i => i.classList.remove('error'));
    document.querySelectorAll('.nj-auth-helper.error').forEach(h => { h.classList.remove('error'); h.innerHTML = ''; });
  }

  function showAlert(id, type, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'nj-auth-alert ' + type + ' visible';
    const span = el.querySelector('span');
    if (span) span.textContent = message;
  }

  function showFieldError(inputId, helperId, message) {
    const input = document.getElementById(inputId);
    const helper = document.getElementById(helperId);
    if (input) input.classList.toggle('error', !!message);
    if (helper) {
      helper.classList.toggle('error', !!message);
      helper.innerHTML = message ? '<i class="ti ti-alert-circle" aria-hidden="true"></i> ' + message : '';
    }
  }

  function setSubmitLoading(btnId, loading, loadingText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    const label = btn.querySelector('.nj-auth-submit-label');
    const spinner = btn.querySelector('.nj-btn-spinner');
    const icon = btn.querySelector('.nj-auth-submit-icon');
    if (label) label.textContent = loading ? (loadingText || 'Aguarde') : (btn.dataset.label || 'Entrar');
    if (spinner) spinner.style.display = loading ? 'block' : 'none';
    if (icon) icon.style.display = loading ? 'none' : 'inline';
  }

  function validateEmail(v) {
    if (!v.trim()) return 'Informe seu e-mail.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !/^\w{2}\s?\d{3,6}$/i.test(v.trim())) return 'Formato invalido.';
    return '';
  }

  function validatePassword(v) {
    if (!v) return 'Informe sua senha.';
    if (v.length < 6) return 'Minimo 6 caracteres.';
    return '';
  }

  function validateName(v) {
    if (!v.trim()) return 'Informe seu nome.';
    if (v.trim().split(' ').length < 2) return 'Informe nome e sobrenome.';
    return '';
  }

  function validatePasswordStrength(v) {
    if (!v) return 'Crie uma senha.';
    if (v.length < 8) return 'Minimo 8 caracteres.';
    if (!/[A-Z]/.test(v) || !/[a-z]/.test(v) || !/[0-9]/.test(v)) return 'Use maiusculas, minusculas e numeros.';
    return '';
  }

  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-pass');
    const eyeBtn = document.getElementById('login-eye');

    if (eyeBtn && passInput) {
      eyeBtn.addEventListener('click', () => {
        const show = passInput.type === 'password';
        passInput.type = show ? 'text' : 'password';
        eyeBtn.querySelector('i').className = show ? 'ti ti-eye-off' : 'ti ti-eye';
      });
    }

    [emailInput, passInput].forEach(inp => {
      if (inp) inp.addEventListener('input', () => {
        inp.classList.remove('error');
        clearAlerts();
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearAlerts();
      let valid = true;
      const eErr = validateEmail(emailInput.value);
      const pErr = validatePassword(passInput.value);
      if (eErr) { showFieldError('login-email', 'login-email-help', eErr); valid = false; }
      if (pErr) { showFieldError('login-pass', 'login-pass-help', pErr); valid = false; }
      if (!valid) return;

      setSubmitLoading('login-submit', true, 'Autenticando');
      setTimeout(() => {
        setSubmitLoading('login-submit', false);
        const isDemoUser = emailInput.value.toLowerCase().includes('demo') || emailInput.value.toLowerCase().includes('rafael');
        if (isDemoUser) {
          showAlert('login-alert', 'success', 'Autenticado. Redirecionando ao painel...');
          setTimeout(() => { window.location.href = '/'; }, 1500);
        } else {
          showAlert('login-alert', 'error', 'Credenciais invalidas. Verifique e tente novamente.');
          passInput.value = '';
          passInput.focus();
        }
      }, 1800);
    });
  }

  function initRegister() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-pass');
    const eyeBtn = document.getElementById('reg-eye');
    const segments = document.querySelectorAll('#reg-strength .nj-auth-step');

    if (eyeBtn && passInput) {
      eyeBtn.addEventListener('click', () => {
        const show = passInput.type === 'password';
        passInput.type = show ? 'text' : 'password';
        eyeBtn.querySelector('i').className = show ? 'ti ti-eye-off' : 'ti ti-eye';
      });
    }

    if (passInput) {
      passInput.addEventListener('input', () => {
        const v = passInput.value;
        let score = 0;
        if (v.length >= 6) score++;
        if (v.length >= 10) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const colors = ['var(--nj-danger)', '#E67E22', '#F1C40F', 'var(--nj-success)'];
        segments.forEach((s, i) => {
          s.style.background = i < score ? colors[score - 1] : '';
          s.classList.toggle('active', i < score);
        });
      });
    }

    [nameInput, emailInput, passInput].forEach(inp => {
      if (inp) inp.addEventListener('input', () => { inp.classList.remove('error'); clearAlerts(); });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearAlerts();
      let valid = true;
      const nErr = validateName(nameInput.value);
      const eErr = validateEmail(emailInput.value);
      const pErr = validatePasswordStrength(passInput.value);
      if (nErr) { showFieldError('reg-name', 'reg-name-help', nErr); valid = false; }
      if (eErr) { showFieldError('reg-email', 'reg-email-help', eErr); valid = false; }
      if (pErr) { showFieldError('reg-pass', 'reg-pass-help', pErr); valid = false; }
      const terms = document.getElementById('reg-terms');
      if (terms && !terms.checked) {
        showFieldError('reg-pass', 'reg-terms-help', 'Aceite os termos para continuar.'); valid = false;
      }
      if (!valid) return;

      setSubmitLoading('reg-submit', true, 'Criando conta');
      setTimeout(() => {
        setSubmitLoading('reg-submit', false);
        showAlert('reg-alert', 'success', 'Conta criada. Redirecionando...');
        setTimeout(() => { window.location.href = '/'; }, 1500);
      }, 2000);
    });
  }

  function initForgot() {
    const form = document.getElementById('forgot-form');
    if (!form) return;
    const emailInput = document.getElementById('forgot-email');

    if (emailInput) emailInput.addEventListener('input', () => { emailInput.classList.remove('error'); clearAlerts(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearAlerts();
      const eErr = validateEmail(emailInput.value);
      if (eErr) { showFieldError('forgot-email', 'forgot-email-help', eErr); return; }

      setSubmitLoading('forgot-submit', true, 'Enviando');
      setTimeout(() => {
        setSubmitLoading('forgot-submit', false);
        showAlert('forgot-alert', 'success', 'E-mail enviado. Verifique sua caixa de entrada.');
      }, 1500);
    });
  }

  function init() {
    document.querySelectorAll('[data-auth-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.authNav);
      });
    });

    window.addEventListener('popstate', () => {
      const hash = window.location.hash.slice(1);
      if (['login', 'register', 'forgot'].includes(hash)) navigate(hash);
    });

    initLogin();
    initRegister();
    initForgot();

    const hash = window.location.hash.slice(1);
    if (['login', 'register', 'forgot'].includes(hash)) navigate(hash);
    else navigate('login');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigate, showAlert, get current() { return currentPage; } };
})();
