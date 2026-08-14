// Toast notifications — floating, auto-dismissing, queueable.
// Exposes window.toast.show({ title, message, kind, duration }).
(function () {
  const ICONS = {
    success: '✓',
    wishlist: '♥',
    info: 'i',
    error: '!',
  };
  const DEFAULTS = {
    kind: 'info',
    duration: 2400,
  };

  let container = null;

  function ensureContainer() {
    if (container) return container;
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  }

  function show(opts) {
    const { title, message, kind, duration } = Object.assign({}, DEFAULTS, opts || {});
    const root = ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.setAttribute('role', 'status');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = ICONS[kind] || ICONS.info;
    toast.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'toast-body';
    if (title) {
      const t = document.createElement('p');
      t.className = 'toast-title';
      t.textContent = title;
      body.appendChild(t);
    }
    if (message) {
      const m = document.createElement('p');
      m.className = 'toast-msg';
      m.textContent = message;
      body.appendChild(m);
    }
    toast.appendChild(body);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '×';
    toast.appendChild(closeBtn);

    const dismiss = () => {
      if (toast.classList.contains('toast-out')) return;
      toast.classList.add('toast-out');
      // Remove after the slide-out animation finishes.
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 260);
    };
    closeBtn.addEventListener('click', dismiss);

    root.appendChild(toast);
    if (duration > 0) setTimeout(dismiss, duration);
    return { dismiss };
  }

  // Convenience shortcuts
  function success(title, message) { return show({ kind: 'success', title, message }); }
  function wishlist(title, message) { return show({ kind: 'wishlist', title, message }); }
  function info(title, message) { return show({ kind: 'info', title, message }); }
  function error(title, message) { return show({ kind: 'error', title, message, duration: 3600 }); }

  window.toast = { show, success, wishlist, info, error };
})();
