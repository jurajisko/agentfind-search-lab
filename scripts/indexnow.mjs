/**
 * Submits the pages that changed between two builds to IndexNow.
 *
 * Runs after a production deployment (.github/workflows/indexnow.yml), which
 * builds both the deployed commit and the previous production commit. Each
 * build's URLs come from its sitemap.xml and each page is hashed, so a page
 * counts as changed when its HTML differs. Without a previous build every page
 * is submitted.
 *
 *   node scripts/indexnow.mjs [--previous <dist dir>] [--dry-run]
 *
 * --previous  the previous production build (default: none)
 * --dry-run   only list what would be submitted
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, changedUrls, keyLocation, payloads } from '../src/indexnow.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const previousAt = args.indexOf('--previous');
const previousDist = previousAt >= 0 ? path.resolve(args[previousAt + 1]) : null;

/** URL -> sha256 of the page's HTML, for every URL in a build's sitemap. */
async function pageHashes(dist) {
  const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
  const hashes = {};
  for (const [, url] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const html = await readFile(path.join(dist, new URL(url).pathname, 'index.html'));
    hashes[url] = createHash('sha256').update(html).digest('hex');
  }
  return hashes;
}

const current = await pageHashes(path.join(root, 'dist'));
const urls = Object.keys(current);
if (!urls.length) throw new Error('dist/sitemap.xml has no URLs. Run npm run build first.');
const siteUrl = new URL(urls[0]).origin;

let previous = {};
if (previousDist) previous = await pageHashes(previousDist);
else console.log('No previous build given: submitting every page.');

const toSubmit = changedUrls(previous, current);
console.log(`${toSubmit.length} of ${urls.length} URLs changed since the previous build.`);
toSubmit.forEach(url => console.log(`  ${url}`));

if (dryRun || !toSubmit.length) process.exit(0);

// An engine rejects the whole submission when it cannot read the key, so
// check first that the deployment serving it is the live one.
const key = await fetch(keyLocation(siteUrl), { signal: AbortSignal.timeout(15000) });
const served = key.ok ? (await key.text()).trim() : '';
if (served !== INDEXNOW_KEY) {
  throw new Error(`${keyLocation(siteUrl)} returned HTTP ${key.status} without the key. Is the deployment live?`);
}

for (const body of payloads(siteUrl, toSubmit)) {
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  // 200: accepted. 202: accepted, key validation still pending.
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow answered HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  console.log(`IndexNow accepted ${body.urlList.length} URLs (HTTP ${response.status}).`);
}
