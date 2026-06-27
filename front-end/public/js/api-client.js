const NJApi = (() => {
  const BASE = '/api';
  let accessToken = localStorage.getItem('nj_access_token');
  let refreshToken = localStorage.getItem('nj_refresh_token');
  let currentUser = JSON.parse(localStorage.getItem('nj_user') || 'null');
  let refreshPromise = null;
  const listeners = { auth: [], user: [] };

  function on(event, fn) { listeners[event]?.push(fn); }
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

  function isAuthenticated() {
    return !!accessToken;
  }

  function isTokenExpiring() {
    const exp = Number(localStorage.getItem('nj_token_expires') || 0);
    return exp > 0 && (exp - Date.now()) < 60000;
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
        if (json.success && json.data) {
          setTokens(json.data);
          return true;
        }
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

    const res = await fetch(url, config);

    if (res.status === 401 && refreshToken && !opts.noRetry) {
      const refreshed = await tryRefresh();
      if (refreshed) return request(method, path, body, { ...opts, noRetry: true });
      clearAuth();
      emit('auth', null);
      window.location.href = '/auth#login';
      throw new Error('Sessao expirada');
    }

    if (res.status === 204) return { success: true, data: null };

    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json.error?.message || `Erro ${res.status}`);
      err.status = res.status;
      err.code = json.error?.code;
      err.details = json.error?.details;
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
      window.location.href = '/auth#login';
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
    async sessions() { return (await get('/auth/sessions')).data; },
    async loginHistory(limit) { return (await get('/auth/login-history', { limit })).data; },
    async revokeSession(id) { return del(`/auth/sessions/${id}`); },
    async forgotPassword(email) { return (await post('/auth/forgot-password', { email })).data; },
    async resetPassword(data) { return (await post('/auth/reset-password', data)).data; },
    async changePassword(data) { return (await post('/auth/change-password', data)).data; },
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
    auth, reports, cases, clients, documents, calendar, dashboard, users, search,
    get, post, patch, del, on,
    get isAuthenticated() { return isAuthenticated(); },
    get user() { return currentUser; },
    get token() { return accessToken; },
  };
})();
