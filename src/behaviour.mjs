/**
 * Turns raw search_lab_events rows into the admin report.
 *
 * Pure function of its input so it can be tested on synthetic rows.
 *
 * Hidden-bot detection follows bot-analyza-engine.js, adapted to what this
 * table has. We deliberately store no IP addresses, so an agent cannot be
 * followed across User-Agent changes by address. Two signals replace that:
 *
 *  - multiua: different browser identities hitting the same page within a few
 *    seconds of each other. This is how Grok showed up on 2026-09-12: three
 *    browser identities, nine requests, half a second.
 *  - nojs: the server served the page but the client collector never reported
 *    it. The nginx analyser cannot see this; we have both sides.
 *
 * Signals are evidence, not proof.
 */
import { CATEGORIES, EXPECTED, PURPOSES, ROLES, chromeMajor, identify } from './agents.mjs';
import { resourceKindFrom } from '../middleware.js';

export const SIGNALS = {
  noassets: { points: 30, label: 'Bez CSS', desc: 'Nacital stranku, ale nie styl. Skutocny prehliadac si styles.css stiahne pri kazdej stranke.' },
  nojs: { points: 30, label: 'Nespustil JavaScript', desc: 'Server stranku vydal, klientsky skript sa neozval. Pozor: clovek so zapnutym Do Not Track skript tiez nespusti.' },
  multiua: { points: 25, label: 'Viac identit naraz', desc: 'V tych istych 3 sekundach prisla na tu istu stranku aj ina identita prehliadaca.' },
  repeat: { points: 20, label: 'Opakuje stranku', desc: 'Tu istu stranku nacital viackrat v priebehu 5 sekund.' },
  burst: { points: 25, label: 'Narazova frekvencia', desc: '20 a viac poziadaviek za minutu.' },
  fast: { points: 12, label: 'Vysoka frekvencia', desc: '8 az 19 poziadaviek za minutu.' },
  robots: { points: 10, label: 'Cita robots.txt', desc: 'Prehliadac si robots.txt nepyta, crawler ano.' },
  oldua: { points: 8, label: 'Zastarana verzia', desc: 'Verzia Chrome je o 30 a viac vydani starsia nez najnovsia v datach.' },
  browser: { points: -30, label: 'Nacitava cele stranky', desc: 'Stahuje aj CSS, ako prehliadac. Odpocitava body.' }
};

export const HIDDEN_AT = 30;
export const SUSPECT_AT = 15;

const PAGE_KINDS = new Set(['guide', 'section', 'home', 'research']);
const ASSET_KINDS = new Set(['stylesheet', 'icon', 'manifest']);

// Representations of the same guide content. Which one an agent asks for is
// the experiment's question.
export const FORMATS = [
  ['guide', 'HTML'],
  ['guide_md', 'Markdown'],
  ['guide_json', 'JSON'],
  ['llms_txt', 'llms.txt'],
  ['llms_full', 'llms-full.txt']
];
const FORMAT_KINDS = new Set(FORMATS.map(([id]) => id));

// Bot groups for the report charts. The order is the chart's colour order and
// was validated for colour-vision deficiency in both themes: keep it.
export const GROUPS = [
  ['search', 'Vyhľadávače'],
  ['ai_search', 'AI vyhľadávanie (index)'],
  ['ai_user', 'AI na žiadosť používateľa'],
  ['other', 'Ostatní boti a skripty'],
  ['ai_training', 'AI trénovanie'],
  ['hidden', 'Skrytí boti']
];
export function groupOf(agent) {
  if (agent.category === 'browser') return null; // people, not bots
  if (agent.category === 'search') return 'search';
  if (agent.category === 'hidden') return 'hidden';
  if (agent.category === 'ai') {
    if (agent.purpose === 'ai_search') return 'ai_search';
    if (agent.purpose === 'user_fetch') return 'ai_user';
    if (agent.purpose === 'training') return 'ai_training';
  }
  return 'other';
}

/** Wilson score interval, 95 %. Honest about small samples, unlike k/n alone. */
export function wilson(k, n, z = 1.96) {
  if (!n) return { low: 0, high: 0 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}
const guideKey = path => path.replace(/\.(md|json)$/, '').replace(/\/$/, '');
const MULTI_UA_WINDOW = 3000;
const REPEAT_WINDOW = 5000;
const JS_WINDOW = 60000;

const bump = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);
const top = (map, limit) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

function hasNear(sorted, t, window) {
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (Math.abs(sorted[mid] - t) <= window) return true;
    if (sorted[mid] < t) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}

export function analyse(rows, { variantByPath = new Map() } = {}) {
  const fetches = [];
  const pageviewTimes = new Map();

  for (const row of rows) {
    const t = Date.parse(row.occurred_at);
    if (!Number.isFinite(t)) continue;
    if (row.event_type === 'browser_pageview') {
      if (!pageviewTimes.has(row.path)) pageviewTimes.set(row.path, []);
      pageviewTimes.get(row.path).push(t);
      continue;
    }
    const id = identify(row.user_agent);
    fetches.push({
      t,
      at: row.occurred_at,
      path: row.path,
      kind: row.resource_kind || resourceKindFrom(row.path),
      ua: row.user_agent || '',
      id,
      key: id.named ? id.name : (row.user_agent || '(bez User-Agenta)')
    });
  }
  for (const list of pageviewTimes.values()) list.sort((a, b) => a - b);
  fetches.sort((a, b) => a.t - b.t);

  const maxChrome = fetches.reduce((max, f) => Math.max(max, chromeMajor(f.ua)), 0);

  // Browser identities that appeared together on one page within seconds.
  const multiUaKeys = new Set();
  const clusters = [];
  const unnamedByPath = new Map();
  for (const f of fetches) {
    if (f.id.named || !PAGE_KINDS.has(f.kind)) continue;
    if (!unnamedByPath.has(f.path)) unnamedByPath.set(f.path, []);
    unnamedByPath.get(f.path).push(f);
  }
  for (const [path, list] of unnamedByPath) {
    let start = 0;
    while (start < list.length) {
      let end = start;
      while (end + 1 < list.length && list[end + 1].t - list[end].t <= MULTI_UA_WINDOW) end++;
      const group = list.slice(start, end + 1);
      const identities = new Set(group.map(f => f.key));
      if (identities.size >= 2) {
        identities.forEach(key => multiUaKeys.add(key));
        clusters.push({
          at: group[0].at,
          path,
          requests: group.length,
          spanMs: group[group.length - 1].t - group[0].t,
          userAgents: [...identities]
        });
      }
      start = end + 1;
    }
  }

  const agents = new Map();
  for (const f of fetches) {
    let a = agents.get(f.key);
    if (!a) {
      a = {
        key: f.key, name: f.id.name, category: f.id.category, purpose: f.id.purpose, named: f.id.named,
        requests: 0, pages: 0, assets: 0, robots: 0, sitemap: 0, pagesWithoutJs: 0,
        paths: new Map(), uas: new Map(), hours: new Map(), minutes: new Map(), lastByPath: new Map(),
        repeat: false, firstSeen: f.at, lastSeen: f.at, events: [],
        formats: new Map(), guideFormats: new Map()
      };
      agents.set(f.key, a);
    }
    a.requests++;
    bump(a.paths, f.path);
    bump(a.uas, f.ua || '(prazdny)');
    bump(a.hours, f.at.slice(0, 13));
    bump(a.minutes, Math.floor(f.t / 60000));
    if (f.kind === 'robots') a.robots++;
    if (f.kind === 'sitemap') a.sitemap++;
    if (ASSET_KINDS.has(f.kind)) a.assets++;
    if (PAGE_KINDS.has(f.kind)) {
      a.pages++;
      if (!hasNear(pageviewTimes.get(f.path) || [], f.t, JS_WINDOW)) a.pagesWithoutJs++;
      const previous = a.lastByPath.get(f.path);
      if (previous !== undefined && f.t - previous <= REPEAT_WINDOW) a.repeat = true;
      a.lastByPath.set(f.path, f.t);
    }
    if (f.at < a.firstSeen) a.firstSeen = f.at;
    if (f.at > a.lastSeen) a.lastSeen = f.at;
    a.events.push({ at: f.at, path: f.path, kind: f.kind });
    if (FORMAT_KINDS.has(f.kind)) {
      bump(a.formats, f.kind);
      if (f.kind === 'guide' || f.kind === 'guide_md' || f.kind === 'guide_json') {
        const key = guideKey(f.path);
        if (!a.guideFormats.has(key)) a.guideFormats.set(key, new Set());
        a.guideFormats.get(key).add(f.kind);
      }
    }
  }

  const agentList = [...agents.values()].map(a => {
    const maxPerMinute = Math.max(0, ...a.minutes.values());
    const signals = [];
    let score = 0;
    const add = id => { signals.push({ id, ...SIGNALS[id] }); score += SIGNALS[id].points; };

    // Only agents that claim to be a browser get scored. Everything else has
    // already admitted to being automated.
    if (a.category === 'browser') {
      if (a.pages > 0 && a.assets === 0) add('noassets');
      if (a.pages > 0 && a.pagesWithoutJs === a.pages) add('nojs');
      if (multiUaKeys.has(a.key)) add('multiua');
      if (a.repeat) add('repeat');
      if (maxPerMinute >= 20) add('burst'); else if (maxPerMinute >= 8) add('fast');
      if (a.robots > 0) add('robots');
      const major = chromeMajor(a.key);
      if (major && maxChrome - major >= 30) add('oldua');
      if (a.assets > 0) add('browser');
      score = Math.max(0, Math.min(100, score));
    }

    const category = a.category === 'browser' && score >= HIDDEN_AT ? 'hidden' : a.category;
    return {
      key: a.key,
      name: category === 'hidden' ? 'Skryty bot' : a.name,
      category,
      purpose: a.purpose,
      named: a.named,
      suspect: a.category === 'browser' && score >= SUSPECT_AT && score < HIDDEN_AT,
      score: a.category === 'browser' ? score : null,
      signals,
      userAgents: top(a.uas, 10),
      requests: a.requests,
      pages: a.pages,
      assets: a.assets,
      distinctPaths: a.paths.size,
      renders: a.assets > 0,
      ranJs: a.pages > 0 ? a.pages - a.pagesWithoutJs : 0,
      readRobots: a.robots > 0,
      readSitemap: a.sitemap > 0,
      maxPerMinute,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      role: ROLES[a.name] || null,
      topPaths: top(a.paths, 30),
      formats: Object.fromEntries(a.formats),
      // Per guide: did the agent take only the HTML, only an alternate, or both?
      guidePairs: [...a.guideFormats.values()].reduce((acc, kinds) => {
        const html = kinds.has('guide');
        const alt = kinds.has('guide_md') || kinds.has('guide_json');
        if (html && alt) acc.both++; else if (alt) acc.alternateOnly++; else if (html) acc.htmlOnly++;
        return acc;
      }, { htmlOnly: 0, alternateOnly: 0, both: 0 }),
      hours: [...a.hours.entries()].sort(),
      events: a.events.slice(-40).reverse()
    };
  }).sort((x, y) => y.requests - x.requests);

  const byCategory = new Map();
  const byPurpose = new Map();
  for (const a of agentList) {
    const c = byCategory.get(a.category) || { requests: 0, agents: 0 };
    c.requests += a.requests; c.agents++;
    byCategory.set(a.category, c);
    if (a.category === 'ai') {
      const p = byPurpose.get(a.purpose || 'mixed') || { requests: 0, agents: 0, names: [] };
      p.requests += a.requests; p.agents++; p.names.push(a.name);
      byPurpose.set(a.purpose || 'mixed', p);
    }
  }

  const seen = new Map(agentList.filter(a => a.named).map(a => [a.name, a]));
  const expected = EXPECTED.map(name => {
    const agent = seen.get(name);
    return {
      name,
      must: Boolean(ROLES[name]?.must),
      why: ROLES[name]?.why || '',
      seen: Boolean(agent),
      requests: agent ? agent.requests : 0,
      lastSeen: agent ? agent.lastSeen : null
    };
  });

  const categoryOf = new Map(agentList.map(a => [a.key, a.category]));
  const pages = new Map();
  const hourly = new Map();
  for (const f of fetches) {
    const category = categoryOf.get(f.key);
    const hour = f.at.slice(0, 13);
    const bucket = hourly.get(hour) || {};
    bucket[category] = (bucket[category] || 0) + 1;
    hourly.set(hour, bucket);
    if (f.kind !== 'guide') continue;
    const p = pages.get(f.path) || {
      path: f.path, variant: variantByPath.get(f.path) || 'unknown',
      requests: 0, agents: new Set(), categories: new Map()
    };
    p.requests++;
    p.agents.add(f.key);
    bump(p.categories, category);
    pages.set(f.path, p);
  }
  const pageList = [...pages.values()]
    .map(p => ({ path: p.path, variant: p.variant, requests: p.requests, agents: p.agents.size, categories: top(p.categories, 6) }))
    .sort((a, b) => b.requests - a.requests);

  const variants = {};
  for (const variant of ['structured', 'baseline']) {
    const list = pageList.filter(p => p.variant === variant);
    const byCat = new Map();
    list.forEach(p => p.categories.forEach(([cat, n]) => bump(byCat, cat, n)));
    variants[variant] = {
      published: [...variantByPath.values()].filter(v => v === variant).length,
      pages: list.length,
      requests: list.reduce((sum, p) => sum + p.requests, 0),
      byCategory: top(byCat, 10)
    };
  }

  const formatAgents = agentList.filter(a => Object.keys(a.formats).length);
  const formatCategories = new Map();
  for (const a of formatAgents) {
    const counts = formatCategories.get(a.category) || {};
    for (const [kind, n] of Object.entries(a.formats)) counts[kind] = (counts[kind] || 0) + n;
    formatCategories.set(a.category, counts);
  }
  const formats = {
    columns: FORMATS.map(([id, label]) => ({ id, label })),
    totals: Object.fromEntries(FORMATS.map(([id]) => [id, formatAgents.reduce((sum, a) => sum + (a.formats[id] || 0), 0)])),
    byCategory: [...formatCategories.entries()].map(([id, counts]) => ({ id, label: CATEGORIES[id]?.label || id, counts })),
    agents: formatAgents
      .map(a => ({ key: a.key, name: a.name, category: a.category, purpose: a.purpose, named: a.named, counts: a.formats, pairs: a.guidePairs }))
      .sort((x, y) => Object.values(y.counts).reduce((s, n) => s + n, 0) - Object.values(x.counts).reduce((s, n) => s + n, 0))
      .slice(0, 40),
    pairs: formatAgents.reduce((acc, a) => ({
      htmlOnly: acc.htmlOnly + a.guidePairs.htmlOnly,
      alternateOnly: acc.alternateOnly + a.guidePairs.alternateOnly,
      both: acc.both + a.guidePairs.both
    }), { htmlOnly: 0, alternateOnly: 0, both: 0 })
  };

  // ---- report series: per day by bot group, and content coverage ----
  const groupByKey = new Map(agentList.map(a => [a.key, groupOf(a)]));
  const daily = new Map();
  const reached = new Map(GROUPS.map(([id]) => [id, new Set()]));
  for (const f of fetches) {
    const group = groupByKey.get(f.key);
    if (!group) continue;
    const day = f.at.slice(0, 10);
    const bucket = daily.get(day) || {};
    bucket[group] = (bucket[group] || 0) + 1;
    daily.set(day, bucket);
    if (f.kind === 'guide' || f.kind === 'guide_md' || f.kind === 'guide_json') reached.get(group).add(guideKey(f.path));
  }
  const days = [...daily.keys()].sort();
  const timeline = [];
  if (days.length) {
    for (let t = Date.parse(`${days[0]}T00:00:00Z`); t <= Date.parse(`${days[days.length - 1]}T00:00:00Z`); t += 86400000) {
      const day = new Date(t).toISOString().slice(0, 10);
      timeline.push({ day, counts: daily.get(day) || {} });
    }
  }
  const publishedByVariant = { structured: 0, baseline: 0 };
  for (const v of variantByPath.values()) if (v in publishedByVariant) publishedByVariant[v]++;
  const coverage = GROUPS.map(([id, label]) => {
    const keys = [...reached.get(id)];
    const byVariant = {};
    for (const variant of ['structured', 'baseline']) {
      const k = keys.filter(key => variantByPath.get(`${key}/`) === variant).length;
      const n = publishedByVariant[variant];
      byVariant[variant] = { fetched: k, published: n, share: n ? k / n : 0, interval: wilson(k, n) };
    }
    return { id, label, guides: keys.length, byVariant };
  });

  return {
    groups: GROUPS.map(([id, label]) => ({ id, label })),
    timeline,
    coverage,
    formats,
    totals: {
      fetches: fetches.length,
      pageviews: [...pageviewTimes.values()].reduce((sum, list) => sum + list.length, 0),
      agents: agentList.length,
      named: agentList.filter(a => a.named).length,
      ai: agentList.filter(a => a.category === 'ai').length,
      hidden: agentList.filter(a => a.category === 'hidden').length,
      suspect: agentList.filter(a => a.suspect).length,
      rendered: agentList.filter(a => a.renders).length,
      readRobots: agentList.filter(a => a.readRobots).length,
      expectedMissing: expected.filter(e => e.must && !e.seen).length
    },
    categories: [...byCategory.entries()]
      .map(([id, c]) => ({ id, label: CATEGORIES[id]?.label || id, desc: CATEGORIES[id]?.desc || '', ...c }))
      .sort((a, b) => b.requests - a.requests),
    purposes: Object.keys(PURPOSES).map(id => ({
      id, label: PURPOSES[id].label, desc: PURPOSES[id].desc,
      ...(byPurpose.get(id) || { requests: 0, agents: 0, names: [] })
    })),
    agents: agentList,
    clusters: clusters.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 50),
    expected,
    pages: pageList.slice(0, 60),
    variants,
    hourly: [...hourly.entries()].sort(),
    signals: SIGNALS,
    recent: fetches.slice(-80).reverse().map(f => ({
      at: f.at, path: f.path, kind: f.kind, category: categoryOf.get(f.key), name: f.id.named ? f.id.name : f.ua.slice(0, 60)
    }))
  };
}
