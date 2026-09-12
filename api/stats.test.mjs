import assert from 'node:assert/strict';
import test from 'node:test';

// The guard is the security boundary: nothing past it may run without the
// password, and the endpoint must refuse to run at all when unconfigured.
const handler = (await import('./stats.js')).default;
const call = (headers = {}, method = 'GET') =>
  handler.fetch(new Request('https://lab.test/api/stats', { method, headers }));

test('refuses to serve when not configured', async () => {
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  delete process.env.ADMIN_PASSWORD;
  const response = await call({ Authorization: 'Bearer anything' });
  assert.equal(response.status, 503);
});

test('rejects missing, wrong, and same-length wrong passwords', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.ADMIN_PASSWORD = 'correct-horse';
  assert.equal((await call()).status, 401);
  assert.equal((await call({ Authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await call({ Authorization: 'Bearer correct-horsX' })).status, 401);
  assert.equal((await call({ Authorization: 'Basic correct-horse' })).status, 401);
});

test('only GET is accepted', async () => {
  process.env.ADMIN_PASSWORD = 'correct-horse';
  assert.equal((await call({ Authorization: 'Bearer correct-horse' }, 'POST')).status, 405);
});

test('never echoes the service key or password in an error body', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-should-not-leak';
  process.env.ADMIN_PASSWORD = 'password-should-not-leak';
  const body = await (await call({ Authorization: 'Bearer wrong' })).text();
  assert.ok(!body.includes('service-key-should-not-leak'));
  assert.ok(!body.includes('password-should-not-leak'));
});
