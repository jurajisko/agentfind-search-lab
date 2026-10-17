/**
 * Submits the pages that changed since the last submission to IndexNow.
 *
 * Runs after a production deployment (.github/workflows/indexnow.yml), on a
 * fresh build of the deployed commit. Reads the URLs from dist/sitemap.xml,
 * hashes each page's HTML and compares the hashes with the state file of the
 * previous submission. The state file is written only after the engines
 * accepted the submission, so a failed run is retried in full next time.
 *
 *   node scripts/indexnow.mjs            submit
 *   node scripts/indexnow.mjs --dry-run  only list what would be submitted
 *
 * INDEXNOW_STATE overrides the state file (default .indexnow/state.json).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, changedUrls, keyLocation, payloads } from '../src/indexnow.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const statePath = path.resolve(root, process.env.INDEXNOW_STATE || '.indexnow/state.json');
const dryRun = process.argv.includes('--dry-run');

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (!urls.length) throw new Error('dist/sitemap.xml has no URLs. Run npm run build first.');
const siteUrl = new URL(urls[0]).origin;

const current = {};
for (const url of urls) {
  const html = await readFile(path.join(dist, new URL(url).pathname, 'index.html'));
  current[url] = createHash('sha256').update(html).digest('hex');
}

let previous = {};
try {
  previous = JSON.parse(await readFile(statePath, 'utf8')).pages || {};
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.log('No previous submission found: submitting every page.');
}

const toSubmit = changedUrls(previous, current);
console.log(`${toSubmit.length} of ${urls.length} URLs changed since the last submission.`);
toSubmit.forEach(url => console.log(`  ${url}`));

if (dryRun) process.exit(0);

if (toSubmit.length) {
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
}

await mkdir(path.dirname(statePath), { recursive: true });
await writeFile(statePath, `${JSON.stringify({ submittedAt: new Date().toISOString(), siteUrl, pages: current }, null, 2)}\n`);
