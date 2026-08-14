// Product controller — read-only catalog.
// Expected table:
//   products (id uuid pk, name text, description text, price numeric,
//             image_url text, stock int, category text, created_at timestamptz)
const { supabase } = require('../config/supabase');

// GET /api/products
// Optional query: ?q=search  (matches name ilike %q%)
async function listProducts(req, res, next) {
  try {
    const q = (req.query.q || '').toString().trim();
    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) return next(error);
    return res.json({ products: data || [] });
  } catch (err) {
    return next(err);
  }
}

// GET /api/products/:id
async function getProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Product not found' });
    return res.json({ product: data });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listProducts, getProduct };

