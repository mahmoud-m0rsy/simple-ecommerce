// Auth UI controller.
// Owns the auth modal, login/signup tabs, header user dropdown, and the
// styled logout confirmation modal. Persists session via api.setToken/setUser.
(function () {
  const authModal = document.getElementById('auth-modal');
  const logoutModal = document.getElementById('logout-modal');
  const ordersModal = document.getElementById('orders-modal');
  const openBtn = document.getElementById('open-auth');
  const authLabel = document.getElementById('auth-label');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const errorEl = document.getElementById('auth-error');
  const tabs = authModal.querySelectorAll('.tab');
  const tabPanes = authModal.querySelectorAll('[data-tab-pane]');

  // User dropdown
  const userMenu = document.getElementById('user-menu');
  const userDropdown = document.getElementById('user-dropdown');
  const userDropdownName = document.getElementById('user-dropdown-name');
  const userDropdownEmail = document.getElementById('user-dropdown-email');
  const userDropdownWishlistCount = document.getElementById('user-dropdown-wishlist-count');
  const menuMyOrders = document.getElementById('menu-my-orders');
  const menuWishlist = document.getElementById('menu-wishlist');
  const menuLogout = document.getElementById('menu-logout');
  const confirmLogoutBtn = document.getElementById('confirm-logout');

  // Orders modal elements
  const ordersList = document.getElementById('orders-list');
  const ordersEmpty = document.getElementById('orders-empty');
  const ordersError = document.getElementById('orders-error');

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

  function closeAuthModal() {
    authModal.hidden = true;
    showAuthError(null);
  }

  function openLogoutModal() {
    closeUserDropdown();
    if (logoutModal) logoutModal.hidden = false;
  }
  function closeLogoutModal() {
    if (logoutModal) logoutModal.hidden = true;
  }

  function isSignedIn() { return !!api.getUser(); }

  function refreshHeader() {
    const user = api.getUser();
    if (user) {
      const name = user.fullName || user.email || 'Account';
      authLabel.textContent = name;
      openBtn.title = 'Account menu';
      if (userDropdownName) userDropdownName.textContent = name;
      if (userDropdownEmail) userDropdownEmail.textContent = user.email || '';
    } else {
      authLabel.textContent = 'Sign in';
      openBtn.title = 'Sign in';
      if (userDropdownName) userDropdownName.textContent = 'Guest';
      if (userDropdownEmail) userDropdownEmail.textContent = 'Not signed in';
    }
    if (userDropdownWishlistCount && window.wishlist) {
      userDropdownWishlistCount.textContent = String(window.wishlist.count());
    }
  }

  function openUserDropdown() {
    if (!userDropdown) return;
    if (!isSignedIn()) {
      // No dropdown for guests — open auth modal directly.
      openAuthModal();
      return;
    }
    userDropdown.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
  }
  function closeUserDropdown() {
    if (!userDropdown) return;
    userDropdown.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleUserDropdown() {
    if (!userDropdown) return;
    if (userDropdown.hidden) openUserDropdown();
    else closeUserDropdown();
  }

  function signOut() {
    api.clearAuth();
    refreshHeader();
    closeLogoutModal();
    closeUserDropdown();
    if (window.toast) window.toast.info('Signed out', 'You have been signed out.');
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
      if (window.toast) window.toast.success('Welcome back', user.fullName || user.email);
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
      if (window.toast) window.toast.success('Account created', user.fullName || user.email);
    } catch (err) {
      showAuthError(err.message || 'Sign up failed');
    }
  }

  // -------- Orders --------
  function formatMoney(n) {
    const v = Number(n) || 0;
    return `$${v.toFixed(2)}`;
  }
  function openOrdersModal() {
    if (!isSignedIn()) {
      closeUserDropdown();
      openAuthModal();
      return;
    }
    closeUserDropdown();
    if (ordersError) { ordersError.hidden = true; ordersError.textContent = ''; }
    if (ordersList) ordersList.innerHTML = '';
    if (ordersEmpty) { ordersEmpty.hidden = true; }
    if (ordersModal) ordersModal.hidden = false;
    loadOrders();
  }
  function closeOrdersModal() { if (ordersModal) ordersModal.hidden = true; }
  async function loadOrders() {
    try {
      const data = await api.listMyOrders();
      const orders = (data && (data.orders || data)) || [];
      if (!Array.isArray(orders) || orders.length === 0) {
        if (ordersEmpty) ordersEmpty.hidden = false;
        return;
      }
      if (ordersEmpty) ordersEmpty.hidden = true;
      for (const o of orders) {
        const li = document.createElement('li');
        li.className = 'order-item';
        const date = o.created_at ? new Date(o.created_at).toLocaleString() : '';
        const total = Number(o.total ?? (o.items || []).reduce(
          (s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0
        ));
        const status = o.status || 'pending';
        const itemCount = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        li.innerHTML = `
          <div>
            <div class="name"></div>
            <div class="order-meta">
              <span class="order-status"></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="right">
            <div class="order-total"></div>
          </div>
        `;
        li.querySelector('.name').textContent = `Order #${o.id ? String(o.id).slice(0, 8) : ''}`;
        li.querySelectorAll('.order-meta span')[0].textContent = status;
        li.querySelectorAll('.order-meta span')[1].textContent = date;
        li.querySelectorAll('.order-meta span')[2].textContent = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
        li.querySelector('.order-total').textContent = formatMoney(total);
        ordersList.appendChild(li);
      }
    } catch (err) {
      if (ordersError) {
        ordersError.textContent = err.message || 'Failed to load orders';
        ordersError.hidden = false;
      }
    }
  }

  function onDocClick(e) {
    if (!userDropdown || userDropdown.hidden) return;
    if (userMenu && !userMenu.contains(e.target)) closeUserDropdown();
  }
  function onKey(e) {
    if (e.key === 'Escape' && userDropdown && !userDropdown.hidden) closeUserDropdown();
  }

  function wire() {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserDropdown();
    });

    tabs.forEach((t) => t.addEventListener('click', () => activateTab(t.dataset.tab)));
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);

    if (menuMyOrders) menuMyOrders.addEventListener('click', openOrdersModal);
    if (menuWishlist) menuWishlist.addEventListener('click', () => {
      closeUserDropdown();
      if (window.wishlistUI) window.wishlistUI.open();
    });
    if (menuLogout) menuLogout.addEventListener('click', openLogoutModal);
    if (confirmLogoutBtn) confirmLogoutBtn.addEventListener('click', signOut);

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);

    // Expose helpers for other modules.
    window.authUI = {
      refreshHeader,
      signOut,
      openAuthModal,
      closeAuthModal,
      openOrdersModal,
      isSignedIn,
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    wire();
    refreshHeader();
  });
})();
