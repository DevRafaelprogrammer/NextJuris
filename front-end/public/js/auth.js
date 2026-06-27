const NJAuth = (() => {
  let currentPage = 'login';
  let regStep = 0;
  let regData = {};

  const stepMeta = [
    { eyebrow: 'Etapa 1 de 3', title: 'Dados pessoais', subtitle: 'Informacoes basicas para identificacao no sistema.' },
    { eyebrow: 'Etapa 2 de 3', title: 'Dados profissionais', subtitle: 'Registro na OAB e area de atuacao.' },
    { eyebrow: 'Etapa 3 de 3', title: 'Credenciais de acesso', subtitle: 'Crie uma senha segura e aceite os termos.' },
  ];

  function navigate(page) {
    document.querySelectorAll('.nj-auth-page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('auth-' + page);
    if (target) target.classList.add('active');
    currentPage = page;
    history.pushState({ authPage: page }, '', '/auth#' + page);
    document.querySelectorAll('.nj-auth-alert').forEach(a => a.classList.remove('visible'));
    if (page === 'register') { regStep = 0; regData = {}; updateRegStep(); loadRegOptions(); }
  }

  function showAlert(id, type, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'nj-auth-alert ' + type + ' visible';
    const s = el.querySelector('span');
    if (s) s.textContent = msg;
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

  function setupEye(btnId, inputId) {
    const b = document.getElementById(btnId), i = document.getElementById(inputId);
    if (!b || !i) return;
    b.addEventListener('click', () => {
      const show = i.type === 'password'; i.type = show ? 'text' : 'password';
      b.querySelector('i').className = show ? 'ti ti-eye-off' : 'ti ti-eye';
    });
  }

  function handleErr(err, alertId, form) {
    if (err.isAccountLocked) showAlert(alertId, 'error', err.userMessage);
    else if (err.isAccountSuspended) showAlert(alertId, 'error', 'Conta suspensa. Entre em contato com o suporte.');
    else if (err.isAccountPending) showAlert(alertId, 'error', 'Conta pendente de aprovacao.');
    else if (err.isAccountInactive) showAlert(alertId, 'error', 'Conta inativa.');
    else if (err.isInvalidCredentials) {
      const r = err.remainingAttempts;
      showAlert(alertId, 'error', r ? `Credenciais invalidas. ${r} tentativa${r !== '1' ? 's' : ''} restante${r !== '1' ? 's' : ''}.` : 'Credenciais invalidas.');
    } else if (err.isValidation || err.isDuplicate) {
      if (form) form.setServerErrors(err);
      showAlert(alertId, 'error', err.isDuplicate ? err.userMessage : 'Corrija os campos destacados.');
    } else if (err.isRateLimit) showAlert(alertId, 'error', err.userMessage);
    else if (err.isNetworkError) showAlert(alertId, 'error', 'Sem conexao. Verifique sua internet.');
    else if (err.isServerError) showAlert(alertId, 'error', 'Erro no servidor. Tente novamente.');
    else showAlert(alertId, 'error', err.userMessage || 'Erro inesperado.');
    NJToast?.fromApiError(err);
  }

  function updateRegStep() {
    for (let i = 0; i < 3; i++) {
      const panel = document.getElementById('reg-step-' + i);
      if (panel) panel.style.display = i === regStep ? '' : 'none';
    }
    const meta = stepMeta[regStep];
    const ey = document.getElementById('reg-eyebrow'); if (ey) ey.textContent = meta.eyebrow;
    const ti = document.getElementById('reg-title'); if (ti) ti.textContent = meta.title;
    const su = document.getElementById('reg-subtitle'); if (su) su.textContent = meta.subtitle;

    const steps = document.querySelectorAll('#reg-stepper .nj-auth-step');
    steps.forEach((s, i) => {
      s.classList.remove('active', 'done');
      s.style.background = '';
      if (i < regStep) { s.classList.add('done'); s.style.background = 'var(--nj-success, #1D9E75)'; }
      else if (i === regStep) { s.classList.add('active'); s.style.background = 'var(--nj-gold, #C9AA71)'; }
    });

    const prevBtn = document.getElementById('reg-prev-btn');
    const nextBtn = document.getElementById('reg-next-btn');
    if (prevBtn) prevBtn.style.display = regStep > 0 ? '' : 'none';
    if (nextBtn) {
      const label = nextBtn.querySelector('.nj-auth-submit-label');
      const icon = nextBtn.querySelector('.nj-auth-submit-icon');
      if (regStep === 2) {
        if (label) label.textContent = 'Criar conta';
        if (icon) icon.className = 'ti ti-check nj-auth-submit-icon';
        nextBtn.dataset.label = 'Criar conta';
      } else {
        if (label) label.textContent = 'Proximo';
        if (icon) icon.className = 'ti ti-arrow-right nj-auth-submit-icon';
        nextBtn.dataset.label = 'Proximo';
      }
    }

    const backLink = document.getElementById('reg-back-link');
    if (backLink) {
      if (regStep > 0) {
        backLink.innerHTML = '<i class="ti ti-arrow-left" aria-hidden="true"></i> Etapa anterior';
        backLink.onclick = (e) => { e.preventDefault(); regStep--; updateRegStep(); };
        backLink.removeAttribute('data-auth-nav');
      } else {
        backLink.innerHTML = '<i class="ti ti-arrow-left" aria-hidden="true"></i> Voltar ao login';
        backLink.onclick = null;
        backLink.setAttribute('data-auth-nav', 'login');
      }
    }

    document.querySelectorAll('.nj-auth-alert').forEach(a => a.classList.remove('visible'));
  }

  let debounceTimers = {};
  function debounceValidateField(field, value, extra) {
    clearTimeout(debounceTimers[field]);
    debounceTimers[field] = setTimeout(async () => {
      try {
        const res = await NJApi.post('/auth/register/validate/field', { field, value, ...extra });
        const data = res.data;
        const input = document.getElementById('reg-' + (field === 'oabNumber' ? 'oab' : field));
        const helper = document.getElementById('reg-' + (field === 'oabNumber' ? 'oab' : field) + '-help');
        if (!input || !helper) return;
        if (data.available) {
          input.classList.remove('error'); input.classList.add('ok');
          helper.className = 'nj-auth-helper success';
          helper.innerHTML = '<i class="ti ti-circle-check" aria-hidden="true"></i> ' + data.message;
        } else {
          input.classList.remove('ok'); input.classList.add('error');
          helper.className = 'nj-auth-helper error';
          helper.innerHTML = '<i class="ti ti-alert-circle" aria-hidden="true"></i> ' + data.message;
        }
      } catch {}
    }, 600);
  }

  async function loadRegOptions() {
    try {
      const res = await NJApi.get('/auth/register/areas');
      const data = res.data;
      const stateSelect = document.getElementById('reg-oab-state');
      if (stateSelect && stateSelect.options.length <= 1) {
        data.states.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; stateSelect.appendChild(o); });
      }
      const areaSelect = document.getElementById('reg-area');
      if (areaSelect && areaSelect.options.length <= 1) {
        data.areas.forEach(a => { const o = document.createElement('option'); o.value = a.value; o.textContent = a.label; areaSelect.appendChild(o); });
      }
      const comarcaSelect = document.getElementById('reg-comarca');
      if (comarcaSelect && comarcaSelect.options.length <= 1) {
        data.comarcas.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; comarcaSelect.appendChild(o); });
      }
    } catch {}
  }

  function initLogin() {
    const R = NJValidator.rules;
    const emailF = NJValidator.bindField('login-email', 'login-email-help', [R.required('E-mail'), R.email], { hint: 'E-mail ou registro OAB' });
    const passF = NJValidator.bindField('login-pass', 'login-pass-help', [R.required('Senha')], {});
    if (!emailF || !passF) return;
    setupEye('login-eye', 'login-pass');

    const form = NJValidator.bindForm('login-form', [emailF, passF], async () => {
      setLoading('login-submit', true, 'Autenticando');
      try {
        await NJApi.auth.login({ email: emailF.input.value.trim(), password: passF.input.value, rememberMe: document.querySelector('#login-form input[type="checkbox"]')?.checked || false });
        showAlert('login-alert', 'success', 'Autenticado. Redirecionando...');
        NJToast?.success('Login realizado.');
        setTimeout(() => NJAuthGuard.redirectToApp(), 800);
      } catch (err) {
        setLoading('login-submit', false);
        if (err.isInvalidCredentials) { passF.setError('Senha incorreta'); passF.input.value = ''; passF.input.focus(); }
        handleErr(err, 'login-alert', form);
      }
    });
  }

  function initRegister() {
    const R = NJValidator.rules;

    const nameF = NJValidator.bindField('reg-name', 'reg-name-help', [R.fullName], { successMessage: 'Nome valido' });
    const cpfF = NJValidator.bindField('reg-cpf', 'reg-cpf-help', [R.required('CPF'), R.cpf], { mask: 'cpf', successMessage: 'CPF valido' });
    const emailF = NJValidator.bindField('reg-email', 'reg-email-help', [R.required('E-mail'), R.email], { successMessage: 'E-mail valido' });
    const phoneF = NJValidator.bindField('reg-phone', 'reg-phone-help', [R.phone], { mask: 'phone' });

    const oabF = NJValidator.bindField('reg-oab', 'reg-oab-help', [R.required('OAB'), R.oab], { mask: 'oab' });
    const areaF = NJValidator.bindField('reg-area', 'reg-area-help', [R.required('Area')], {});

    const passF = NJValidator.bindField('reg-pass', 'reg-pass-help', [R.password], { hint: 'Maiuscula, minuscula, numero e especial' });
    const pass2F = NJValidator.bindField('reg-pass2', 'reg-pass2-help', [R.required('Confirmar senha'), R.passwordMatch('reg-pass')], { successMessage: 'Senhas conferem' });

    setupEye('reg-eye', 'reg-pass');
    setupEye('reg-eye2', 'reg-pass2');

    if (passF) {
      const segs = document.querySelectorAll('#reg-strength .nj-auth-step');
      passF.input.addEventListener('input', () => {
        const s = NJValidator.passwordStrength(passF.input.value);
        const cols = ['var(--nj-danger)', '#E67E22', '#F1C40F', 'var(--nj-success)'];
        segs.forEach((seg, i) => { seg.style.background = i < s.score ? cols[s.score - 1] : ''; });
      });
    }

    if (emailF) emailF.input.addEventListener('input', () => { if (emailF.input.value.includes('@') && emailF.input.value.includes('.')) debounceValidateField('email', emailF.input.value); });
    if (cpfF) cpfF.input.addEventListener('input', () => { if (cpfF.input.value.replace(/\D/g, '').length === 11) debounceValidateField('cpf', cpfF.input.value); });
    if (oabF) oabF.input.addEventListener('input', () => {
      const st = document.getElementById('reg-oab-state')?.value;
      if (oabF.input.value.length >= 3 && st) debounceValidateField('oabNumber', oabF.input.value, { oabState: st });
    });

    const stepFields = [[nameF, cpfF, emailF, phoneF], [oabF, areaF], [passF, pass2F]];

    const prevBtn = document.getElementById('reg-prev-btn');
    const nextBtn = document.getElementById('reg-next-btn');

    if (prevBtn) prevBtn.addEventListener('click', () => { if (regStep > 0) { regStep--; updateRegStep(); } });

    if (nextBtn) nextBtn.addEventListener('click', async () => {
      const fields = stepFields[regStep].filter(Boolean);
      let allValid = true;
      fields.forEach(f => { if (f && !f.validate()) allValid = false; });
      if (!allValid) { const inv = fields.find(f => f && !f.isValid); if (inv) inv.input.focus(); return; }

      if (regStep === 0) {
        setLoading('reg-next-btn', true, 'Validando');
        try {
          const res = await NJApi.post('/auth/register/validate/step1', {
            fullName: nameF.input.value.trim(), cpf: cpfF.input.value, email: emailF.input.value.trim(),
            ...(phoneF?.input.value ? { phone: phoneF.input.value } : {}),
          });
          setLoading('reg-next-btn', false);
          if (!res.data.valid) {
            const c = res.data.conflicts;
            if (c.email) emailF.setError(c.email);
            if (c.cpf) cpfF.setError(c.cpf);
            if (c.phone && phoneF) phoneF.setError(c.phone);
            showAlert('reg-alert', 'error', 'Corrija os campos destacados.');
            return;
          }
          regData = { ...regData, ...res.data.data };
          regStep = 1; updateRegStep();
        } catch (err) {
          setLoading('reg-next-btn', false);
          handleErr(err, 'reg-alert', { setServerErrors: (e) => NJValidator.applyServerErrors(fields, e) });
        }
        return;
      }

      if (regStep === 1) {
        setLoading('reg-next-btn', true, 'Validando');
        try {
          const body = {
            oabNumber: oabF.input.value, oabState: document.getElementById('reg-oab-state')?.value || '',
            area: areaF.input.value,
            ...(document.getElementById('reg-office')?.value ? { officeName: document.getElementById('reg-office').value } : {}),
            ...(document.getElementById('reg-comarca')?.value ? { comarca: document.getElementById('reg-comarca').value } : {}),
          };
          const res = await NJApi.post('/auth/register/validate/step2', body);
          setLoading('reg-next-btn', false);
          if (!res.data.valid) {
            const c = res.data.conflicts;
            if (c.oabNumber) oabF.setError(c.oabNumber);
            showAlert('reg-alert', 'error', 'Corrija os campos destacados.');
            return;
          }
          regData = { ...regData, ...res.data.data };
          regStep = 2; updateRegStep();
        } catch (err) {
          setLoading('reg-next-btn', false);
          handleErr(err, 'reg-alert', { setServerErrors: (e) => NJValidator.applyServerErrors(fields, e) });
        }
        return;
      }

      if (regStep === 2) {
        const terms = document.getElementById('reg-terms');
        const lgpd = document.getElementById('reg-lgpd');
        const termsHelp = document.getElementById('reg-terms-help');
        if (!terms?.checked || !lgpd?.checked) {
          if (termsHelp) { termsHelp.className = 'nj-auth-helper error'; termsHelp.innerHTML = '<i class="ti ti-alert-circle"></i> Aceite os termos e a LGPD para continuar.'; }
          return;
        }

        setLoading('reg-next-btn', true, 'Criando conta');
        try {
          await NJApi.auth.register({
            ...regData,
            password: passF.input.value,
            confirmPassword: pass2F.input.value,
            acceptTerms: true,
            acceptLgpd: true,
          });
          showAlert('reg-alert', 'success', 'Conta criada. Redirecionando...');
          NJToast?.success('Cadastro realizado com sucesso.');
          const stepper = document.querySelectorAll('#reg-stepper .nj-auth-step');
          stepper.forEach(s => { s.classList.add('done'); s.style.background = 'var(--nj-success, #1D9E75)'; });
          setTimeout(() => NJAuthGuard.redirectToApp(), 1200);
        } catch (err) {
          setLoading('reg-next-btn', false);
          handleErr(err, 'reg-alert', { setServerErrors: (e) => NJValidator.applyServerErrors(fields, e) });
        }
      }
    });

    const terms = document.getElementById('reg-terms');
    const lgpd = document.getElementById('reg-lgpd');
    const th = document.getElementById('reg-terms-help');
    [terms, lgpd].forEach(cb => {
      if (cb && th) cb.addEventListener('change', () => { if (terms?.checked && lgpd?.checked) { th.className = 'nj-auth-helper'; th.innerHTML = ''; } });
    });
  }

  function initForgot() {
    const R = NJValidator.rules;
    const emailF = NJValidator.bindField('forgot-email', 'forgot-email-help', [R.required('E-mail'), R.email], {});
    if (!emailF) return;

    NJValidator.bindForm('forgot-form', [emailF], async () => {
      setLoading('forgot-submit', true, 'Enviando');
      try {
        await NJApi.auth.forgotPassword(emailF.input.value.trim());
        showAlert('forgot-alert', 'success', 'E-mail enviado. Verifique sua caixa de entrada.');
        NJToast?.info('Link de redefinicao enviado.');
      } catch (err) {
        handleErr(err, 'forgot-alert', null);
      } finally { setLoading('forgot-submit', false); }
    });
  }

  function init() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-auth-nav]');
      if (link) { e.preventDefault(); navigate(link.dataset.authNav); }
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
