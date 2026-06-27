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
      if (inp) inp.addEventListener('input', () => { inp.classList.remove('error'); clearAlerts(); });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlerts();
      let valid = true;

      if (!emailInput.value.trim()) { showFieldError('login-email', 'login-email-help', 'Informe seu e-mail.'); valid = false; }
      if (!passInput.value) { showFieldError('login-pass', 'login-pass-help', 'Informe sua senha.'); valid = false; }
      if (!valid) return;

      setSubmitLoading('login-submit', true, 'Autenticando');

      try {
        await NJApi.auth.login({
          email: emailInput.value.trim(),
          password: passInput.value,
          rememberMe: document.querySelector('#login-form input[type="checkbox"]')?.checked || false,
        });
        showAlert('login-alert', 'success', 'Autenticado. Redirecionando...');
        setTimeout(() => NJAuthGuard.redirectToApp(), 800);
      } catch (err) {
        setSubmitLoading('login-submit', false);

        if (err.isAccountLocked) {
          showAlert('login-alert', 'error', err.userMessage);
        } else if (err.isAccountSuspended) {
          showAlert('login-alert', 'error', err.userMessage);
        } else if (err.isAccountPending) {
          showAlert('login-alert', 'error', err.userMessage);
        } else if (err.isAccountInactive) {
          showAlert('login-alert', 'error', err.userMessage);
        } else if (err.isInvalidCredentials) {
          const remaining = err.remainingAttempts;
          const msg = remaining ? `${err.userMessage} ${remaining} tentativa${remaining !== '1' ? 's' : ''} restante${remaining !== '1' ? 's' : ''}.` : err.userMessage;
          showAlert('login-alert', 'error', msg);
          showFieldError('login-email', 'login-email-help', '');
          showFieldError('login-pass', 'login-pass-help', 'Senha incorreta');
          passInput.value = '';
          passInput.focus();
        } else if (err.isRateLimit) {
          showAlert('login-alert', 'error', err.userMessage);
        } else if (err.isValidation) {
          const fields = err.validationErrors;
          if (fields.email) showFieldError('login-email', 'login-email-help', fields.email);
          if (fields.password) showFieldError('login-pass', 'login-pass-help', fields.password);
        } else if (err.isNetworkError) {
          showAlert('login-alert', 'error', 'Sem conexao com o servidor. Verifique sua internet.');
        } else if (err.isServerError) {
          showAlert('login-alert', 'error', 'Erro no servidor. Tente novamente em alguns minutos.');
        } else {
          showAlert('login-alert', 'error', err.userMessage || 'Erro ao autenticar.');
          passInput.value = '';
          passInput.focus();
        }
      }
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlerts();
      let valid = true;

      if (!nameInput.value.trim() || nameInput.value.trim().split(' ').length < 2) { showFieldError('reg-name', 'reg-name-help', 'Informe nome e sobrenome.'); valid = false; }
      if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) { showFieldError('reg-email', 'reg-email-help', 'E-mail invalido.'); valid = false; }
      if (!passInput.value || passInput.value.length < 8) { showFieldError('reg-pass', 'reg-pass-help', 'Minimo 8 caracteres.'); valid = false; }

      const terms = document.getElementById('reg-terms');
      if (terms && !terms.checked) {
        const h = document.getElementById('reg-terms-help');
        if (h) { h.classList.add('error'); h.innerHTML = '<i class="ti ti-alert-circle"></i> Aceite os termos.'; }
        valid = false;
      }
      if (!valid) return;

      setSubmitLoading('reg-submit', true, 'Criando conta');

      try {
        await NJApi.auth.register({
          fullName: nameInput.value.trim(),
          email: emailInput.value.trim(),
          password: passInput.value,
          confirmPassword: passInput.value,
        });
        showAlert('reg-alert', 'success', 'Conta criada. Redirecionando...');
        setTimeout(() => NJAuthGuard.redirectToApp(), 800);
      } catch (err) {
        setSubmitLoading('reg-submit', false);

        if (err.isDuplicate) {
          const field = err.context?.field || 'E-mail';
          showAlert('reg-alert', 'error', `${field} ja cadastrado. Use outro ou faca login.`);
          if (field.toLowerCase().includes('mail')) showFieldError('reg-email', 'reg-email-help', 'E-mail ja cadastrado');
        } else if (err.isValidation) {
          const fields = err.validationErrors;
          if (fields.fullName) showFieldError('reg-name', 'reg-name-help', fields.fullName);
          if (fields.email) showFieldError('reg-email', 'reg-email-help', fields.email);
          if (fields.password) showFieldError('reg-pass', 'reg-pass-help', fields.password);
          if (fields.confirmPassword) showFieldError('reg-pass', 'reg-pass-help', fields.confirmPassword);
          showAlert('reg-alert', 'error', 'Corrija os campos destacados.');
        } else if (err.isRateLimit) {
          showAlert('reg-alert', 'error', err.userMessage);
        } else if (err.isNetworkError) {
          showAlert('reg-alert', 'error', 'Sem conexao. Verifique sua internet.');
        } else {
          showAlert('reg-alert', 'error', err.userMessage || 'Erro ao criar conta.');
        }
      }
    });
  }

  function initForgot() {
    const form = document.getElementById('forgot-form');
    if (!form) return;
    const emailInput = document.getElementById('forgot-email');

    if (emailInput) emailInput.addEventListener('input', () => { emailInput.classList.remove('error'); clearAlerts(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlerts();

      if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
        showFieldError('forgot-email', 'forgot-email-help', 'E-mail invalido.');
        return;
      }

      setSubmitLoading('forgot-submit', true, 'Enviando');

      try {
        await NJApi.auth.forgotPassword(emailInput.value.trim());
        showAlert('forgot-alert', 'success', 'E-mail enviado. Verifique sua caixa de entrada.');
      } catch (err) {
        if (err.isRateLimit) {
          showAlert('forgot-alert', 'error', 'Muitas solicitacoes. Aguarde 1 hora para tentar novamente.');
        } else if (err.isValidation) {
          showFieldError('forgot-email', 'forgot-email-help', err.validationErrors?.email || 'E-mail invalido');
        } else {
          showAlert('forgot-alert', 'error', err.userMessage || 'Erro ao enviar e-mail.');
        }
      } finally {
        setSubmitLoading('forgot-submit', false);
      }
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
