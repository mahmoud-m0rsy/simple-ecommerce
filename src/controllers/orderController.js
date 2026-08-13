// Order controller — Cash on Delivery only.
// Inserts an `orders` row plus matching `order_items` rows in a single
// transaction-like flow. We rely on the Postgres `orders` + `order_items`
// tables; if any step fails, we return a 500 with the underlying message.
//
// Expected tables:
//   orders (id uuid pk default, user_id uuid fk users.id, status text,
//           total_price numeric, shipping_address jsonb, phone text,
//           notes text, created_at timestamptz default now())
//   order_items (id uuid pk default, order_id uuid fk orders.id,
//                product_id uuid fk products.id, name text, price numeric,
//                quantity int)
const { supabase, supabaseAdmin } = require('../config/supabase');

// Helpers
function calcItemSubtotal(item) {
  const price = Number(item.price) || 0;
  const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
  return price * qty;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'items must be a non-empty array';
  }
  for (const it of items) {
    if (!it.productId) return 'each item needs a productId';
    if (!it.name) return 'each item needs a name';
    if (Number.isNaN(Number(it.price))) return 'each item needs a numeric price';
    if (!Number.isFinite(parseInt(it.quantity, 10)) || parseInt(it.quantity, 10) < 1) {
      return 'each item needs quantity >= 1';
    }
  }
  return null;
}

// POST /api/orders  (protected)
// Body: { items: [{productId, name, price, quantity}], shippingAddress, phone, notes }
async function createOrder(req, res, next) {
  try {
    const { items, shippingAddress, phone, notes } = req.body || {};
    const err = validateItems(items);
    if (err) return res.status(400).json({ error: err });

    const totalPrice = items.reduce((sum, it) => sum + calcItemSubtotal(it), 0);
    const userId = req.user.id;

    // 1) Insert order header
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending', // COD: always starts pending
        total_price: totalPrice,
        shipping_address: shippingAddress || null,
        phone: phone || null,
        notes: notes || null,
      })
      .select('id, user_id, status, total_price, shipping_address, phone, notes, created_at')
      .single();
    if (orderErr) return next(orderErr);

    // 2) Insert order items
    const rows = items.map((it) => ({
      order_id: order.id,
      product_id: it.productId,
      name: it.name,
      price: Number(it.price),
      quantity: parseInt(it.quantity, 10) || 1,
    }));
    const { data: insertedItems, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(rows)
      .select('id, product_id, name, price, quantity');
    if (itemsErr) return next(itemsErr);

    return res.status(201).json({
      order: { ...order, items: insertedItems || [] },
      message: 'Order placed (Cash on Delivery).',
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/orders  (protected) — list the caller's orders
async function listMyOrders(req, res, next) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total_price, phone, shipping_address, notes, created_at, order_items(id, name, price, quantity, product_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return next(error);
    return res.json({ orders: data || [] });
  } catch (err) {
    return next(err);
  }
}

// GET /api/orders/:id  (protected) — fetch a single order owned by the caller
async function getOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('orders')
      .select('id, user_id, status, total_price, phone, shipping_address, notes, created_at, order_items(id, name, price, quantity, product_id)')
      .eq('id', id)
      .maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Order not found' });
    if (data.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    return res.json({ order: data });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createOrder, listMyOrders, getOrder };
