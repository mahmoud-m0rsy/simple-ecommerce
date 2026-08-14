// Wishlist controller — localStorage-backed.
// Items shape: { productId, name, price, imageUrl, addedAt }
(function () {
  const KEY = 'simpleshop.wishlist';

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_e) { /* ignore */ }
  }

  function has(productId) {
    return read().some((i) => i.productId === productId);
  }

  function add(product) {
    const items = read();
    if (items.some((i) => i.productId === product.id)) return false;
    items.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      imageUrl: product.image_url || null,
      addedAt: Date.now(),
    });
    write(items);
    return true;
  }

  function remove(productId) {
    const items = read().filter((i) => i.productId !== productId);
    write(items);
    return items.length !== read().length; // best-effort; we re-read below
  }

  function toggle(product) {
    if (has(product.id)) {
      remove(product.id);
      return false;
    }
    add(product);
    return true;
  }

  function clear() { write([]); }

  function count() { return read().length; }

  function renderBadge() {
    const badge = document.getElementById('wishlist-badge');
    if (badge) badge.textContent = String(count());
  }

  function bumpBadge() {
    const badge = document.getElementById('wishlist-badge');
    if (!badge) return;
    badge.textContent = String(count());
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
    setTimeout(() => badge.classList.remove('bump'), 250);
  }

  // Public API
  window.wishlist = { read, has, add, remove, toggle, clear, count, renderBadge, bumpBadge };
})();
