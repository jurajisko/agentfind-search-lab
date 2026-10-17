import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGE_SOURCES, clientIp, inCidr, ipFacts, loadRanges, operatorsFor, parseCidr, parseIp, rangesFrom, verdict } from './verify.mjs';

test('parses IPv4, IPv6 and IPv4-mapped IPv6', () => {
  assert.deepEqual(parseIp('66.249.66.1'), { version: 4, value: 0x42f94201n });
  assert.equal(parseIp('2001:4860:4801:10::1').version, 6);
  assert.equal(parseIp('2001:4860:4801:10::1').value, parseIp('2001:4860:4801:0010:0000:0000:0000:0001').value);
  assert.deepEqual(parseIp('::ffff:66.249.66.1'), parseIp('66.249.66.1'));
  assert.deepEqual(parseIp('::ffff:42f9:4201'), parseIp('66.249.66.1'));
  assert.equal(parseIp('::1').value, 1n);
  for (const bad of ['', 'x', '1.2.3', '256.1.1.1', '1::2::3', '1:2:3:4:5:6:7:8:9', '12345::1']) assert.equal(parseIp(bad), null, bad);
});

test('matches addresses against CIDR ranges of the same family only', () => {
  const v4 = parseCidr('66.249.64.0/19');
  assert.equal(inCidr(parseIp('66.249.66.1'), v4), true);
  assert.equal(inCidr(parseIp('66.249.96.1'), v4), false);
  const v6 = parseCidr('2001:4860:4801:10::/64');
  assert.equal(inCidr(parseIp('2001:4860:4801:10:abcd::1'), v6), true);
  assert.equal(inCidr(parseIp('2001:4860:4801:11::1'), v6), false);
  assert.equal(inCidr(parseIp('66.249.66.1'), v6), false);
  assert.equal(inCidr(parseIp('10.0.0.1'), parseCidr('10.0.0.1')), true);
  assert.equal(inCidr(parseIp('8.8.8.8'), parseCidr('0.0.0.0/0')), true);
  assert.equal(parseCidr('10.0.0.0/33'), null);
});

test('reads the prefix format every operator publishes', () => {
  const cidrs = rangesFrom({ prefixes: [{ ipv4Prefix: '20.15.0.0/16' }, { ipv6Prefix: '2600:1f28::/32' }, { ipv4Prefix: 'junk' }] });
  assert.equal(cidrs.length, 2);
  assert.deepEqual(rangesFrom(null), []);
});

const index = new Map([
  ['openai', [parseCidr('20.125.66.80/28')]],
  ['google', [parseCidr('66.249.64.0/19'), parseCidr('2001:4860:4801::/48')]],
  ['anthropic', [parseCidr('216.73.216.0/22')]]
]);

test('finds the operators behind an address', () => {
  assert.deepEqual(operatorsFor('20.125.66.81', index), ['openai']);
  assert.deepEqual(operatorsFor('2001:4860:4801:10::5', index), ['google']);
  assert.deepEqual(operatorsFor('8.8.8.8', index), []);
  assert.deepEqual(operatorsFor('', index), []);
  assert.deepEqual(operatorsFor('20.125.66.81', null), []);
});

test('confirms or exposes a claimed crawler', () => {
  assert.equal(verdict({ crawlerName: 'Googlebot', operators: ['google'], index }), 'verified');
  // The botnet case: a crawler name from an address its operator does not use.
  assert.equal(verdict({ crawlerName: 'Googlebot', operators: [], index }), 'spoofed');
  assert.equal(verdict({ crawlerName: 'GPTBot', operators: ['google'], index }), 'spoofed');
  // Operators without published ranges, and lists that failed to load.
  assert.equal(verdict({ crawlerName: 'Amazonbot', operators: [], index }), 'unlisted');
  assert.equal(verdict({ crawlerName: 'Bingbot', operators: [], index }), 'unavailable');
  assert.equal(verdict({ crawlerName: 'Bingbot', operators: [], index: null }), 'unavailable');
  // No claim, nothing to check: the operator is still recorded separately.
  assert.equal(verdict({ crawlerName: null, operators: ['openai'], index }), null);
});

test('overlapping ranges: the claimed operator wins when it matches', () => {
  const shared = new Map([['openai', [parseCidr('192.0.2.0/24')]], ['google', [parseCidr('192.0.2.0/24')]]]);
  assert.deepEqual(ipFacts({ crawlerName: 'Googlebot', ip: '192.0.2.1', index: shared }), { ip_operator: 'google', ip_check: 'verified' });
  assert.deepEqual(ipFacts({ crawlerName: null, ip: '192.0.2.1', index: shared }), { ip_operator: 'openai', ip_check: null });
  assert.deepEqual(ipFacts({ crawlerName: 'Googlebot', ip: '', index: shared }), { ip_operator: null, ip_check: 'unavailable' });
});

test('Claude Code fetching from the user computer is not a forgery', () => {
  const ua = 'Claude-User (claude-code/2.1.269; +https://support.anthropic.com/)';
  assert.equal(verdict({ crawlerName: 'Claude-User', userAgent: ua, operators: [], index }), 'client_side');
  assert.equal(verdict({ crawlerName: 'Claude-User', userAgent: 'Mozilla/5.0 (compatible; Claude-User/1.0)', operators: [], index }), 'spoofed');
});

test('an operator with a list that fails to load is left out, not half loaded', async () => {
  const fake = async url => {
    if (url === RANGE_SOURCES.openai[1]) return new Response('nope', { status: 500 });
    if (url === RANGE_SOURCES.google[0]) return new Response(JSON.stringify({ prefixes: [] }));
    return new Response(JSON.stringify({ prefixes: [{ ipv4Prefix: '192.0.2.0/24' }] }));
  };
  const loaded = await loadRanges(fake);
  assert.equal(loaded.has('openai'), false);
  assert.equal(loaded.has('google'), false);
  assert.equal(loaded.has('anthropic'), true);
  assert.equal(loaded.size, Object.keys(RANGE_SOURCES).length - 2);
});

test('takes the client address Vercel provides', () => {
  assert.equal(clientIp(new Headers({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.1' })), '203.0.113.9');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' })), '198.51.100.1');
  assert.equal(clientIp(new Headers()), '');
});
