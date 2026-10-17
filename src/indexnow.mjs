/**
 * IndexNow: tells the participating search engines (Bing, and through it
 * Copilot; Yandex, Seznam, Naver, Yep) which URLs changed, instead of waiting
 * until they recrawl on their own. One submission to the shared endpoint
 * reaches all of them.
 *
 * The key is public by design. It is served at /<key>.txt so an engine can
 * check that whoever submits URLs also controls the site.
 *
 * Only changed, new and removed URLs are submitted. Engines ask not to be sent
 * unchanged URLs again, so the build of the deployed commit is compared with
 * the build of the previous production commit, as maps of URL -> page hash.
 */
export const INDEXNOW_KEY = 'da408d8ce09675b416388d49028b52e7';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
// The protocol limit for one request.
const MAX_URLS = 10000;

export const keyLocation = siteUrl => `${siteUrl.replace(/\/$/, '')}/${INDEXNOW_KEY}.txt`;

/** URLs that are new, changed or removed between two URL -> hash maps. */
export function changedUrls(previous, current) {
  const changed = Object.keys(current).filter(url => previous[url] !== current[url]);
  // A removed page is submitted too, so the engine recrawls it, sees the 404
  // and drops it.
  const removed = Object.keys(previous).filter(url => !(url in current));
  return [...changed, ...removed].sort();
}

export function payloads(siteUrl, urls) {
  const host = new URL(siteUrl).host;
  const batches = [];
  for (let i = 0; i < urls.length; i += MAX_URLS) {
    batches.push({ host, key: INDEXNOW_KEY, keyLocation: keyLocation(siteUrl), urlList: urls.slice(i, i + MAX_URLS) });
  }
  return batches;
}
