// App entry — loads products, wires search and modal close behaviour.
(function () {
  const productGrid = document.getElementById('product-grid');
  const emptyState = document.getElementById('empty-state');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');

  function formatMoney(n) {
    const v = Number(n) || 0;
    return `$${v.toFixed(2)}`;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v != null) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function renderProducts(products) {
    productGrid.innerHTML = '';
    if (!products || products.length === 0) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    for (const p of products) {
      const stock = Number(p.stock);
      const inStock = !Number.isFinite(stock) || stock > 0;
      const card = el('article', { class: 'product-card' });

      // Image
      const imgWrap = el('div', { class: 'product-image' });
      if (p.image_url) {
        imgWrap.appendChild(el('img', { src: p.image_url, alt: p.name, loading: 'lazy' }));
      } else {
        imgWrap.appendChild(el('span', { class: 'placeholder', text: 'No image' }));
      }
      card.appendChild(imgWrap);

      card.appendChild(el('h3', { class: 'product-name', text: p.name }));
      if (p.description) {
        card.appendChild(el('p', { class: 'product-desc', text: p.description }));
      }
      card.appendChild(el('p', { class: 'product-price', text: formatMoney(p.price) }));
      if (Number.isFinite(stock)) {
        card.appendChild(el('p', { class: 'product-stock', text: inStock ? `In stock: ${stock}` : 'Out of stock' }));
      }

      const actions = el('div', { class: 'product-actions' });
      const addBtn = el('button', {
        class: 'btn btn-primary btn-block',
        type: 'button',
        text: inStock ? 'Add to cart' : 'Unavailable',
        disabled: inStock ? null : 'disabled',
        onclick: () => {
          if (!window.cart) return;
          window.cart.add({
            id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
          }, 1);
          // Tiny visual confirmation
          addBtn.textContent = 'Added ✓';
          setTimeout(() => { addBtn.textContent = 'Add to cart'; }, 900);
        },
      });
      actions.appendChild(addBtn);
      card.appendChild(actions);
      productGrid.appendChild(card);
    }
  }

  async function loadProducts(query) {
    productGrid.innerHTML = '';
    try {
      const { products } = await api.listProducts(query || '');
      renderProducts(products);
    } catch (err) {
      productGrid.innerHTML = '';
      emptyState.hidden = false;
      emptyState.textContent = `Failed to load products: ${err.message}`;
    }
  }

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

  document.addEventListener('DOMContentLoaded', () => {
    wireModalClose();
    wireSearch();
    loadProducts();
  });
})();
