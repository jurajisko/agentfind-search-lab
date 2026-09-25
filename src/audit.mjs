/**
 * Readiness audit of a built site: can search engines and AI systems reach,
 * find and understand its pages?
 *
 * Pure function over the site's files, so it runs at build time here and can
 * later run on a customer's crawled pages. Every check states what it found,
 * why it matters, and how sure we are of that — documented by the operators,
 * measured by us, or still a hypothesis. Hypotheses never count toward the
 * score; they are what the Lab is testing.
 *
 * Output text is proper Slovak with diacritics: it is read by a screen reader
 * and handed to clients.
 */

export const EVIDENCE = {
  documented: 'dokumentované prevádzkovateľmi',
  measured: 'namerané v našich pokusoch',
  hypothesis: 'hypotéza, zatiaľ nepotvrdená'
};

export const STAGES = {
  access: 'Prístupnosť — dostane sa robot k obsahu?',
  discovery: 'Objaviteľnosť — vie robot, že stránky existujú?',
  understanding: 'Porozumenie — vie robot, o čom stránka je?',
  formats: 'Strojové formáty — overujeme, či pomáhajú'
};

// Crawlers whose access decides visibility in search and AI answers.
const VISIBILITY_BOTS = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User'];
// Training-only tokens: blocking them is a business decision, not an error.
const TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];

const pick = (html, re) => (html.match(re) || [])[1];
const textOf = html => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function pagePath(file) {
  if (file === 'index.html') return '/';
  return `/${file.replace(/index\.html$/, '')}`;
}

/** RFC 9309 subset: most specific group for the token, longest path wins, Allow wins ties. */
export function robotsAllows(robotsTxt, token, path = '/') {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of (robotsTxt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    const key = field.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === 'allow' || key === 'disallow')) current.rules.push({ allow: key === 'allow', path: value });
    }
  }
  const named = groups.filter(g => g.agents.includes(token.toLowerCase()));
  const chosen = named.length ? named : groups.filter(g => g.agents.includes('*'));
  const rules = chosen.flatMap(g => g.rules).filter(r => r.path !== '' && path.startsWith(r.path));
  if (!rules.length) return true;
  rules.sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return rules[0].allow;
}

export function auditSite(files, { siteUrl, expectVerification = true } = {}) {
  const base = siteUrl.replace(/\/$/, '');
  const pages = [...files.entries()]
    .filter(([file]) => file.endsWith('index.html') && !file.startsWith('admin/'))
    .map(([file, html]) => {
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
      const types = [];
      let invalidJson = 0;
      for (const block of blocks) {
        try {
          const value = JSON.parse(block);
          (Array.isArray(value) ? value : [value]).forEach(v => v && v['@type'] && types.push(v['@type']));
        } catch { invalidJson++; }
      }
      return {
        path: pagePath(file),
        title: pick(html, /<title>([^<]*)<\/title>/) || '',
        description: pick(html, /<meta name="description" content="([^"]*)"/) || '',
        canonical: pick(html, /<link rel="canonical" href="([^"]+)"/) || '',
        robots: (pick(html, /<meta name="robots" content="([^"]+)"/) || '').toLowerCase(),
        lang: pick(html, /<html[^>]*\blang="([^"]+)"/) || '',
        h1: (html.match(/<h1[\s>]/g) || []).length,
        text: textOf(html).length,
        links: [...html.matchAll(/<a [^>]*href="(\/[^"#?]*)"/g)].map(m => m[1]),
        types,
        invalidJson,
        alternates: [...html.matchAll(/<link rel="alternate" type="([^"]+)"/g)].map(m => m[1]),
        googleVerification: /<meta name="google-site-verification"/.test(html),
        bingVerification: /<meta name="msvalidate\.01"/.test(html)
      };
    });
  const byPath = new Map(pages.map(p => [p.path, p]));
  const robots = files.get('robots.txt') || '';
  const sitemap = files.get('sitemap.xml') || '';
  const n = pages.length;
  const count = fn => pages.filter(fn).length;
  const checks = [];
  const add = check => checks.push(check);

  // ---------- access ----------
  const thin = pages.filter(p => p.text < 200);
  add({
    id: 'html-content', stage: 'access', weight: 3,
    title: 'Obsah je priamo v HTML, bez JavaScriptu',
    status: thin.length === 0 ? 'ok' : thin.length < n / 10 ? 'warn' : 'fail',
    result: thin.length === 0 ? `Všetkých ${n} stránok má text priamo v HTML.` : `${thin.length} z ${n} stránok má menej ako 200 znakov textu bez JavaScriptu.`,
    why: 'Žiadny AI agent v našom pokuse z 12. 9. 2026 stránku nevykreslil. Čo nie je v HTML, to AI nevidí.',
    evidence: 'measured'
  });

  const blocked = VISIBILITY_BOTS.filter(bot => !robotsAllows(robots, bot));
  add({
    id: 'robots-visibility', stage: 'access', weight: 3,
    title: 'robots.txt púšťa vyhľadávače a AI vyhľadávanie',
    status: !robots ? 'warn' : blocked.length === 0 ? 'ok' : 'fail',
    result: !robots ? 'Súbor robots.txt chýba. Roboty preto prechádzajú všetko, ale nemajú odkaz na sitemap.'
      : blocked.length === 0 ? `Povolené pre všetkých ${VISIBILITY_BOTS.length}: ${VISIBILITY_BOTS.join(', ')}.`
      : `Zablokované: ${blocked.join(', ')}.`,
    why: 'OAI-SearchBot, Claude-SearchBot a PerplexityBot rozhodujú, či ťa AI odcituje. Bingbot rozhoduje o Copilote. Keď sú zablokované, stránka pre tieto služby neexistuje.',
    evidence: 'documented'
  });

  const trainingAllowed = TRAINING_BOTS.filter(bot => robotsAllows(robots, bot));
  add({
    id: 'robots-training', stage: 'access', weight: 0,
    title: 'Trénovanie AI modelov na obsahu webu',
    status: 'info',
    result: trainingAllowed.length === TRAINING_BOTS.length ? 'Trénovanie je povolené pre všetky sledované tokeny.'
      : `Povolené: ${trainingAllowed.join(', ') || 'žiadne'}. Zakázané: ${TRAINING_BOTS.filter(b => !trainingAllowed.includes(b)).join(', ')}.`,
    why: 'Je to obchodné rozhodnutie, nie chyba. Google aj Apple píšu, že zákaz trénovania (Google-Extended, Applebot-Extended) neovplyvní viditeľnosť vo vyhľadávaní.',
    evidence: 'documented'
  });

  const noindex = pages.filter(p => /noindex/.test(p.robots));
  add({
    id: 'noindex', stage: 'access', weight: 2,
    title: 'Žiadna stránka nezakazuje indexovanie',
    status: noindex.length === 0 ? 'ok' : 'fail',
    result: noindex.length === 0 ? 'Žiadna stránka nemá noindex.' : `noindex má ${noindex.length} stránok, napríklad ${noindex.slice(0, 3).map(p => p.path).join(', ')}.`,
    why: 'Stránka s noindex sa do vyhľadávania nedostane, aj keby bola najlepšia.',
    evidence: 'documented'
  });

  // ---------- discovery ----------
  const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  const missing = pages.filter(p => !locs.has(`${base}${p.path}`));
  const robotsPointsToSitemap = /^sitemap:\s*\S+/im.test(robots);
  add({
    id: 'sitemap', stage: 'discovery', weight: 2,
    title: 'Sitemap obsahuje všetky stránky a robots.txt na ňu odkazuje',
    status: !sitemap ? 'fail' : missing.length === 0 && robotsPointsToSitemap ? 'ok' : 'warn',
    result: !sitemap ? 'sitemap.xml chýba.'
      : `${locs.size} adries v sitemape, ${missing.length ? `${missing.length} stránok v nej chýba` : 'nechýba žiadna stránka'}. Odkaz v robots.txt: ${robotsPointsToSitemap ? 'áno' : 'nie'}.`,
    why: 'Sitemap je najrýchlejší spôsob, ako robotovi povedať o všetkých stránkach naraz.',
    evidence: 'documented'
  });

  const reachable = new Set(['/']);
  const queue = ['/'];
  while (queue.length) {
    const page = byPath.get(queue.shift());
    if (!page) continue;
    for (const link of page.links) {
      const target = link.endsWith('/') ? link : `${link}/`;
      if (byPath.has(target) && !reachable.has(target)) { reachable.add(target); queue.push(target); }
    }
  }
  const orphans = pages.filter(p => !reachable.has(p.path));
  add({
    id: 'internal-links', stage: 'discovery', weight: 2,
    title: 'Každá stránka je dosiahnuteľná odkazmi z úvodnej stránky',
    status: orphans.length === 0 ? 'ok' : 'warn',
    result: orphans.length === 0 ? `Všetkých ${n} stránok je dosiahnuteľných.` : `${orphans.length} stránok nevedie žiadny odkaz: ${orphans.slice(0, 3).map(p => p.path).join(', ')}.`,
    why: 'Roboty, ktoré nečítajú sitemap, nachádzajú stránky len cez odkazy.',
    evidence: 'documented'
  });

  if (expectVerification) {
    const home = byPath.get('/') || {};
    add({
      id: 'webmaster-tools', stage: 'discovery', weight: 2,
      title: 'Web je overený v Google Search Console a Bing Webmaster Tools',
      status: home.googleVerification && home.bingVerification ? 'ok' : home.googleVerification || home.bingVerification ? 'warn' : 'fail',
      result: `Google: ${home.googleVerification ? 'áno' : 'nie'}, Bing: ${home.bingVerification ? 'áno' : 'nie'}.`,
      why: 'Copilot aj Perplexity v našom teste nenačítali stránku, ktorá nebola v indexe, ani s priamym odkazom. Bing Webmaster navyše ukazuje citácie v Copilote.',
      evidence: 'measured'
    });
  }

  // ---------- understanding ----------
  const badTitle = pages.filter(p => p.title.length < 10 || p.title.length > 70);
  const badDescription = pages.filter(p => p.description.length < 50 || p.description.length > 170);
  add({
    id: 'title-description', stage: 'understanding', weight: 2,
    title: 'Názov a popis každej stránky majú rozumnú dĺžku',
    status: badTitle.length + badDescription.length === 0 ? 'ok' : 'warn',
    result: `Názov mimo 10–70 znakov: ${badTitle.length}. Popis mimo 50–170 znakov: ${badDescription.length}.`,
    why: 'Názov a popis sú prvé, čo vyhľadávač aj AI o stránke čítajú, a často ich zobrazia vo výsledku.',
    evidence: 'documented'
  });

  const canonicalOk = count(p => p.canonical === `${base}${p.path}`);
  add({
    id: 'canonical', stage: 'understanding', weight: 1,
    title: 'Každá stránka má kanonickú adresu, ktorá ukazuje sama na seba',
    status: canonicalOk === n ? 'ok' : 'warn',
    result: `${canonicalOk} z ${n} stránok.`,
    why: 'Kanonická adresa hovorí, ktorá verzia stránky je tá pravá, keď je obsah dostupný na viacerých adresách.',
    evidence: 'documented'
  });

  const oneH1 = count(p => p.h1 === 1);
  add({
    id: 'h1', stage: 'understanding', weight: 1,
    title: 'Každá stránka má práve jeden hlavný nadpis',
    status: oneH1 === n ? 'ok' : 'warn',
    result: `${oneH1} z ${n} stránok.`,
    why: 'Hlavný nadpis je najsilnejší signál, o čom stránka je.',
    evidence: 'documented'
  });

  const withData = count(p => p.types.length > 0);
  const invalid = pages.reduce((sum, p) => sum + p.invalidJson, 0);
  add({
    id: 'structured-data', stage: 'understanding', weight: 1,
    title: 'Štruktúrované dáta (JSON-LD) sú platné',
    status: invalid > 0 ? 'fail' : withData === n ? 'ok' : 'warn',
    result: `Štruktúrované dáta má ${withData} z ${n} stránok, neplatných blokov: ${invalid}.`,
    why: 'Google ich používa na rozšírené výsledky. Či pomáhajú aj AI citáciám, zatiaľ nikto nedoložil.',
    evidence: 'documented'
  });

  const langOk = count(p => p.lang);
  add({
    id: 'lang', stage: 'understanding', weight: 1,
    title: 'Jazyk stránky je vyznačený',
    status: langOk === n ? 'ok' : 'warn',
    result: `${langOk} z ${n} stránok.`,
    why: 'Pomáha zaradiť stránku k správnym jazykovým výsledkom a čítačom obrazovky vybrať správnu výslovnosť.',
    evidence: 'documented'
  });

  // ---------- formats (hypotheses under test) ----------
  const faq = count(p => p.types.includes('FAQPage'));
  add({
    id: 'faq', stage: 'formats', weight: 0, status: 'test',
    title: 'Časté otázky s dátami FAQPage',
    result: `${faq} stránok má FAQ a FAQPage, ostatné nie. Porovnávame, ktoré roboty sťahujú častejšie.`,
    why: 'Rozšírený variant má navyše FAQ a Rýchle fakty. Či to robotom pomáha, meria Lab.',
    evidence: 'hypothesis'
  });
  add({
    id: 'llms-txt', stage: 'formats', weight: 0, status: 'test',
    title: 'Súbor llms.txt',
    result: files.has('llms.txt') ? 'Existuje a odkazuje na verzie v Markdowne.' : 'Neexistuje.',
    why: 'Navrhnutý štandard pre AI. Žiadny prevádzkovateľ zatiaľ nepíše, že ho číta.',
    evidence: 'hypothesis'
  });
  const withAlternates = count(p => p.alternates.includes('text/markdown'));
  add({
    id: 'alternates', stage: 'formats', weight: 0, status: 'test',
    title: 'Verzie stránok v Markdowne a JSON',
    result: `${withAlternates} stránok ponúka Markdown aj JSON verziu.`,
    why: 'Meriame, či si ich roboty vyberajú namiesto HTML.',
    evidence: 'hypothesis'
  });

  const scored = checks.filter(c => ['ok', 'warn', 'fail'].includes(c.status));
  const max = scored.reduce((sum, c) => sum + c.weight, 0);
  const got = scored.reduce((sum, c) => sum + c.weight * (c.status === 'ok' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);

  return {
    pages: n,
    score: max ? Math.round((got / max) * 100) : 0,
    counts: {
      ok: checks.filter(c => c.status === 'ok').length,
      warn: checks.filter(c => c.status === 'warn').length,
      fail: checks.filter(c => c.status === 'fail').length,
      test: checks.filter(c => c.status === 'test').length
    },
    stages: Object.entries(STAGES).map(([id, label]) => {
      const list = checks.filter(c => c.stage === id && ['ok', 'warn', 'fail'].includes(c.status));
      const w = list.reduce((s, c) => s + c.weight, 0);
      const g = list.reduce((s, c) => s + c.weight * (c.status === 'ok' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
      return { id, label, score: w ? Math.round((g / w) * 100) : null };
    }),
    checks
  };
}
