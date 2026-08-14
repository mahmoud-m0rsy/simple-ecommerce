// Cart controller — localStorage-backed.
// Items shape: { productId, name, price, imageUrl, quantity }
(function () {
  const CART_KEY = 'simpleshop.cart';
  const cartModal = document.getElementById('cart-modal');
  const cartList = document.getElementById('cart-items');
  const cartEmpty = document.getElementById('cart-empty');
  const cartBadge = document.getElementById('cart-badge');
  const cartSubtotal = document.getElementById('cart-subtotal');
  const cartTotal = document.getElementById('cart-total');
  const checkoutTotal = document.getElementById('checkout-total');
  const checkoutForm = document.getElementById('checkout-form');
  const checkoutError = document.getElementById('checkout-error');
  const checkoutSuccess = document.getElementById('checkout-success');
  const checkoutModal = document.getElementById('checkout-modal');
  const goCheckoutBtn = document.getElementById('go-checkout');

  function read() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (_e) { /* ignore */ }
  }

  function formatMoney(n) {
    const v = Number(n) || 0;
    return `$${v.toFixed(2)}`;
  }

  function totalQty(items) { return items.reduce((s, i) => s + (Number(i.quantity) || 0), 0); }
  function totalPrice(items) { return items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0); }

  function add(product, quantity = 1) {
    const items = read();
    const idx = items.findIndex((i) => i.productId === product.id);
    let alreadyInCart = idx >= 0;
    if (alreadyInCart) {
      items[idx].quantity = (Number(items[idx].quantity) || 0) + quantity;
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        imageUrl: product.image_url || null,
        quantity: Math.max(1, quantity),
      });
    }
    write(items);
    bumpBadge();
    render();
    return { alreadyInCart, quantity: items[idx >= 0 ? idx : items.length - 1].quantity };
  }

  function setQty(productId, qty) {
    const items = read();
    const idx = items.findIndex((i) => i.productId === productId);
    if (idx < 0) return;
    const next = parseInt(qty, 10);
    if (!Number.isFinite(next) || next < 1) {
      items.splice(idx, 1);
    } else {
      items[idx].quantity = next;
    }
    write(items);
    render();
  }

  function remove(productId) {
    const items = read().filter((i) => i.productId !== productId);
    write(items);
    render();
  }

  function clear() {
    write([]);
    render();
  }

  function bumpBadge() {
    if (!cartBadge) return;
    cartBadge.textContent = String(totalQty(read()));
    cartBadge.classList.remove('bump');
    // Force reflow so the animation can re-trigger.
    void cartBadge.offsetWidth;
    cartBadge.classList.add('bump');
    setTimeout(() => cartBadge.classList.remove('bump'), 250);
  }

  function render() {
    const items = read();
    // Badge
    if (cartBadge) cartBadge.textContent = String(totalQty(items));

    // Cart list
    if (cartList) {
      cartList.innerHTML = '';
      for (const it of items) {
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.dataset.productId = it.productId;
        li.innerHTML = `
          <div>
            <div class="name"></div>
            <div class="meta"></div>
          </div>
          <div class="qty">
            <button type="button" class="dec" aria-label="Decrease">&minus;</button>
            <input type="number" min="1" class="qty-input" />
            <button type="button" class="inc" aria-label="Increase">+</button>
          </div>
          <div class="right">
            <div class="line-total"></div>
            <button type="button" class="remove">Remove</button>
          </div>
        `;
        li.querySelector('.name').textContent = it.name;
        li.querySelector('.meta').textContent = formatMoney(it.price) + ' each';
        const qtyInput = li.querySelector('.qty-input');
        qtyInput.value = String(it.quantity);
        li.querySelector('.line-total').textContent = formatMoney(it.price * it.quantity);
        li.querySelector('.dec').addEventListener('click', () => setQty(it.productId, it.quantity - 1));
        li.querySelector('.inc').addEventListener('click', () => setQty(it.productId, it.quantity + 1));
        qtyInput.addEventListener('change', (e) => setQty(it.productId, e.target.value));
        li.querySelector('.remove').addEventListener('click', () => remove(it.productId));
        cartList.appendChild(li);
      }
    }

    const subtotal = totalPrice(items);
    if (cartSubtotal) cartSubtotal.textContent = formatMoney(subtotal);
    if (cartTotal) cartTotal.textContent = formatMoney(subtotal); // shipping = free
    if (checkoutTotal) checkoutTotal.textContent = formatMoney(subtotal);

    const empty = items.length === 0;
    if (cartEmpty) cartEmpty.hidden = !empty;
    if (goCheckoutBtn) goCheckoutBtn.disabled = empty;
  }

  function openCart() {
    render();
    cartModal.hidden = false;
  }
  function closeCart() { cartModal.hidden = true; }

  function openCheckout() {
    if (read().length === 0) return;
    if (!api.getUser()) {
      // Force login first.
      if (window.authUI) window.authUI.openAuthModal();
      return;
    }
    // Prefill name/phone if available
    const user = api.getUser();
    if (user) {
      const fn = checkoutForm.querySelector('[name="fullName"]');
      if (fn && user.fullName) fn.value = user.fullName;
    }
    if (checkoutError) { checkoutError.hidden = true; checkoutError.textContent = ''; }
    if (checkoutSuccess) { checkoutSuccess.hidden = true; checkoutSuccess.textContent = ''; }
    render();
    checkoutModal.hidden = false;
  }

  async function submitCheckout(e) {
    e.preventDefault();
    if (checkoutError) { checkoutError.hidden = true; checkoutError.textContent = ''; }
    if (checkoutSuccess) { checkoutSuccess.hidden = true; checkoutSuccess.textContent = ''; }

    const items = read();
    if (items.length === 0) return;

    const fd = new FormData(checkoutForm);
    const payload = {
      items: items.map((it) => ({
        productId: it.productId,
        name: it.name,
        price: Number(it.price),
        quantity: Number(it.quantity),
      })),
      phone: fd.get('phone'),
      shippingAddress: fd.get('address'),
      notes: fd.get('notes') || undefined,
    };

    try {
      const result = await api.createOrder(payload);
      clear();
      closeCart();
      checkoutModal.hidden = true;
      if (window.toast) {
        window.toast.success(
          'Order placed',
          `Cash on Delivery — Order #${(result.order.id || '').slice(0, 8)}`
        );
      }
      checkoutForm.reset();
    } catch (err) {
      if (checkoutError) {
        checkoutError.textContent = err.message || 'Failed to place order';
        checkoutError.hidden = false;
      }
      if (err.status === 401 && window.authUI) {
        window.authUI.openAuthModal();
      }
    }
  }

  function wire() {
    document.getElementById('open-cart').addEventListener('click', openCart);
    if (goCheckoutBtn) goCheckoutBtn.addEventListener('click', openCheckout);
    if (checkoutForm) checkoutForm.addEventListener('submit', submitCheckout);

    window.cart = { add, remove, setQty, clear, render, read, totalPrice, totalQty };
  }

  document.addEventListener('DOMContentLoaded', () => {
    wire();
    render();
  });
})();
