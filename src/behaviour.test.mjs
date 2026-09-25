import assert from 'node:assert/strict';
import test from 'node:test';
import { identify } from './agents.mjs';
import { analyse } from './behaviour.mjs';

const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const MAC_CHROME_2 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const WIN_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0';

const at = (base, ms) => new Date(Date.parse(base) + ms).toISOString();
const fetch = (time, path, ua, kind) => ({ event_type: 'observed_request', occurred_at: time, path, user_agent: ua, resource_kind: kind || null });
const pageview = (time, path) => ({ event_type: 'browser_pageview', occurred_at: time, path, user_agent: null });

test('splits AI agents by purpose', () => {
  assert.deepEqual([identify('Mozilla/5.0 (compatible; GPTBot/1.2)').category, identify('Mozilla/5.0 (compatible; GPTBot/1.2)').purpose], ['ai', 'training']);
  assert.equal(identify('Mozilla/5.0 (compatible; ClaudeBot/1.0)').purpose, 'training');
  assert.equal(identify('CCBot/2.0 (https://commoncrawl.org/faq/)').purpose, 'training');
  assert.equal(identify('Mozilla/5.0 (compatible; OAI-SearchBot/1.0)').purpose, 'ai_search');
  assert.equal(identify('Mozilla/5.0 (compatible; Claude-SearchBot/1.0)').purpose, 'ai_search');
  assert.equal(identify('Mozilla/5.0 (compatible; PerplexityBot/1.0)').purpose, 'ai_search');
  assert.equal(identify('Mozilla/5.0 (compatible; ChatGPT-User/1.0)').purpose, 'user_fetch');
  assert.equal(identify('Claude-User (claude-code/2.1.269; +https://support.anthropic.com/)').purpose, 'user_fetch');
  assert.equal(identify('Mozilla/5.0 (compatible; Perplexity-User/1.0)').purpose, 'user_fetch');
});

test('recognises agents added from vendor documentation (2026-09-24)', () => {
  const cases = [
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-AdsBot/1.0; +https://openai.com/adsbot', 'OAI-AdsBot (OpenAI)', 'mixed'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot', 'OAI-SearchBot (OpenAI)', 'ai_search'],
    ['Mozilla/5.0 (compatible; Google-Agent)', 'Google-Agent', 'user_fetch'],
    ['Google-GeminiNotebook', 'Google-GeminiNotebook', 'user_fetch'],
    ['meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)', 'Meta-WebIndexer', 'ai_search'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Index/1.0; +https://docs.mistral.ai/robots)', 'MistralAI-Index', 'ai_search'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Training/1.0; +https://docs.mistral.ai/robots)', 'MistralAI-Training', 'training'],
    ['GrokBot/1.0', 'Grok / xAI (neoficialny token)', 'mixed']
  ];
  for (const [ua, name, purpose] of cases) {
    const id = identify(ua);
    assert.equal(id.name, name, ua);
    assert.equal(id.category, 'ai', ua);
    assert.equal(id.purpose, purpose, ua);
  }
  // OpenAI's search bot hides behind a full Mac Chrome string; it must not be
  // mistaken for a browser.
  assert.notEqual(identify(cases[1][0]).category, 'browser');
});

test('recognises what our probes actually produced', () => {
  // Gemini's live fetcher sent the bare string "Google".
  const gemini = identify('Google');
  assert.equal(gemini.category, 'ai');
  assert.equal(gemini.purpose, 'user_fetch');
  // ChatGPT fetched with plain curl from its sandbox.
  assert.equal(identify('curl/8.5.0').category, 'tool');
  // "Google" must not swallow Googlebot, and Googlebot is search, not AI.
  assert.equal(identify('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').category, 'search');
});

test('keeps ported categories apart', () => {
  assert.equal(identify('Mozilla/5.0 (compatible; AhrefsBot/7.0)').category, 'seo');
  assert.equal(identify('facebookexternalhit/1.1').category, 'social');
  assert.equal(identify('Mozilla/5.0 (compatible; SeznamBot/4.0)').category, 'search');
  assert.equal(identify('Mozilla/5.0 zgrab/0.x').category, 'scan');
  assert.equal(identify('Mozilla/5.0 (compatible; SomeNewThingBot/0.1)').category, 'generic');
  assert.equal(identify(WIN_FIREFOX).category, 'browser');
  assert.equal(identify('').category, 'generic');
});

test('flags the Grok pattern: three browser identities, one page, half a second', () => {
  const base = '2026-09-12T16:11:36.700Z';
  const page = '/auta/kontrola-hlbky-dezenu/';
  const rows = [
    ...[0, 20, 200, 206].map(ms => fetch(at(base, ms), page, MAC_CHROME, 'guide')),
    ...[2, 250, 260].map(ms => fetch(at(base, ms), page, MAC_SAFARI, 'guide')),
    ...[480, 1130].map(ms => fetch(at(base, ms), page, MAC_CHROME_2, 'guide'))
  ];
  const report = analyse(rows);

  assert.equal(report.totals.hidden, 3);
  for (const agent of report.agents) {
    assert.equal(agent.category, 'hidden', agent.key);
    const ids = agent.signals.map(s => s.id);
    assert.ok(ids.includes('noassets'), agent.key);
    assert.ok(ids.includes('nojs'), agent.key);
    assert.ok(ids.includes('multiua'), agent.key);
  }
  assert.equal(report.clusters.length, 1);
  assert.equal(report.clusters[0].userAgents.length, 3);
  assert.equal(report.clusters[0].requests, 9);
});

test('does not flag a person reading a page', () => {
  const base = '2026-09-12T17:14:17.000Z';
  const rows = [
    fetch(base, '/priroda/pozorovanie-vtakov/', WIN_FIREFOX, 'guide'),
    fetch(at(base, 120), '/styles.css', WIN_FIREFOX, 'stylesheet'),
    pageview(at(base, 900), '/priroda/pozorovanie-vtakov/')
  ];
  const report = analyse(rows);
  const person = report.agents[0];
  assert.equal(person.category, 'browser');
  assert.equal(person.suspect, false);
  assert.equal(person.renders, true);
  assert.equal(person.ranJs, 1);
  assert.equal(report.totals.hidden, 0);
});

test('a person with Do Not Track is not called a bot for skipping the collector alone', () => {
  const base = '2026-09-12T18:00:00.000Z';
  const rows = [
    fetch(base, '/vesmir/', WIN_FIREFOX, 'section'),
    fetch(at(base, 80), '/styles.css', WIN_FIREFOX, 'stylesheet')
  ];
  const person = analyse(rows).agents[0];
  assert.equal(person.category, 'browser');
  assert.equal(person.score < 30, true);
});

test('lists important crawlers that never came', () => {
  const report = analyse([fetch('2026-09-12T10:00:00.000Z', '/robots.txt', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'robots')]);
  const googlebot = report.expected.find(e => e.name === 'Googlebot');
  const oai = report.expected.find(e => e.name === 'OAI-SearchBot (OpenAI)');
  assert.equal(googlebot.seen, true);
  assert.equal(googlebot.must, true);
  assert.equal(oai.seen, false);
  assert.ok(report.totals.expectedMissing >= 1);
});

test('reports AI purposes even when a purpose has no traffic', () => {
  const report = analyse([fetch('2026-09-12T10:00:00.000Z', '/priroda/', 'Mozilla/5.0 (compatible; GPTBot/1.2)', 'section')]);
  const training = report.purposes.find(p => p.id === 'training');
  const userFetch = report.purposes.find(p => p.id === 'user_fetch');
  assert.equal(training.requests, 1);
  assert.deepEqual(training.names, ['GPTBot (OpenAI)']);
  assert.equal(userFetch.requests, 0);
});

test('reports which format each agent took for the same guide', () => {
  const claude = 'Claude-User (claude-code/2.1.269; +https://support.anthropic.com/)';
  const gpt = 'Mozilla/5.0 (compatible; GPTBot/1.2)';
  const report = analyse([
    fetch('2026-09-26T10:00:00.000Z', '/llms.txt', claude, null),
    fetch('2026-09-26T10:00:01.000Z', '/priroda/pozorovanie-vtakov.md', claude, null),
    fetch('2026-09-26T11:00:00.000Z', '/priroda/pozorovanie-vtakov/', gpt, null),
    fetch('2026-09-26T11:00:02.000Z', '/priroda/pozorovanie-vtakov.json', gpt, null),
    fetch('2026-09-26T11:00:05.000Z', '/vesmir/fazy-mesiaca/', gpt, null)
  ]);
  const f = report.formats;
  assert.equal(f.totals.guide, 2);
  assert.equal(f.totals.guide_md, 1);
  assert.equal(f.totals.guide_json, 1);
  assert.equal(f.totals.llms_txt, 1);
  // Claude skipped the HTML entirely; GPTBot took HTML plus JSON for one guide
  // and HTML only for the other.
  assert.deepEqual(f.pairs, { htmlOnly: 1, alternateOnly: 1, both: 1 });
  const byName = Object.fromEntries(f.agents.map(a => [a.name, a]));
  assert.deepEqual(byName['Claude-User (Anthropic)'].counts, { llms_txt: 1, guide_md: 1 });
  // Alternate formats are not pages, so they do not trigger the no-JS signal.
  assert.equal(report.agents.find(a => a.name === 'Claude-User (Anthropic)').pages, 0);
});

test('derives the resource kind for rows written before the column existed', () => {
  const report = analyse([
    fetch('2026-09-11T19:06:58.000Z', '/robots.txt', 'Mozilla/5.0 (compatible; Googlebot/2.1)', null)
  ]);
  assert.equal(report.agents[0].readRobots, true);
});
