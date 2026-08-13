// Supabase client initialization.
// Two clients are exported:
//   - supabase:    the standard client (uses anon key; respects RLS)
//   - supabaseAdmin: client using the service role key (bypasses RLS) — only used server-side
//                    for trusted operations like order creation where the user's JWT
//                    may not carry the right claims.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;            // anon / publishable key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // optional service role key

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Don't crash on require — let the server start and surface a clear error on first request.
  // This is more useful in production than a hard exit at boot.
  console.warn(
    '[supabase] Missing SUPABASE_URL or SUPABASE_KEY. Auth/DB calls will fail until set.'
  );
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : supabase; // fall back to anon client if no service key configured

module.exports = { supabase, supabaseAdmin };
