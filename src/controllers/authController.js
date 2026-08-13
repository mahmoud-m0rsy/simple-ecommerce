// Auth controller.
// We do NOT use Supabase's hosted auth here (avoids email confirmation, etc.).
// Instead we keep a `users` table in our own schema and sign short-lived JWTs
// locally with JWT_SECRET. The user record is also written to a `profiles`
// table (or upserted) for FK targets on orders.
//
// Expected tables:
//   users (id uuid pk, email text unique, password_hash text, full_name text,
//          created_at timestamptz default now())
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';
const JWT_EXPIRES_IN = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
  };
}

// POST /api/auth/signup  { email, password, fullName }
async function signup(req, res, next) {
  try {
    const { email, password, fullName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const normalisedEmail = String(email).trim().toLowerCase();

    // Check for existing user.
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalisedEmail)
      .maybeSingle();
    if (lookupErr) return next(lookupErr);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(String(password), 10);

    // Insert into users. We let Supabase generate the uuid via default.
    const { data: created, error: insertErr } = await supabaseAdmin
      .from('users')
      .insert({
        email: normalisedEmail,
        password_hash: passwordHash,
        full_name: fullName || null,
      })
      .select('id, email, full_name, created_at')
      .single();
    if (insertErr) return next(insertErr);

    const user = publicUser(created);
    const token = signToken({ sub: user.id, email: user.email });
    return res.status(201).json({ user, token });
  } catch (err) {
    return next(err);
  }
}

// POST /api/auth/login  { email, password }
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const normalisedEmail = String(email).trim().toLowerCase();
    const { data: row, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, created_at, password_hash')
      .eq('email', normalisedEmail)
      .maybeSingle();
    if (error) return next(error);
    if (!row) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(String(password), row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const user = publicUser(row);
    const token = signToken({ sub: user.id, email: user.email });
    return res.json({ user, token });
  } catch (err) {
    return next(err);
  }
}

// GET /api/auth/me  (protected — authMiddleware sets req.user)
async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { signup, login, me };
