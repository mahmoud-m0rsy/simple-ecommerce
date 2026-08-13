// Auth middleware.
// Verifies the Bearer token signed by authController.signToken, then
// hydrates req.user from the `users` table so handlers can use req.user.id.
//
// Adds an `optional` variant for endpoints that should work both ways
// (e.g. /api/orders could be optionally authenticated to merge a guest cart).
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return null;
  const [scheme, value] = String(header).split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Hydrate user record (so req.user has the latest email/name).
  (async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, created_at')
        .eq('id', payload.sub)
        .maybeSingle();
      if (error) return next(error);
      if (!data) return res.status(401).json({ error: 'User no longer exists' });
      req.user = {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        createdAt: data.created_at,
      };
      return next();
    } catch (e) {
      return next(e);
    }
  })();
}

function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
  } catch (_e) {
    // ignore — treat as anonymous
  }
  return next();
}

module.exports = { requireAuth, optionalAuth };
