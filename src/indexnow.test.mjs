import assert from 'node:assert/strict';
import test from 'node:test';
import { INDEXNOW_KEY, changedUrls, keyLocation, payloads } from './indexnow.mjs';

test('submits only new, changed and removed URLs', () => {
  const previous = { 'https://lab.test/a/': '1', 'https://lab.test/b/': '2', 'https://lab.test/gone/': '3' };
  const current = { 'https://lab.test/a/': '1', 'https://lab.test/b/': 'changed', 'https://lab.test/new/': '4' };
  assert.deepEqual(changedUrls(previous, current), ['https://lab.test/b/', 'https://lab.test/gone/', 'https://lab.test/new/']);
});

test('the first submission sends every URL, an unchanged build sends none', () => {
  const current = { 'https://lab.test/': '1', 'https://lab.test/a/': '2' };
  assert.deepEqual(changedUrls({}, current), ['https://lab.test/', 'https://lab.test/a/']);
  assert.deepEqual(changedUrls(current, current), []);
});

test('the payload names the host and where the key can be checked', () => {
  const [body] = payloads('https://lab.test/', ['https://lab.test/a/']);
  assert.equal(body.host, 'lab.test');
  assert.equal(body.key, INDEXNOW_KEY);
  assert.equal(body.keyLocation, `https://lab.test/${INDEXNOW_KEY}.txt`);
  assert.equal(keyLocation('https://lab.test'), body.keyLocation);
  assert.deepEqual(body.urlList, ['https://lab.test/a/']);
});

test('nothing to submit means no request at all', () => {
  assert.deepEqual(payloads('https://lab.test', []), []);
});

test('the key has the form the middleware recognises', () => {
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
});
