const NJApi = (() => {
  const BASE = '/api';
  let accessToken = localStorage.getItem('nj_access_token');
  let refreshToken = localStorage.getItem('nj_refresh_token');
  let currentUser = JSON.parse(localStorage.getItem('nj_user') || 'null');
  let refreshPromise = null;
  const listeners = { auth: [], user: [], error: [] };

  function on(event, fn) { listeners[event]?.push(fn); }
  function off(event, fn) { const arr = listeners[event]; if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); } }
  function emit(event, data) { listeners[event]?.forEach(fn => fn(data)); }

  function setTokens(tokens) {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    localStorage.setItem('nj_access_token', tokens.accessToken);
    localStorage.setItem('nj_refresh_token', tokens.refreshToken);
    localStorage.setItem('nj_token_expires', String(Date.now() + tokens.expiresIn * 1000));
  }

  function setUser(user) {
    currentUser = user;
    localStorage.setItem('nj_user', JSON.stringify(user));
    emit('user', user);
  }

  function clearAuth() {
    accessToken = null;
    refreshToken = null;
    currentUser = null;
    localStorage.removeItem('nj_access_token');
    localStorage.removeItem('nj_refresh_token');
    localStorage.removeItem('nj_token_expires');
    localStorage.removeItem('nj_user');
    emit('auth', null);
  }

  function isAuthenticated() { return !!accessToken; }

  function isTokenExpiring() {
    const exp = Number(localStorage.getItem('nj_token_expires') || 0);
    return exp > 0 && (exp - Date.now()) < 60000;
  }

  class ApiError extends Error {
    constructor(status, code, message, details, context, requestId, retryAfter) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details || null;
      this.context = context || null;
      this.requestId = requestId || null;
      this.retryAfter = retryAfter || null;
    }

    get isAuth() { return this.status === 401; }
    get isForbidden() { return this.status === 403; }
    get isNotFound() { return this.status === 404; }
    get isValidation() { return this.code === 'VALIDATION_ERROR'; }
    get isConflict() { return this.status === 409; }
    get isDuplicate() { return this.code === 'DUPLICATE_ENTRY'; }
    get isRateLimit() { return this.status === 429; }
    get isServerError() { return this.status >= 500; }
    get isNetworkError() { return this.code === 'NETWORK_ERROR'; }
    get isTimeout() { return this.code === 'REQUEST_TIMEOUT'; }

    get isAccountLocked() { return this.code === 'ACCOUNT_LOCKED'; }
    get isAccountSuspended() { return this.code === 'ACCOUNT_SUSPENDED'; }
    get isAccountInactive() { return this.code === 'ACCOUNT_INACTIVE'; }
    get isAccountPending() { return this.code === 'ACCOUNT_PENDING'; }
    get isTokenExpired() { return this.code === 'TOKEN_EXPIRED'; }
    get isTokenInvalid() { return this.code === 'TOKEN_INVALID'; }
    get isInvalidCredentials() { return this.code === 'INVALID_CREDENTIALS'; }

    get validationErrors() {
      if (!this.isValidation || !Array.isArray(this.details)) return {};
      const map = {};
      this.details.forEach(d => { map[d.field] = d.message; });
      return map;
    }

    get userMessage() {
      const messages = {
        NETWORK_ERROR: 'Sem conexao com o servidor. Verifique sua internet.',
        REQUEST_TIMEOUT: 'Requisicao excedeu o tempo limite. Tente novamente.',
        ACCOUNT_LOCKED: this.message,
        ACCOUNT_SUSPENDED: 'Sua conta foi suspensa. Entre em contato com o suporte.',
        ACCOUNT_INACTIVE: 'Sua conta esta inativa.',
        ACCOUNT_PENDING: 'Sua conta aguarda aprovacao do administrador.',
        TOKEN_EXPIRED: 'Sua sessao expirou. Faca login novamente.',
        TOKEN_INVALID: 'Sessao invalida. Faca login novamente.',
        INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
        DUPLICATE_ENTRY: this.message,
        VALIDATION_ERROR: 'Verifique os campos do formulario.',
        AUTH_RATE_LIMIT: 'Muitas tentativas. Aguarde 15 minutos.',
        FORGOT_RATE_LIMIT: 'Muitas solicitacoes. Aguarde 1 hora.',
        RATE_LIMIT_EXCEEDED: 'Limite de requisicoes excedido. Aguarde um momento.',
        TOO_MANY_REQUESTS: this.message,
        DATABASE_ERROR: 'Servico temporariamente indisponivel. Tente novamente.',
        SERVICE_UNAVAILABLE: 'Servico indisponivel. Tente novamente em alguns minutos.',
        RLS_VIOLATION: 'Voce nao tem permissao para esta operacao.',
        INSUFFICIENT_PERMISSION: 'Permissao insuficiente para esta acao.',
        NOT_FOUND: this.message,
        INTERNAL_ERROR: 'Erro interno. Nossa equipe foi notificada.',
      };
      return messages[this.code] || this.message || 'Erro inesperado.';
    }

    get remainingAttempts() {
      return this.context?.constraint?.match(/(\d+) tentativa/)?.[1] || null;
    }

    get retryAfterSeconds() {
      return this.retryAfter || this.context?.retryAfter || null;
    }
  }

  function parseError(status, json, retryAfterHeader) {
    const e = json?.error || {};
    return new ApiError(
      status,
      e.code || `HTTP_${status}`,
      e.message || `Erro ${status}`,
      e.details,
      e.context,
      e.requestId,
      retryAfterHeader ? parseInt(retryAfterHeader, 10) : (e.context?.retryAfter || null)
    );
  }

  async function tryRefresh() {
    if (!refreshToken) return false;
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) { clearAuth(); return false; }
        const json = await res.json();
        if (json.success && json.data) { setTokens(json.data); return true; }
        clearAuth();
        return false;
      } catch {
        clearAuth();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  async function request(method, path, body, opts = {}) {
    if (isTokenExpiring() && refreshToken) await tryRefresh();

    const headers = { 'Content-Type': 'application/json' };
    if (accessToken && !opts.noAuth) headers['Authorization'] = `Bearer ${accessToken}`;

    const config = { method, headers };
    if (body && method !== 'GET') config.body = JSON.stringify(body);

    let url = `${BASE}${path}`;
    if (body && method === 'GET') {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += '?' + qs;
      delete config.body;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout || 30000);
    config.signal = controller.signal;

    let res;
    try {
      res = await fetch(url, config);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        const err = new ApiError(408, 'REQUEST_TIMEOUT', 'Requisicao excedeu o tempo limite');
        emit('error', err);
        throw err;
      }
      const err = new ApiError(0, 'NETWORK_ERROR', 'Sem conexao com o servidor');
      emit('error', err);
      throw err;
    }
    clearTimeout(timeoutId);

    if (res.status === 401 && !opts.noRetry) {
      let json = {};
      try { json = await res.clone().json(); } catch {}
      const errorCode = json?.error?.code;

      if (errorCode === 'TOKEN_EXPIRED' && refreshToken) {
        const refreshed = await tryRefresh();
        if (refreshed) return request(method, path, body, { ...opts, noRetry: true });
      }

      if (['TOKEN_EXPIRED', 'TOKEN_INVALID', 'UNAUTHORIZED'].includes(errorCode) && !path.includes('/auth/login')) {
        clearAuth();
        emit('auth', null);
        const err = parseError(401, json, null);
        emit('error', err);
        NJToast?.show(err.userMessage, 'error');
        setTimeout(() => { window.location.href = '/auth#login'; }, 1500);
        throw err;
      }

      const err = parseError(401, json, null);
      emit('error', err);
      throw err;
    }

    if (res.status === 403) {
      const json = await res.json();
      const err = parseError(403, json, null);
      emit('error', err);

      if (err.isAccountSuspended || err.isAccountInactive || err.isAccountPending) {
        clearAuth();
        NJToast?.show(err.userMessage, 'error', 8000);
        setTimeout(() => { window.location.href = '/auth#login'; }, 2000);
      } else {
        NJToast?.show(err.userMessage, 'warning');
      }
      throw err;
    }

    if (res.status === 404) {
      const json = await res.json();
      const err = parseError(404, json, null);
      emit('error', err);
      throw err;
    }

    if (res.status === 409) {
      const json = await res.json();
      const err = parseError(409, json, null);
      emit('error', err);
      throw err;
    }

    if (res.status === 422) {
      const json = await res.json();
      const err = parseError(422, json, null);
      emit('error', err);
      throw err;
    }

    if (res.status === 429) {
      const json = await res.json();
      const retryAfter = res.headers.get('Retry-After');
      const err = parseError(429, json, retryAfter);
      emit('error', err);
      NJToast?.show(err.userMessage, 'warning', 6000);
      throw err;
    }

    if (res.status >= 500) {
      let json = {};
      try { json = await res.json(); } catch {}
      const err = parseError(res.status, json, res.headers.get('Retry-After'));
      emit('error', err);
      NJToast?.show(err.userMessage, 'error', 6000);
      throw err;
    }

    if (res.status === 204) return { success: true, data: null };

    const json = await res.json();
    if (!res.ok) {
      const err = parseError(res.status, json, null);
      emit('error', err);
      throw err;
    }

    return json;
  }

  const get = (path, params) => request('GET', path, params);
  const post = (path, body) => request('POST', path, body);
  const patch = (path, body) => request('PATCH', path, body);
  const del = (path) => request('DELETE', path);

  const auth = {
    async register(data) {
      const res = await post('/auth/register', data);
      setTokens(res.data.tokens);
      setUser(res.data.user);
      emit('auth', res.data.user);
      return res.data;
    },
    async login(data) {
      const res = await post('/auth/login', data);
      setTokens(res.data.tokens);
      setUser(res.data.user);
      emit('auth', res.data.user);
      return res.data;
    },
    async logout() {
      try { await post('/auth/logout', { refreshToken }); } catch {}
      clearAuth();
      window.location.href = '/logout';
    },
    async logoutAll() {
      const res = await post('/auth/logout-all');
      clearAuth();
      return res.data;
    },
    async me() {
      const res = await get('/auth/me');
      if (res.data) setUser(res.data);
      return res.data;
    },
    sessions: () => get('/auth/sessions').then(r => r.data),
    loginHistory: (limit) => get('/auth/login-history', { limit }).then(r => r.data),
    revokeSession: (id) => del(`/auth/sessions/${id}`),
    forgotPassword: (email) => post('/auth/forgot-password', { email }).then(r => r.data),
    resetPassword: (data) => post('/auth/reset-password', data).then(r => r.data),
    changePassword: (data) => post('/auth/change-password', data).then(r => r.data),
  };

  const reports = {
    list: (params) => get('/reports', params).then(r => r.data),
    get: (id) => get(`/reports/${id}`).then(r => r.data),
    create: (data) => post('/reports', data).then(r => r.data),
    update: (id, data) => patch(`/reports/${id}`, data).then(r => r.data),
    delete: (id) => del(`/reports/${id}`),
    generate: (data) => post('/reports/generate', data).then(r => r.data),
    duplicate: (id) => post(`/reports/${id}/duplicate`).then(r => r.data),
    stats: () => get('/reports/stats').then(r => r.data),
  };

  const cases = {
    list: (params) => get('/cases', params).then(r => r.data),
    get: (id) => get(`/cases/${id}`).then(r => r.data),
    create: (data) => post('/cases', data).then(r => r.data),
    update: (id, data) => patch(`/cases/${id}`, data).then(r => r.data),
    delete: (id) => del(`/cases/${id}`),
    stats: () => get('/cases/stats').then(r => r.data),
  };

  const clients = {
    list: (params) => get('/clients', params).then(r => r.data),
    get: (id) => get(`/clients/${id}`).then(r => r.data),
    create: (data) => post('/clients', data).then(r => r.data),
    update: (id, data) => patch(`/clients/${id}`, data).then(r => r.data),
    delete: (id) => del(`/clients/${id}`),
    stats: () => get('/clients/stats').then(r => r.data),
  };

  const documents = {
    list: (params) => get('/documents', params).then(r => r.data),
    get: (id) => get(`/documents/${id}`).then(r => r.data),
    create: (data) => post('/documents', data).then(r => r.data),
    update: (id, data) => patch(`/documents/${id}`, data).then(r => r.data),
    delete: (id) => del(`/documents/${id}`),
    stats: () => get('/documents/stats').then(r => r.data),
  };

  const calendar = {
    list: (params) => get('/calendar', params).then(r => r.data),
    get: (id) => get(`/calendar/${id}`).then(r => r.data),
    create: (data) => post('/calendar', data).then(r => r.data),
    update: (id, data) => patch(`/calendar/${id}`, data).then(r => r.data),
    complete: (id) => post(`/calendar/${id}/complete`).then(r => r.data),
    delete: (id) => del(`/calendar/${id}`),
    upcoming: (days) => get('/calendar/upcoming', { days }).then(r => r.data),
    overdue: () => get('/calendar/overdue').then(r => r.data),
  };

  const dashboard = {
    overview: () => get('/dashboard').then(r => r.data),
    activity: () => get('/dashboard/activity').then(r => r.data),
  };

  const users = {
    list: (params) => get('/users', params).then(r => r.data),
    get: (id) => get(`/users/${id}`).then(r => r.data),
    stats: () => get('/users/stats').then(r => r.data),
  };

  const search = {
    query: (q, limit) => get('/search', { q, limit }).then(r => r.data),
  };

  return {
    ApiError, auth, reports, cases, clients, documents, calendar, dashboard, users, search,
    get, post, patch, del, on, off,
    get isAuthenticated() { return isAuthenticated(); },
    get user() { return currentUser; },
    get token() { return accessToken; },
  };
})();
