// Auth UI controller.
// Owns the auth modal, login/signup tabs, header state, and persists session
// via api.setToken / api.setUser.
(function () {
  const authModal = document.getElementById('auth-modal');
  const openBtn = document.getElementById('open-auth');
  const authLabel = document.getElementById('auth-label');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const errorEl = document.getElementById('auth-error');
  const tabs = authModal.querySelectorAll('.tab');
  const tabPanes = authModal.querySelectorAll('[data-tab-pane]');

  function showAuthError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
    errorEl.hidden = !msg;
  }

  function activateTab(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    tabPanes.forEach((p) => { p.hidden = p.dataset.tabPane !== name; });
    showAuthError(null);
  }

  function openAuthModal() {
    showAuthError(null);
    authModal.hidden = false;
    activateTab('login');
    const firstInput = authModal.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  function closeAuthModal() { authModal.hidden = true; }

  function refreshHeader() {
    const user = api.getUser();
    if (user) {
      authLabel.textContent = user.fullName ? user.fullName : (user.email || 'Account');
      openBtn.title = 'Signed in — click to manage';
    } else {
      authLabel.textContent = 'Sign in';
    }
  }

  function signOut() {
    api.clearAuth();
    refreshHeader();
  }

  async function handleLogin(e) {
    e.preventDefault();
    showAuthError(null);
    const fd = new FormData(loginForm);
    const payload = {
      email: fd.get('email'),
      password: fd.get('password'),
    };
    try {
      const { user, token } = await api.login(payload);
      api.setToken(token);
      api.setUser(user);
      loginForm.reset();
      closeAuthModal();
      refreshHeader();
    } catch (err) {
      showAuthError(err.message || 'Login failed');
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    showAuthError(null);
    const fd = new FormData(signupForm);
    const payload = {
      email: fd.get('email'),
      password: fd.get('password'),
      fullName: fd.get('fullName') || undefined,
    };
    try {
      const { user, token } = await api.signup(payload);
      api.setToken(token);
      api.setUser(user);
      signupForm.reset();
      closeAuthModal();
      refreshHeader();
    } catch (err) {
      showAuthError(err.message || 'Sign up failed');
    }
  }

  function wire() {
    openBtn.addEventListener('click', () => {
      // If signed in, offer sign out via a confirm.
      if (api.getUser()) {
        if (confirm('Sign out of your account?')) signOut();
        return;
      }
      openAuthModal();
    });

    tabs.forEach((t) => t.addEventListener('click', () => activateTab(t.dataset.tab)));

    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);

    // Expose signOut for app.js if it needs to clear after order etc.
    window.authUI = { refreshHeader, signOut, openAuthModal, closeAuthModal };
  }

  document.addEventListener('DOMContentLoaded', () => {
    wire();
    refreshHeader();
  });
})();
