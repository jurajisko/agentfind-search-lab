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

test('with the right password returns the analysed report and hides test rows', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.ADMIN_PASSWORD = 'correct-horse';
  const rows = [
    { event_type: 'claimed_crawler_request', path: '/robots.txt', user_agent: 'Mozilla/5.0 (compatible; GPTBot/1.2)', resource_kind: 'robots', metadata: {}, occurred_at: '2026-09-20T10:00:00.000Z' },
    { event_type: 'observed_request', path: '/priroda/', user_agent: 'curl/8.5.0', resource_kind: 'section', metadata: {}, occurred_at: '2026-09-20T10:01:00.000Z' },
    { event_type: 'observed_request', path: '/', user_agent: 'curl/8.21.0', resource_kind: 'home', metadata: { is_test: true }, occurred_at: '2026-09-20T10:02:00.000Z' }
  ];
  const audit = { score: 90, counts: { ok: 9, warn: 1, fail: 0, test: 3 }, pages: 59, stages: [{ id: 'access', score: 100 }], checks: [{ id: 'x', stage: 'access', status: 'warn', title: 'Test', result: 'r', why: 'w', evidence: 'documented', weight: 1 }] };
  const realFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async url => {
    requested.push(String(url));
    const body = String(url).endsWith('/admin/audit.json') ? audit : rows;
    return new Response(JSON.stringify(body), { status: 200 });
  };
  try {
    const response = await call({ Authorization: 'Bearer correct-horse' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(requested.some(u => u.startsWith('https://example.supabase.co/rest/v1/search_lab_events?')));
    assert.ok(requested.includes('https://lab.test/admin/audit.json'));
    assert.equal(body.rowsRead, 3);
    assert.equal(body.testRowsHidden, 1);
    assert.equal(body.totals.fetches, 2);
    assert.equal(body.purposes.find(p => p.id === 'training').requests, 1);
    assert.equal(body.agents.find(a => a.name === 'curl').category, 'tool');
    // The human report and its exports come with the numbers.
    assert.equal(body.report.auditScore, 90);
    assert.ok(body.reportHtml.includes('Zhrnutie'));
    assert.ok(body.reportDocument.startsWith('<!doctype html>'));
    assert.ok(body.agentsCsv.startsWith('﻿Agent;'));
    assert.ok(!JSON.stringify(body).includes('service-key'));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('never echoes the service key or password in an error body', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-should-not-leak';
  process.env.ADMIN_PASSWORD = 'password-should-not-leak';
  const body = await (await call({ Authorization: 'Bearer wrong' })).text();
  assert.ok(!body.includes('service-key-should-not-leak'));
  assert.ok(!body.includes('password-should-not-leak'));
});
