// Smoke test: boot the Express app on an ephemeral port and hit a couple of routes.
// We do NOT need real Supabase credentials here because we only exercise routes
// that don't touch the database, and we expect 500/400 from DB-dependent paths.
process.env.PORT = '0';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://example.invalid';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'dummy';
process.env.JWT_SECRET = 'test_secret';

const http = require('http');
const test = require('node:test');
const assert = require('node:assert');

const app = require('../src/server');

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function get(server, path) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET' },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('GET /api/health returns ok', async () => {
  const server = await listen();
  try {
    const { status, body } = await get(server, '/api/health');
    assert.strictEqual(status, 200);
    const data = JSON.parse(body);
    assert.strictEqual(data.ok, true);
  } finally {
    server.close();
  }
});

test('GET /api/unknown returns 404 json', async () => {
  const server = await listen();
  try {
    const { status, body } = await get(server, '/api/nope');
    assert.strictEqual(status, 404);
    assert.match(body, /Not found/);
  } finally {
    server.close();
  }
});

test('POST /api/auth/login with bad payload returns 400', async () => {
  const { status, body } = await new Promise((resolve, reject) => {
    listen().then((server) => {
      const { port } = server.address();
      const data = JSON.stringify({});
      const req = http.request(
        { host: '127.0.0.1', port, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
        (res) => {
          let b = '';
          res.on('data', (c) => (b += c));
          res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: b }); });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  });
  assert.strictEqual(status, 400);
  assert.match(body, /required/);
});

test('GET /api/orders without auth returns 401', async () => {
  const server = await listen();
  try {
    const { status, body } = await get(server, '/api/orders');
    assert.strictEqual(status, 401);
    assert.match(body, /Missing Authorization/);
  } finally {
    server.close();
  }
});
