// Unified API helper.
// - Reads auth token from localStorage and attaches as Bearer.
// - Resolves with parsed JSON or throws { status, error }.
(function (global) {
  const TOKEN_KEY = 'simpleshop.token';
  const USER_KEY = 'simpleshop.user';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (_e) { return null; }
  }
  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (_e) { /* ignore quota errors */ }
  }
  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }
  function setUser(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch (_e) { /* ignore */ }
  }
  function clearAuth() {
    setToken(null);
    setUser(null);
  }

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (!token) {
        const err = new Error('Not authenticated');
        err.status = 401;
        throw err;
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(path, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (_e) { data = { raw: text }; }
    }

    if (!res.ok) {
      const err = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const api = {
    // products
    listProducts: (q) => {
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      return request(`/api/products${qs}`);
    },
    getProduct: (id) => request(`/api/products/${encodeURIComponent(id)}`),

    // auth
    signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
    login:  (payload) => request('/api/auth/login',  { method: 'POST', body: payload }),
    me:     () => request('/api/auth/me', { auth: true }),

    // orders (Cash on Delivery)
    createOrder: (payload) => request('/api/orders', { method: 'POST', body: payload, auth: true }),
    listMyOrders: () => request('/api/orders', { auth: true }),

    // session helpers
    getToken, setToken, getUser, setUser, clearAuth,
  };

  global.api = api;
})(window);
