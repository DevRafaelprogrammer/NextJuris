const NJAuth = (() => {
  let currentPage = 'login';

  function navigate(page) {
    document.querySelectorAll('.nj-auth-page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('auth-' + page);
    if (target) target.classList.add('active');
    currentPage = page;
    history.pushState({ authPage: page }, '', '/auth#' + page);
    document.querySelectorAll('.nj-auth-alert').forEach(a => a.classList.remove('visible'));
  }

  function showAlert(id, type, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'nj-auth-alert ' + type + ' visible';
    const span = el.querySelector('span');
    if (span) span.textContent = message;
  }

  function setLoading(btnId, loading, text) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    const label = btn.querySelector('.nj-auth-submit-label');
    const spinner = btn.querySelector('.nj-btn-spinner');
    const icon = btn.querySelector('.nj-auth-submit-icon');
    if (label) label.textContent = loading ? (text || 'Aguarde') : (btn.dataset.label || 'Entrar');
    if (spinner) spinner.style.display = loading ? 'block' : 'none';
    if (icon) icon.style.display = loading ? 'none' : 'inline';
  }

  function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = show ? 'ti ti-eye-off' : 'ti ti-eye';
    });
  }

  function setupStrengthBar(inputId, containerId) {
    const input = document.getElementById(inputId);
    const segments = document.querySelectorAll(`#${containerId} .nj-auth-step`);
    if (!input || !segments.length) return;
    input.addEventListener('input', () => {
      const s = NJValidator.passwordStrength(input.value);
      const colors = ['var(--nj-danger)', '#E67E22', '#F1C40F', 'var(--nj-success)'];
      segments.forEach((seg, i) => {
        seg.style.background = i < s.score ? colors[s.score - 1] : '';
        seg.classList.toggle('active', i < s.score);
      });
    });
  }

  function handleApiError(err, alertId, form) {
    if (err.isAccountLocked) {
      showAlert(alertId, 'error', err.userMessage);
    } else if (err.isAccountSuspended) {
      showAlert(alertId, 'error', 'Conta suspensa. Entre em contato com o suporte.');
    } else if (err.isAccountPending) {
      showAlert(alertId, 'error', 'Conta pendente de aprovacao pelo administrador.');
    } else if (err.isAccountInactive) {
      showAlert(alertId, 'error', 'Conta inativa.');
    } else if (err.isInvalidCredentials) {
      const r = err.remainingAttempts;
      const msg = r ? `Credenciais invalidas. ${r} tentativa${r !== '1' ? 's' : ''} restante${r !== '1' ? 's' : ''}.` : 'Credenciais invalidas.';
      showAlert(alertId, 'error', msg);
    } else if (err.isValidation || err.isDuplicate) {
      if (form) form.setServerErrors(err);
      showAlert(alertId, 'error', err.isDuplicate ? err.userMessage : 'Corrija os campos destacados.');
    } else if (err.isRateLimit) {
      const secs = err.retryAfterSeconds;
      const msg = secs ? `Muitas tentativas. Aguarde ${Math.ceil(secs / 60)} minutos.` : err.userMessage;
      showAlert(alertId, 'error', msg);
    } else if (err.isNetworkError) {
      showAlert(alertId, 'error', 'Sem conexao com o servidor. Verifique sua internet.');
    } else if (err.isTimeout) {
      showAlert(alertId, 'error', 'Requisicao expirou. Tente novamente.');
    } else if (err.isServerError) {
      showAlert(alertId, 'error', 'Erro no servidor. Tente novamente em alguns minutos.');
    } else {
      showAlert(alertId, 'error', err.userMessage || 'Erro inesperado.');
    }
    NJToast?.fromApiError(err);
  }

  function initLogin() {
    const R = NJValidator.rules;

    const emailField = NJValidator.bindField('login-email', 'login-email-help',
      [R.required('E-mail'), R.email],
      { hint: 'E-mail ou registro OAB' }
    );
    const passField = NJValidator.bindField('login-pass', 'login-pass-help',
      [R.required('Senha')],
      {}
    );
    if (!emailField || !passField) return;

    setupPasswordToggle('login-eye', 'login-pass');

    const form = NJValidator.bindForm('login-form', [emailField, passField], async () => {
      setLoading('login-submit', true, 'Autenticando');
      try {
        await NJApi.auth.login({
          email: emailField.input.value.trim(),
          password: passField.input.value,
          rememberMe: document.querySelector('#login-form input[type="checkbox"]')?.checked || false,
        });
        showAlert('login-alert', 'success', 'Autenticado. Redirecionando...');
        NJToast?.success('Login realizado com sucesso.');
        setTimeout(() => NJAuthGuard.redirectToApp(), 800);
      } catch (err) {
        setLoading('login-submit', false);
        if (err.isInvalidCredentials) {
          passField.setError('Senha incorreta');
          passField.input.value = '';
          passField.input.focus();
        }
        handleApiError(err, 'login-alert', form);
      }
    });
  }

  function initRegister() {
    const R = NJValidator.rules;

    const nameField = NJValidator.bindField('reg-name', 'reg-name-help',
      [R.fullName],
      { hint: 'Nome completo conforme registro profissional', successMessage: 'Nome valido' }
    );
    const emailField = NJValidator.bindField('reg-email', 'reg-email-help',
      [R.required('E-mail'), R.email],
      { successMessage: 'E-mail valido' }
    );
    const passField = NJValidator.bindField('reg-pass', 'reg-pass-help',
      [R.password],
      { hint: 'Minimo 8 caracteres com maiuscula, minuscula, numero e especial' }
    );
    if (!nameField || !emailField || !passField) return;

    setupPasswordToggle('reg-eye', 'reg-pass');
    setupStrengthBar('reg-pass', 'reg-strength');

    const form = NJValidator.bindForm('register-form', [nameField, emailField, passField], async () => {
      const terms = document.getElementById('reg-terms');
      const termsHelp = document.getElementById('reg-terms-help');
      if (terms && !terms.checked) {
        if (termsHelp) { termsHelp.className = 'nj-auth-helper error'; termsHelp.innerHTML = '<i class="ti ti-alert-circle"></i> Aceite os termos para continuar.'; }
        return;
      }

      setLoading('reg-submit', true, 'Criando conta');
      try {
        await NJApi.auth.register({
          fullName: nameField.input.value.trim(),
          email: emailField.input.value.trim(),
          password: passField.input.value,
          confirmPassword: passField.input.value,
        });
        showAlert('reg-alert', 'success', 'Conta criada. Redirecionando...');
        NJToast?.success('Cadastro realizado com sucesso.');
        setTimeout(() => NJAuthGuard.redirectToApp(), 800);
      } catch (err) {
        setLoading('reg-submit', false);
        handleApiError(err, 'reg-alert', form);
      }
    });

    const terms = document.getElementById('reg-terms');
    const termsHelp = document.getElementById('reg-terms-help');
    if (terms && termsHelp) {
      terms.addEventListener('change', () => {
        if (terms.checked) { termsHelp.className = 'nj-auth-helper'; termsHelp.innerHTML = ''; }
      });
    }
  }

  function initForgot() {
    const R = NJValidator.rules;

    const emailField = NJValidator.bindField('forgot-email', 'forgot-email-help',
      [R.required('E-mail'), R.email],
      {}
    );
    if (!emailField) return;

    NJValidator.bindForm('forgot-form', [emailField], async () => {
      setLoading('forgot-submit', true, 'Enviando');
      try {
        await NJApi.auth.forgotPassword(emailField.input.value.trim());
        showAlert('forgot-alert', 'success', 'E-mail enviado. Verifique sua caixa de entrada.');
        NJToast?.info('Link de redefinicao enviado ao seu e-mail.');
      } catch (err) {
        handleApiError(err, 'forgot-alert', null);
      } finally {
        setLoading('forgot-submit', false);
      }
    });
  }

  function init() {
    document.querySelectorAll('[data-auth-nav]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.dataset.authNav); });
    });

    window.addEventListener('popstate', () => {
      const hash = window.location.hash.slice(1);
      if (['login', 'register', 'forgot'].includes(hash)) navigate(hash);
    });

    initLogin();
    initRegister();
    initForgot();

    const hash = window.location.hash.slice(1);
    navigate(['login', 'register', 'forgot'].includes(hash) ? hash : 'login');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigate, showAlert, get current() { return currentPage; } };
})();
