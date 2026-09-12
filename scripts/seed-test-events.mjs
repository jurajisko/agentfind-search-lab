/**
 * Writes clearly marked synthetic events so the reports can be built and read
 * before any real crawler shows up.
 *
 * Every row carries metadata.is_test = true and metadata.seed = SEED_TAG, so
 * the reporting queries already exclude them and `--delete` can remove exactly
 * these rows and nothing else.
 *
 * These numbers are invented. They are for checking that a query returns what
 * you expect. They are never evidence about real crawler behaviour and must
 * never appear in anything shown to a customer.
 *
 *   node scripts/seed-test-events.mjs          # insert
 *   node scripts/seed-test-events.mjs --delete # remove them again
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. Do not
 * paste the key into a file; export it in the shell for the one command.
 */
const SEED_TAG = 'synthetic-v1';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json'
};

if (process.argv.includes('--delete')) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/search_lab_events?metadata->>seed=eq.${SEED_TAG}`,
    { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } }
  );
  if (!response.ok) throw new Error(`Delete failed: HTTP ${response.status}`);
  console.log(`Deleted every row tagged seed=${SEED_TAG}.`);
  process.exit(0);
}

const guides = [
  '/priroda/pozorovanie-vtakov/',
  '/priroda/rozdiel-dub-buk/',
  '/vesmir/ako-najst-polarku/',
  '/auta/kontrola-tlaku-v-pneumatikach/',
  '/kvety/polievanie-izbovych-rastlin/',
  '/jedlo/ako-uvarit-ryzu/'
];

const minute = 60000;
const base = Date.now() - 6 * 60 * minute;
const rows = [];

const push = (offsetMs, crawlerName, agentClass, userAgent, path, resourceKind) => rows.push({
  event_type: crawlerName ? 'claimed_crawler_request' : 'observed_request',
  path,
  referrer_origin: null,
  crawler_name: crawlerName,
  agent_class: agentClass,
  resource_kind: resourceKind,
  user_agent: userAgent,
  occurred_at: new Date(base + offsetMs).toISOString(),
  metadata: { source: 'seed_script', verification: 'synthetic', is_test: true, seed: SEED_TAG }
});

// Profile 1: renderer. Reads robots first, then pages, and pulls the
// stylesheet — the pattern of an agent that actually renders.
const rendererUa = 'Mozilla/5.0 (compatible; TestRendererBot/1.0; +https://example.invalid/bot)';
push(0, null, 'likely_automation', rendererUa, '/robots.txt', 'robots');
push(20000, null, 'likely_automation', rendererUa, '/sitemap.xml', 'sitemap');
guides.slice(0, 3).forEach((path, index) => {
  push(minute + index * 2 * minute, null, 'likely_automation', rendererUa, path, 'guide');
  push(minute + index * 2 * minute + 500, null, 'likely_automation', rendererUa, '/styles.css', 'stylesheet');
});

// Profile 2: text scraper. Many pages in a burst, no assets, never asked for
// robots.txt.
const scraperUa = 'python-requests/2.32.3';
guides.forEach((path, index) => {
  push(90 * minute + index * 4000, null, 'likely_automation', scraperUa, path, 'guide');
});

// Profile 3: a named crawler behaving politely.
const googlebotUa = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
push(150 * minute, 'Googlebot', 'known_crawler', googlebotUa, '/robots.txt', 'robots');
push(151 * minute, 'Googlebot', 'known_crawler', googlebotUa, '/sitemap.xml', 'sitemap');
push(155 * minute, 'Googlebot', 'known_crawler', googlebotUa, '/', 'home');
push(170 * minute, 'Googlebot', 'known_crawler', googlebotUa, guides[0], 'guide');
push(190 * minute, 'Googlebot', 'known_crawler', googlebotUa, guides[1], 'guide');

// Profile 4: an assistant fetching one page on a user's request.
const claudeUserUa = 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)';
push(210 * minute, 'Claude-User', 'known_crawler', claudeUserUa, guides[2], 'guide');

// Profile 5: no user agent at all.
push(240 * minute, null, 'no_user_agent', '', guides[3], 'guide');

const response = await fetch(`${supabaseUrl}/rest/v1/search_lab_events`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=minimal' },
  body: JSON.stringify(rows)
});
if (!response.ok) throw new Error(`Insert failed: HTTP ${response.status} ${await response.text()}`);

console.log(`Inserted ${rows.length} synthetic rows tagged seed=${SEED_TAG}.`);
console.log('Remove them with: node scripts/seed-test-events.mjs --delete');
