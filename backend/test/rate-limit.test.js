// Regressão do limitador de requisições. Roda contra o build (dist), sem banco: npm run test:scope
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRateLimiter } = require(path.join(__dirname, '..', 'dist', 'common/security/rate-limit'));

function run(limiter, { url, ip = '10.0.0.1', headers = {} }) {
  const res = { headers: {}, statusCode: 200, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let passed = false;
  limiter({ path: url, url, ip, headers }, res, () => { passed = true; });
  return { passed, res };
}

test('rotas públicas bloqueiam depois do limite e informam Retry-After', () => {
  const limiter = createRateLimiter({ publicPerMinute: 3, apiPerMinute: 100 });
  for (let i = 0; i < 3; i++) assert.ok(run(limiter, { url: '/api/auth/login' }).passed);
  const blocked = run(limiter, { url: '/api/auth/login' });
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.ok(Number(blocked.res.headers['Retry-After']) >= 1);
});

test('o limite da API é por usuário, não por IP: dois usuários no mesmo IP não dividem a cota', () => {
  const limiter = createRateLimiter({ apiPerMinute: 2, publicPerMinute: 10 });
  const a = { url: '/api/customers', headers: { authorization: 'Bearer token-a' } };
  const b = { url: '/api/customers', headers: { authorization: 'Bearer token-b' } };
  assert.ok(run(limiter, a).passed); assert.ok(run(limiter, a).passed);
  assert.equal(run(limiter, a).passed, false);
  assert.ok(run(limiter, b).passed);
});

test('health e webhook do Inter nunca são limitados', () => {
  const limiter = createRateLimiter({ apiPerMinute: 1, publicPerMinute: 1 });
  for (let i = 0; i < 20; i++) {
    assert.ok(run(limiter, { url: '/api/health' }).passed);
    assert.ok(run(limiter, { url: '/api/inter/webhook' }).passed);
  }
});

test('a janela reinicia depois de um minuto', () => {
  let t = 1_000_000;
  const limiter = createRateLimiter({ publicPerMinute: 1, apiPerMinute: 1, now: () => t });
  assert.ok(run(limiter, { url: '/api/portal/public/login' }).passed);
  assert.equal(run(limiter, { url: '/api/portal/public/login' }).passed, false);
  t += 61_000;
  assert.ok(run(limiter, { url: '/api/portal/public/login' }).passed);
});

test('RATE_LIMIT=off desliga o limitador', () => {
  process.env.RATE_LIMIT = 'off';
  try {
    const limiter = createRateLimiter({ publicPerMinute: 1, apiPerMinute: 1 });
    for (let i = 0; i < 5; i++) assert.ok(run(limiter, { url: '/api/auth/login' }).passed);
  } finally { delete process.env.RATE_LIMIT; }
});
