// App entry — loads products, renders cards, wires search, category filter,
// wishlist toggles, the wishlist modal, and the shared modal close behaviour.
(function () {
  const productGrid = document.getElementById('product-grid');
  const emptyState = document.getElementById('empty-state');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const categoryBar = document.getElementById('category-bar');

  // Wishlist modal elements
  const wishlistModal = document.getElementById('wishlist-modal');
  const wishlistListEl = document.getElementById('wishlist-items');
  const wishlistEmptyEl = document.getElementById('wishlist-empty');
  const openWishlistBtn = document.getElementById('open-wishlist');

  // In-memory cache of products and current filter state.
  let allProducts = [];
  let activeCategory = 'all';

  // -------- helpers --------
  function formatMoney(n) {
    const v = Number(n) || 0;
    return `$${v.toFixed(2)}`;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v != null) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  // Each product carries its real `category` from the database.
  // We never overwrite it — the badge shows whatever the API returned.
  function categoryFor(product) {
    return product && product.category ? product.category : '';
  }

  function applyFilter(products, category) {
    if (!category || category === 'all') return products;
    return products.filter((p) => p && p.category === category);
  }

  // -------- product card rendering --------
  function renderProducts(products) {
    productGrid.innerHTML = '';
    if (!products || products.length === 0) {
      emptyState.hidden = false;
      emptyState.textContent = activeCategory === 'all'
        ? 'No products found.'
        : `No products found in "${activeCategory}".`;
      return;
    }
    emptyState.hidden = true;
    emptyState.textContent = 'No products found.';

    for (const p of products) {
      const stock = Number(p.stock);
      const inStock = !Number.isFinite(stock) || stock > 0;
      const isWished = window.wishlist ? window.wishlist.has(p.id) : false;
      const card = el('article', { class: 'product-card' });
      card.dataset.productId = p.id;

      // Image
      const imgWrap = el('div', { class: 'product-image' });
      if (p.image_url) {
        imgWrap.appendChild(el('img', { src: p.image_url, alt: p.name, loading: 'lazy' }));
      } else {
        imgWrap.appendChild(el('span', { class: 'placeholder', text: 'No image' }));
      }
      card.appendChild(imgWrap);

      // Category badge — shows the real product.category from the database.
      // Hidden when the product has no category so we never fabricate one.
      const productCategory = categoryFor(p);
      if (productCategory) {
        card.appendChild(el('span', {
          class: 'product-category',
          text: productCategory,
        }));
      }

      card.appendChild(el('h3', { class: 'product-name', text: p.name }));
      if (p.description) {
        card.appendChild(el('p', { class: 'product-desc', text: p.description }));
      }
      card.appendChild(el('p', { class: 'product-price', text: formatMoney(p.price) }));
      if (Number.isFinite(stock)) {
        card.appendChild(el('p', { class: 'product-stock', text: inStock ? `In stock: ${stock}` : 'Out of stock' }));
      }

      // Actions row: Add to cart + heart toggle
      const actions = el('div', { class: 'product-actions' });
      const addBtn = el('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: inStock ? 'Add to cart' : 'Unavailable',
        disabled: inStock ? null : 'disabled',
        onclick: () => {
          if (!window.cart) return;
          const result = window.cart.add({
            id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
          }, 1);
          const wasAlready = result && result.alreadyInCart;
          addBtn.textContent = wasAlready ? 'Added ✓' : 'Added ✓';
          setTimeout(() => { addBtn.textContent = 'Add to cart'; }, 900);
          if (window.toast) {
            window.toast.success(
              'Added to cart',
              wasAlready ? `${p.name} — quantity updated` : p.name
            );
          }
        },
      });
      actions.appendChild(addBtn);

      const heartBtn = el('button', {
        class: isWished ? 'wishlist-toggle active' : 'wishlist-toggle',
        type: 'button',
        'aria-label': isWished ? 'Remove from wishlist' : 'Add to wishlist',
        'aria-pressed': isWished ? 'true' : 'false',
        title: isWished ? 'Remove from wishlist' : 'Add to wishlist',
        onclick: () => {
          if (!window.wishlist) return;
          const nowWished = window.wishlist.toggle({
            id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
          });
          heartBtn.classList.toggle('active', nowWished);
          heartBtn.setAttribute('aria-pressed', nowWished ? 'true' : 'false');
          heartBtn.setAttribute(
            'aria-label',
            nowWished ? 'Remove from wishlist' : 'Add to wishlist'
          );
          heartBtn.title = nowWished ? 'Remove from wishlist' : 'Add to wishlist';
          if (window.toast) {
            if (nowWished) window.toast.wishlist('Added to wishlist', p.name);
            else window.toast.info('Removed from wishlist', p.name);
          }
          // If the wishlist modal is open, refresh it.
          if (wishlistModal && !wishlistModal.hidden) renderWishlistModal();
          // Keep the user-dropdown badge in sync.
          if (window.authUI) window.authUI.refreshHeader();
        },
      }, [el('span', { class: 'heart', text: isWished ? '♥' : '♡' })]);
      actions.appendChild(heartBtn);

      card.appendChild(actions);
      productGrid.appendChild(card);
    }
  }

  // -------- data loading --------
  async function loadProducts(query) {
    productGrid.innerHTML = '';
    try {
      const { products } = await api.listProducts(query || '');
      allProducts = Array.isArray(products) ? products : [];
      const filtered = applyFilter(allProducts, activeCategory);
      renderProducts(filtered);
    } catch (err) {
      productGrid.innerHTML = '';
      emptyState.hidden = false;
      emptyState.textContent = `Failed to load products: ${err.message}`;
    }
  }

  function applyCategory(category) {
    activeCategory = category;
    // Update active chip state
    if (categoryBar) {
      categoryBar.querySelectorAll('.category-chip').forEach((c) => {
        const isActive = c.dataset.category === category;
        c.classList.toggle('active', isActive);
        c.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }
    renderProducts(applyFilter(allProducts, activeCategory));
  }

  // -------- wishlist modal --------
  function renderWishlistModal() {
    if (!wishlistListEl || !window.wishlist) return;
    const items = window.wishlist.read();
    wishlistListEl.innerHTML = '';
    if (items.length === 0) {
      if (wishlistEmptyEl) wishlistEmptyEl.hidden = false;
      return;
    }
    if (wishlistEmptyEl) wishlistEmptyEl.hidden = true;
    for (const it of items) {
      const li = document.createElement('li');
      li.className = 'wishlist-item';
      li.dataset.productId = it.productId;
      li.innerHTML = `
        <div>
          <div class="name"></div>
          <div class="meta"></div>
        </div>
        <div class="right">
          <div class="line-total"></div>
          <div class="wishlist-item-actions">
            <button type="button" class="btn btn-primary move-to-cart">Add to cart</button>
            <button type="button" class="remove">Remove</button>
          </div>
        </div>
      `;
      li.querySelector('.name').textContent = it.name;
      li.querySelector('.meta').textContent = formatMoney(it.price) + ' each';
      li.querySelector('.line-total').textContent = formatMoney(it.price);
      li.querySelector('.move-to-cart').addEventListener('click', () => {
        if (!window.cart) return;
        window.cart.add({ id: it.productId, name: it.name, price: it.price, image_url: it.imageUrl }, 1);
        window.wishlist.remove(it.productId);
        if (window.toast) window.toast.success('Moved to cart', it.name);
        if (window.authUI) window.authUI.refreshHeader();
        renderWishlistModal();
        // Sync the heart on the underlying product card if rendered.
        syncProductCardHeart(it.productId);
      });
      li.querySelector('.remove').addEventListener('click', () => {
        window.wishlist.remove(it.productId);
        if (window.toast) window.toast.info('Removed from wishlist', it.name);
        if (window.authUI) window.authUI.refreshHeader();
        renderWishlistModal();
        syncProductCardHeart(it.productId);
      });
      wishlistListEl.appendChild(li);
    }
  }

  function syncProductCardHeart(productId) {
    const card = productGrid.querySelector(`.product-card[data-product-id="${CSS.escape(productId)}"]`);
    if (!card || !window.wishlist) return;
    const heart = card.querySelector('.wishlist-toggle');
    if (!heart) return;
    const wished = window.wishlist.has(productId);
    heart.classList.toggle('active', wished);
    heart.setAttribute('aria-pressed', wished ? 'true' : 'false');
    heart.setAttribute('aria-label', wished ? 'Remove from wishlist' : 'Add to wishlist');
    heart.title = wished ? 'Remove from wishlist' : 'Add to wishlist';
    const icon = heart.querySelector('.heart');
    if (icon) icon.textContent = wished ? '♥' : '♡';
  }

  function openWishlist() {
    if (!wishlistModal) return;
    renderWishlistModal();
    wishlistModal.hidden = false;
  }
  function closeWishlist() {
    if (wishlistModal) wishlistModal.hidden = true;
  }

  // Expose for the user dropdown menu callback.
  window.wishlistUI = { open: openWishlist, close: closeWishlist, render: renderWishlistModal };

  // -------- wiring --------
  function wireModalClose() {
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-close]');
      if (!target) return;
      const id = target.getAttribute('data-close');
      const m = document.getElementById(id);
      if (m) m.hidden = true;
    });
    // Escape closes any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal:not([hidden])').forEach((m) => { m.hidden = true; });
    });
  }

  function wireSearch() {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      loadProducts(q);
    });
  }

  function wireCategories() {
    if (!categoryBar) return;
    categoryBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;
      const cat = chip.dataset.category || 'all';
      applyCategory(cat);
    });
  }

  function wireWishlistButton() {
    if (openWishlistBtn) openWishlistBtn.addEventListener('click', openWishlist);
  }

  // Sync heart state on any cross-tab wishlist change.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('simpleshop.wishlist')) {
      if (window.wishlist) window.wishlist.renderBadge();
      if (window.authUI) window.authUI.refreshHeader();
      // Re-render visible cards so the heart stays in sync.
      renderProducts(applyFilter(allProducts, activeCategory));
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    wireModalClose();
    wireSearch();
    wireCategories();
    wireWishlistButton();
    if (window.wishlist) window.wishlist.renderBadge();
    loadProducts();
  });
})();
