const NJValidator = (() => {

  const rules = {
    required: (v, label) => (!v || !v.trim()) ? `${label || 'Campo'} obrigatorio.` : '',
    email: (v) => {
      if (!v) return '';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'E-mail invalido.';
    },
    minLength: (min, label) => (v) => {
      if (!v) return '';
      return v.length >= min ? '' : `${label || 'Campo'} deve ter pelo menos ${min} caracteres.`;
    },
    maxLength: (max, label) => (v) => {
      if (!v) return '';
      return v.length <= max ? '' : `${label || 'Campo'} deve ter no maximo ${max} caracteres.`;
    },
    fullName: (v) => {
      if (!v || !v.trim()) return 'Informe seu nome completo.';
      return v.trim().split(/\s+/).length >= 2 ? '' : 'Informe nome e sobrenome.';
    },
    cpf: (v) => {
      if (!v) return '';
      const digits = v.replace(/\D/g, '');
      if (digits.length !== 11) return 'CPF deve ter 11 digitos.';
      if (/^(\d)\1+$/.test(digits)) return 'CPF invalido.';
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
      let rem = (sum * 10) % 11; if (rem === 10) rem = 0;
      if (rem !== parseInt(digits[9])) return 'CPF invalido.';
      sum = 0;
      for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
      rem = (sum * 10) % 11; if (rem === 10) rem = 0;
      if (rem !== parseInt(digits[10])) return 'CPF invalido.';
      return '';
    },
    cnpj: (v) => {
      if (!v) return '';
      const digits = v.replace(/\D/g, '');
      if (digits.length !== 14) return 'CNPJ deve ter 14 digitos.';
      return '';
    },
    phone: (v) => {
      if (!v) return '';
      const digits = v.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11 ? '' : 'Telefone invalido.';
    },
    oab: (v) => {
      if (!v) return '';
      return /^\d{3,6}$/.test(v.replace(/\D/g, '')) ? '' : 'Numero OAB invalido (3 a 6 digitos).';
    },
    oabState: (v) => {
      if (!v) return '';
      const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
      return states.includes(v.toUpperCase()) ? '' : 'Seccional invalida.';
    },
    password: (v) => {
      if (!v) return 'Crie uma senha.';
      const errors = [];
      if (v.length < 8) errors.push('8+ caracteres');
      if (!/[A-Z]/.test(v)) errors.push('letra maiuscula');
      if (!/[a-z]/.test(v)) errors.push('letra minuscula');
      if (!/[0-9]/.test(v)) errors.push('numero');
      if (!/[^A-Za-z0-9]/.test(v)) errors.push('caractere especial (!@#$)');
      return errors.length ? `Falta: ${errors.join(', ')}.` : '';
    },
    passwordMatch: (passwordField) => (v) => {
      const pw = document.getElementById(passwordField);
      if (!pw || !v) return '';
      return v === pw.value ? '' : 'Senhas nao conferem.';
    },
    url: (v) => {
      if (!v) return '';
      try { new URL(v); return ''; } catch { return 'URL invalida.'; }
    },
    date: (v) => {
      if (!v) return '';
      const d = new Date(v);
      return isNaN(d.getTime()) ? 'Data invalida.' : '';
    },
    futureDate: (v) => {
      if (!v) return '';
      return new Date(v) > new Date() ? '' : 'Data deve ser futura.';
    },
    number: (v) => {
      if (!v && v !== 0) return '';
      return isNaN(Number(v)) ? 'Valor numerico invalido.' : '';
    },
    positiveNumber: (v) => {
      if (!v && v !== 0) return '';
      const n = Number(v);
      return isNaN(n) ? 'Valor numerico invalido.' : n > 0 ? '' : 'Valor deve ser positivo.';
    },
    caseNumber: (v) => {
      if (!v) return '';
      return /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}/.test(v) ? '' : 'Formato invalido (NNNNNNN-DD.AAAA.J.TR).';
    },
  };

  const masks = {
    cpf: (v) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14),
    cnpj: (v) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2').slice(0, 18),
    phone: (v) => {
      const d = v.replace(/\D/g, '');
      if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
      return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);
    },
    oab: (v) => v.replace(/\D/g, '').slice(0, 6),
    currency: (v) => {
      const n = v.replace(/\D/g, '');
      if (!n) return '';
      return (Number(n) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },
    caseNumber: (v) => {
      const d = v.replace(/\D/g, '');
      let r = d;
      if (d.length > 7) r = d.slice(0, 7) + '-' + d.slice(7);
      if (d.length > 9) r = r.slice(0, 10) + '.' + d.slice(9);
      if (d.length > 13) r = r.slice(0, 15) + '.' + d.slice(13);
      if (d.length > 14) r = r.slice(0, 17) + '.' + d.slice(14);
      if (d.length > 16) r = r.slice(0, 20) + '.' + d.slice(16);
      return r.slice(0, 25);
    },
  };

  function passwordStrength(v) {
    if (!v) return { score: 0, label: '', color: '' };
    let score = 0;
    if (v.length >= 6) score++;
    if (v.length >= 10) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const labels = ['Fraca', 'Razoavel', 'Boa', 'Forte'];
    const colors = ['var(--nj-danger, #C0392B)', '#E67E22', '#F1C40F', 'var(--nj-success, #1D9E75)'];
    return {
      score,
      label: labels[Math.max(0, score - 1)] || '',
      color: colors[Math.max(0, score - 1)] || '',
    };
  }

  function bindField(inputId, helperId, validators, opts = {}) {
    const input = document.getElementById(inputId);
    const helper = document.getElementById(helperId);
    if (!input) return null;

    const state = { valid: true, error: '', touched: false, dirty: false };

    function validate() {
      const value = input.value;
      for (const vFn of validators) {
        const err = typeof vFn === 'function' ? vFn(value) : '';
        if (err) {
          state.valid = false;
          state.error = err;
          if (state.touched) showError(err);
          return false;
        }
      }
      state.valid = true;
      state.error = '';
      if (state.touched && state.dirty) showSuccess();
      else clearState();
      return true;
    }

    function showError(msg) {
      input.classList.add('error');
      input.classList.remove('success', 'ok');
      if (helper) {
        helper.className = (helper.className.replace(/\b(error|success|nj-auth-helper)\b/g, '').trim() + ' nj-auth-helper error').trim();
        helper.innerHTML = '<i class="ti ti-alert-circle" aria-hidden="true"></i> ' + esc(msg);
      }
    }

    function showSuccess() {
      input.classList.remove('error');
      input.classList.add('ok');
      if (helper && opts.successMessage) {
        helper.className = (helper.className.replace(/\b(error|success)\b/g, '').trim() + ' success').trim();
        helper.innerHTML = '<i class="ti ti-circle-check" aria-hidden="true"></i> ' + esc(opts.successMessage);
      } else if (helper) {
        helper.className = helper.className.replace(/\b(error|success)\b/g, '').trim();
        helper.innerHTML = '';
      }
    }

    function clearState() {
      input.classList.remove('error', 'ok', 'success');
      if (helper) { helper.className = helper.className.replace(/\b(error|success)\b/g, '').trim(); helper.innerHTML = ''; }
    }

    function setError(msg) {
      state.touched = true;
      state.valid = false;
      state.error = msg;
      showError(msg);
    }

    function reset() {
      state.touched = false;
      state.dirty = false;
      state.valid = true;
      state.error = '';
      clearState();
    }

    if (opts.mask && masks[opts.mask]) {
      input.addEventListener('input', () => {
        const pos = input.selectionStart;
        const prev = input.value.length;
        input.value = masks[opts.mask](input.value);
        const diff = input.value.length - prev;
        input.setSelectionRange(pos + diff, pos + diff);
      });
    }

    input.addEventListener('input', () => {
      state.dirty = true;
      if (state.touched) validate();
      else { input.classList.remove('error'); if (helper) helper.innerHTML = ''; }
    });

    input.addEventListener('blur', () => {
      state.touched = true;
      if (state.dirty) validate();
    });

    input.addEventListener('focus', () => {
      if (opts.hint && !state.error && helper) {
        helper.className = helper.className.replace(/\b(error|success)\b/g, '').trim();
        helper.innerHTML = '<i class="ti ti-info-circle" aria-hidden="true"></i> ' + esc(opts.hint);
      }
    });

    return { validate, setError, reset, get isValid() { return state.valid; }, get error() { return state.error; }, input };
  }

  function bindForm(formId, fields, onSubmit) {
    const form = document.getElementById(formId);
    if (!form) return null;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let allValid = true;
      for (const f of fields) {
        f.input.dispatchEvent(new Event('blur'));
        if (!f.validate()) allValid = false;
      }
      if (!allValid) {
        const firstInvalid = fields.find(f => !f.isValid);
        if (firstInvalid) firstInvalid.input.focus();
        return;
      }
      await onSubmit(e);
    });

    return {
      validate: () => fields.every(f => f.validate()),
      reset: () => { form.reset(); fields.forEach(f => f.reset()); },
      setServerErrors: (err) => {
        if (!err) return;
        if (err.isValidation) {
          const map = err.validationErrors;
          for (const f of fields) {
            const name = f.input.name || f.input.id.replace(/^(login-|reg-|forgot-|inp-)/, '');
            const snakeName = name.replace(/([A-Z])/g, '_$1').toLowerCase();
            const error = map[name] || map[snakeName] || map[f.input.id];
            if (error) f.setError(error);
          }
        }
        if (err.isDuplicate) {
          const fieldName = (err.context?.field || '').toLowerCase();
          for (const f of fields) {
            const id = f.input.id.toLowerCase();
            if (id.includes('email') && fieldName.includes('mail')) f.setError('E-mail ja cadastrado.');
            if (id.includes('cpf') && fieldName.includes('cpf')) f.setError('CPF ja cadastrado.');
            if (id.includes('oab') && fieldName.includes('oab')) f.setError('OAB ja cadastrada.');
          }
        }
      },
      fields,
    };
  }

  function applyServerErrors(fields, err) {
    if (!err || !fields) return;
    if (err.isValidation) {
      const map = err.validationErrors;
      for (const [key, msg] of Object.entries(map)) {
        const field = fields.find(f => {
          const id = f.input.id.toLowerCase();
          const k = key.toLowerCase();
          return id.includes(k) || id.replace(/[-_]/g, '').includes(k.replace(/[-_]/g, ''));
        });
        if (field) field.setError(msg);
      }
    }
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  return { rules, masks, passwordStrength, bindField, bindForm, applyServerErrors };
})();
