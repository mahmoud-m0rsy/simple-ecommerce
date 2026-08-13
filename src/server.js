// Express entry point.
// - Loads .env, mounts JSON + CORS, serves /public statically.
// - Mounts API under /api.
// - Has a small health route for quick smoke checks.
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'simple-ecommerce' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// 404 for unknown /api paths (frontend 404s are handled by static fallback below)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Centralised error handler — keeps response shape consistent for the frontend.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server]', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
