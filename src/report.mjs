/**
 * The human-readable report: one source for the accessible admin page, the
 * downloadable report for clients, and the CSV export.
 *
 * Written for people, including a screen-reader user: numbered level-2
 * headings to jump between sections, every chart's data also as a table with a
 * caption, and status carried by words, never by colour or icon alone. Proper
 * Slovak with diacritics, since text without them is mispronounced by screen
 * readers.
 *
 * The report states conclusions only when the data supports them and says so
 * plainly when it does not.
 */
import { EVIDENCE } from './audit.mjs';

const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const num = value => Number(value || 0).toLocaleString('sk-SK');
const pct = value => `${Math.round((value || 0) * 100)} %`;
const date = value => (value ? new Date(value).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bratislava' }) : '—');
const day = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Bratislava' });

function plural(n, one, few, many) {
  const a = Math.abs(n);
  if (a === 1) return `${num(n)} ${one}`;
  if (a >= 2 && a <= 4) return `${num(n)} ${few}`;
  return `${num(n)} ${many}`;
}

const STATUS_WORD = { ok: 'Splnené', warn: 'S výhradou', fail: 'Nesplnené', info: 'Na rozhodnutie', test: 'Overujeme' };

export function buildReport({ stats, audit, generatedAt, days, siteUrl }) {
  const s = stats;
  const now = Date.parse(generatedAt);
  const groups = new Map(s.groups.map(g => [g.id, g.label]));
  const coverage = new Map(s.coverage.map(c => [c.id, c]));
  const botAgents = s.agents.filter(a => a.category !== 'browser');
  const requestsByGroup = new Map();
  const agentsByGroup = new Map();
  for (const a of botAgents) {
    const g = a.category === 'search' ? 'search' : a.category === 'hidden' ? 'hidden'
      : a.category === 'ai' ? ({ ai_search: 'ai_search', user_fetch: 'ai_user', training: 'ai_training' }[a.purpose] || 'other') : 'other';
    requestsByGroup.set(g, (requestsByGroup.get(g) || 0) + a.requests);
    agentsByGroup.set(g, (agentsByGroup.get(g) || 0) + 1);
  }
  const botRequests = botAgents.reduce((sum, a) => sum + a.requests, 0);
  const important = s.expected.filter(e => e.must);
  const importantSeen = important.filter(e => e.seen);
  const guidesReached = id => (coverage.get(id)?.guides || 0);
  const totalGuides = s.coverage[0] ? s.coverage[0].byVariant.structured.published + s.coverage[0].byVariant.baseline.published : 0;
  const visibilityGuides = Math.max(guidesReached('search'), guidesReached('ai_search'), guidesReached('ai_user'));

  // ---- the one message that matters most right now ----
  let headline;
  if (audit && audit.score < 70) {
    headline = 'Najväčší priestor na zlepšenie je na samotnom webe: časť robotov sa k obsahu nedostane alebo mu neporozumie. Začnite položkami v časti „Čo treba opraviť“.';
  } else if (importantSeen.length < important.length / 2) {
    headline = 'Web je pre roboty pripravený, ale väčšina dôležitých robotov ho zatiaľ nenavštívila. Teraz rozhoduje objaviteľnosť: registrácia v Google Search Console a Bing Webmaster Tools, odkazy z iných webov a trpezlivosť — prvé návštevy prichádzajú v priebehu dní až týždňov.';
  } else if (visibilityGuides < totalGuides / 2) {
    headline = 'Dôležité roboty už web poznajú, ale stiahli zatiaľ menej ako polovicu obsahu. Pomáha aktuálna sitemap a vnútorné odkazy medzi stránkami.';
  } else {
    headline = 'Roboty web poznajú a sťahujú väčšinu obsahu. Ďalší krok je sledovať citácie: Bing Webmaster Tools, karta AI Performance, ukazuje, kedy vás cituje Copilot.';
  }

  // Phrased as "label: number" where Slovak numeral agreement would otherwise
  // need a different verb form for 1, 2–4 and 5+.
  const period = days === 1 ? 'posledný deň' : `posledných ${num(days)} dní`;
  const missingImportant = important.filter(e => !e.seen).map(e => e.name);
  const summary = [
    audit ? `Pripravenosť webu: ${num(audit.score)} zo 100 bodov. Splnené kontroly: ${num(audit.counts.ok)}, s výhradou: ${num(audit.counts.warn)}, nesplnené: ${num(audit.counts.fail)}.` : 'Audit pripravenosti webu sa nepodarilo načítať.',
    botRequests ? `Za ${period}: rôznych robotov ${num(botAgents.length)}, stiahnutí spolu ${num(botRequests)}.` : `Za ${period} neprišiel žiadny robot.`,
    `Dôležité roboty, ktoré už prišli: ${num(importantSeen.length)} z ${num(important.length)}.${missingImportant.length ? ` Zatiaľ neprišli: ${missingImportant.join(', ')}.` : ''}`,
    totalGuides ? `Stiahnuté návody z ${num(totalGuides)}: vyhľadávače ${num(guidesReached('search'))}, AI vyhľadávanie ${num(guidesReached('ai_search'))}, AI asistenti na žiadosť používateľa ${num(guidesReached('ai_user'))}.` : null,
    s.totals.hidden ? `Skrytí boti, teda roboty vydávajúce sa za bežný prehliadač: ${num(s.totals.hidden)}. Pravidlá v robots.txt na nich nezaberajú.` : null
  ].filter(Boolean);

  const sections = [];

  // 1. Path to recommendation
  const stageScore = id => audit?.stages.find(x => x.id === id)?.score;
  sections.push({
    id: 'cesta',
    heading: 'Cesta k odporúčaniu',
    intro: 'Aby vyhľadávač alebo AI mohli stránku odporučiť, musí prejsť štyrmi krokmi. Každý nasledujúci závisí od predošlého.',
    steps: [
      { label: 'Prístupnosť', value: stageScore('access'), unit: 'bodov zo 100', text: 'Dostane sa robot k obsahu? Robots.txt, noindex, obsah bez JavaScriptu.' },
      { label: 'Objaviteľnosť', value: important.length ? Math.round((importantSeen.length / important.length) * 100) : null, unit: `% dôležitých robotov prišlo (${num(importantSeen.length)} z ${num(important.length)})`, text: 'Vie robot, že web existuje? Sitemap, registrácia vo vyhľadávačoch, odkazy.' },
      { label: 'Pokrytie obsahu', value: totalGuides ? Math.round((visibilityGuides / totalGuides) * 100) : null, unit: `% návodov stiahnutých (${num(visibilityGuides)} z ${num(totalGuides)})`, text: 'Koľko obsahu si vyhľadávače a AI naozaj vzali.' },
      { label: 'Citácie a zobrazenia', value: null, unit: 'zatiaľ nenapojené', text: 'Či vás vyhľadávač zobrazuje a AI cituje, ukazujú len Google Search Console a Bing Webmaster Tools (karta AI Performance). Tieto údaje zatiaľ do správy nenačítavame.' }
    ]
  });

  // 2. Helps / hurts
  if (audit) {
    const by = status => audit.checks.filter(c => c.status === status);
    sections.push({
      id: 'pomaha-skodi',
      heading: 'Čo pomáha a čo škodí',
      intro: `Kontroly webu rozdelené podľa výsledku. Pri každej je uvedené, ako isto vieme, že na nej záleží. Hypotézy sa do skóre nepočítajú. Skontrolovaných stránok: ${num(audit.pages)}.`,
      checkGroups: [
        { heading: 'Čo treba opraviť', empty: 'Nič, všetky kontroly sú splnené.', items: [...by('fail'), ...by('warn')] },
        { heading: 'Čo je v poriadku', empty: 'Zatiaľ nič.', items: by('ok') },
        { heading: 'Čo overujeme', empty: 'Nič.', items: by('test') },
        { heading: 'Na vaše rozhodnutie', empty: 'Nič.', items: by('info') }
      ]
    });
  }

  // 3. Who visits
  sections.push({
    id: 'kto-chodi',
    heading: 'Kto web navštevuje',
    intro: 'Roboty rozdelené podľa toho, na čo obsah používajú. Ľudia v prehliadači tu nie sú.',
    table: {
      caption: 'Roboty podľa skupiny',
      head: ['Skupina', 'Rôznych robotov', 'Stiahnutí', 'Návodov stiahnutých'],
      numeric: [false, true, true, true],
      rows: s.groups.map(g => [g.label, num(agentsByGroup.get(g.id) || 0), num(requestsByGroup.get(g.id) || 0), `${num(guidesReached(g.id))} z ${num(totalGuides)}`])
    }
  });

  // 4. Important crawlers
  sections.push({
    id: 'dolezite-roboty',
    heading: 'Dôležité roboty',
    intro: 'Roboty, od ktorých závisí, či vás nájdu vo vyhľadávaní a či vás AI môže citovať.',
    table: {
      caption: 'Dôležité roboty a ich posledná návšteva',
      head: ['Robot', 'Stav', 'Posledná návšteva', 'Čo stratíte bez neho'],
      rows: s.expected.map(e => [
        e.name + (e.must ? ' (dôležitý)' : ''),
        e.seen ? `prišiel, ${plural(Math.max(0, Math.floor((now - Date.parse(e.lastSeen)) / 86400000)), 'deň', 'dni', 'dní')} od poslednej návštevy` : 'neprišiel',
        e.seen ? date(e.lastSeen) : '—',
        e.why
      ])
    }
  });

  // 5. AI by purpose
  sections.push({
    id: 'ai-ucel',
    heading: 'AI podľa účelu',
    intro: 'Pre firmu je rozdiel, či AI obsah berie na trénovanie modelu, alebo ho používa na odpovede. Zákaz trénovania neznamená neviditeľnosť.',
    table: {
      caption: 'AI roboty podľa účelu',
      head: ['Účel', 'Čo to znamená', 'Stiahnutí', 'Kto'],
      numeric: [false, false, true, false],
      rows: s.purposes.map(p => [p.label, p.desc, num(p.requests), p.names.length ? p.names.join(', ') : 'zatiaľ nikto'])
    },
    note: 'Väčšina AI asistentov sa v našom pokuse nepredstavila menom: ChatGPT prišiel ako nástroj curl, Grok ako bežný prehliadač. Takéto návštevy sú v časti Skrytí boti alebo medzi ostatnými skriptmi.'
  });

  // 6. Hidden bots
  const hidden = s.agents.filter(a => a.category === 'hidden');
  sections.push({
    id: 'skryti',
    heading: 'Skrytí boti',
    intro: hidden.length
      ? `Identity, ktoré sa tvárili ako prehliadač, ale správali sa ako stroj: ${num(hidden.length)}. Pravidlá v robots.txt ani bežné analytiky ich neodlíšia od ľudí.`
      : 'V tomto období sa žiadny robot nevydával za prehliadač.',
    table: hidden.length ? {
      caption: 'Skrytí boti a prečo ich tak hodnotíme',
      head: ['Identita (User-Agent)', 'Skóre', 'Stiahnutí', 'Dôvody'],
      numeric: [false, true, true, false],
      rows: hidden.slice(0, 20).map(a => [a.key, `${a.score} zo 100`, num(a.requests), a.signals.filter(x => x.points > 0).map(x => x.label).join(', ')])
    } : null,
    clusters: s.clusters.slice(0, 5).map(c => `${date(c.at)}: ${plural(c.userAgents.length, 'identita', 'identity', 'identít')} naraz na stránke ${c.path}, ${plural(c.requests, 'požiadavka', 'požiadavky', 'požiadaviek')} za ${num(c.spanMs)} ms.`)
  });

  // 7. Formats
  if (s.formats) {
    const f = s.formats;
    const took = f.pairs.htmlOnly + f.pairs.alternateOnly + f.pairs.both;
    sections.push({
      id: 'formaty',
      heading: 'Ktorý formát si roboty vyberajú',
      intro: 'Každý návod je dostupný ako HTML stránka, Markdown aj JSON. K tomu súbor llms.txt so zoznamom a llms-full.txt s celým webom.',
      table: {
        caption: 'Stiahnutia podľa formátu',
        head: ['Formát', 'Stiahnutí'],
        numeric: [false, true],
        rows: f.columns.map(c => [c.label, num(f.totals[c.id])])
      },
      note: took
        ? `Pri ${plural(took, 'návode', 'návodoch', 'návodoch')}, ktoré si robot vzal: len HTML ${num(f.pairs.htmlOnly)}, len Markdown alebo JSON ${num(f.pairs.alternateOnly)}, oboje ${num(f.pairs.both)}.`
        : 'Zatiaľ si žiadny robot nevzal žiadny návod.'
    });
  }

  // 8. The structured-vs-baseline experiment
  const tested = s.coverage.filter(c => c.id !== 'other' && c.id !== 'hidden');
  const verdict = c => {
    const a = c.byVariant.structured, b = c.byVariant.baseline;
    if (a.fetched + b.fetched < 10) return 'príliš málo údajov na záver';
    const overlap = a.interval.low <= b.interval.high && b.interval.low <= a.interval.high;
    if (overlap) return 'rozdiel zatiaľ nie je preukázateľný';
    return a.share > b.share ? 'rozšírený variant sťahujú preukázateľne častejšie' : 'základný variant sťahujú preukázateľne častejšie';
  };
  sections.push({
    id: 'pokus-faq',
    heading: 'Pokus: pomáhajú časté otázky a štruktúrované dáta?',
    intro: 'Polovica návodov (rozšírený variant) má navyše časté otázky, box Rýchle fakty a dáta FAQPage. Druhá polovica nie. V každej téme je pomer rovnaký, takže téma výsledok neskresľuje. Porovnávame, akú časť z každej polovice si roboty stiahli. Rozsah v zátvorke je 95 % interval spoľahlivosti: kým sa rozsahy oboch variantov prekrývajú, rozdiel môže byť náhoda.',
    table: {
      caption: 'Podiel stiahnutých návodov podľa variantu',
      head: ['Skupina robotov', 'Rozšírený variant', 'Základný variant', 'Záver'],
      rows: tested.map(c => {
        const cell = v => `${num(v.fetched)} z ${num(v.published)} (${pct(v.share)}, rozsah ${pct(v.interval.low)}–${pct(v.interval.high)})`;
        return [groups.get(c.id), cell(c.byVariant.structured), cell(c.byVariant.baseline), verdict(c)];
      })
    },
    note: 'Stiahnutie ešte neznamená zaradenie do indexu ani citáciu. Pokus ukazuje, čo roboty sťahujú; vplyv na zobrazenia ukáže až Search Console.'
  });

  // 9. Activity by day (the chart's table twin)
  sections.push({
    id: 'aktivita',
    heading: 'Aktivita robotov po dňoch',
    intro: s.timeline.length ? `Od ${day(s.timeline[0].day)} do ${day(s.timeline[s.timeline.length - 1].day)}. Dni bez návštev sú uvedené s nulou.` : 'Žiadna aktivita.',
    table: s.timeline.length ? {
      caption: 'Počet stiahnutí po dňoch podľa skupiny robotov',
      head: ['Deň', ...s.groups.map(g => g.label), 'Spolu'],
      numeric: [false, ...s.groups.map(() => true), true],
      rows: s.timeline.map(t => {
        const values = s.groups.map(g => t.counts[g.id] || 0);
        return [day(t.day), ...values.map(num), num(values.reduce((a, b) => a + b, 0))];
      })
    } : null
  });

  // 10. How to read this
  sections.push({
    id: 'ako-citat',
    heading: 'Ako čítať túto správu',
    list: [
      'Meno robota je jeho vlastné tvrdenie v hlavičke User-Agent. Dá sa sfalšovať.',
      'Stiahnutie stránky neznamená zaradenie do vyhľadávania ani citáciu v odpovedi AI.',
      'IP adresy návštevníkov neukladáme. Skrytých botov preto odhaľujeme podľa správania: nesťahujú štýly, nespúšťajú JavaScript, prichádzajú s viacerými identitami naraz.',
      'Skóre skrytých botov je odhad podľa signálov, nie istota.',
      `Kontroly s označením „${EVIDENCE.hypothesis}“ Lab práve overuje; do skóre pripravenosti sa nepočítajú.`
    ]
  });

  return {
    title: 'Správa o viditeľnosti webu pre vyhľadávače a AI',
    siteUrl,
    generatedAt,
    days,
    headline,
    summary,
    auditScore: audit ? audit.score : null,
    sections
  };
}

// ---------------------------------------------------------------------------

function tableHtml(t) {
  if (!t) return '';
  const numeric = t.numeric || [];
  return `<div class="table-wrap"><table>
<caption>${esc(t.caption)}</caption>
<thead><tr>${t.head.map((h, i) => `<th scope="col"${numeric[i] ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${t.rows.map(r => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td${numeric[i] ? ' class="num"' : ''}>${esc(c)}</td>`)).join('')}</tr>`).join('\n')}</tbody>
</table></div>`;
}

/** Semantic fragment. Everything data-derived is escaped. */
export function renderReportHtml(report, { headingOffset = 1, includeTitle = true } = {}) {
  const h = level => `h${Math.min(6, level + headingOffset - 1)}`;
  const parts = [];
  // Pages that already carry their own h1 leave the title out, so sections
  // stay on level 2 where a screen-reader user expects to jump between them.
  if (includeTitle) parts.push(`<${h(1)} id="sprava">${esc(report.title)}</${h(1)}>`);
  parts.push(`<p class="meta">Web: ${esc(report.siteUrl)}. Obdobie: ${report.days === 1 ? 'posledný deň' : `posledných ${esc(report.days)} dní`}. Vytvorené ${esc(date(report.generatedAt))}.</p>`);
  const toc = [{ id: 'zhrnutie', heading: 'Zhrnutie' }, ...report.sections];
  parts.push(`<nav aria-labelledby="obsah"><${h(2)} id="obsah">Obsah správy</${h(2)}><p>Jednotlivé časti sa dajú preskakovať nadpismi úrovne ${headingOffset + 1}.</p><ol>${toc.map(s => `<li><a href="#${s.id}">${esc(s.heading)}</a></li>`).join('')}</ol></nav>`);

  parts.push(`<section aria-labelledby="zhrnutie"><${h(2)} id="zhrnutie">1. Zhrnutie</${h(2)}><p class="headline"><strong>${esc(report.headline)}</strong></p><ul>${report.summary.map(line => `<li>${esc(line)}</li>`).join('')}</ul></section>`);

  report.sections.forEach((s, index) => {
    const out = [`<section aria-labelledby="${s.id}"><${h(2)} id="${s.id}">${index + 2}. ${esc(s.heading)}</${h(2)}>`];
    if (s.intro) out.push(`<p>${esc(s.intro)}</p>`);
    if (s.steps) {
      out.push(`<ol class="steps">${s.steps.map(step => `<li><strong>${esc(step.label)}:</strong> ${step.value === null || step.value === undefined ? esc(step.unit) : `${esc(step.value)} ${esc(step.unit)}`}. ${esc(step.text)}</li>`).join('')}</ol>`);
    }
    if (s.checkGroups) {
      for (const g of s.checkGroups) {
        out.push(`<${h(3)}>${esc(g.heading)}</${h(3)}>`);
        out.push(g.items.length ? `<ul class="checks">${g.items.map(c => `<li class="check ${esc(c.status)}"><strong>${esc(STATUS_WORD[c.status])}: ${esc(c.title)}.</strong> ${esc(c.result)} <span class="why">Prečo na tom záleží: ${esc(c.why)}</span> <span class="evidence">Istota: ${esc(EVIDENCE[c.evidence])}.</span></li>`).join('')}</ul>` : `<p>${esc(g.empty)}</p>`);
      }
    }
    out.push(tableHtml(s.table));
    if (s.clusters && s.clusters.length) out.push(`<${h(3)}>Viac identít naraz</${h(3)}><ul>${s.clusters.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`);
    if (s.list) out.push(`<ul>${s.list.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`);
    if (s.note) out.push(`<p class="note">${esc(s.note)}</p>`);
    out.push('</section>');
    parts.push(out.join('\n'));
  });
  return parts.join('\n');
}

/** Self-contained document for download, printing and sending to a client. */
export function renderReportDocument(report) {
  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(report.title)}</title>
<style>
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0b0b0b; background: #fcfcfb; max-width: 60rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.8rem; line-height: 1.2; } h2 { margin-top: 2.2rem; border-top: 1px solid #e1e0d9; padding-top: 1.2rem; } h3 { margin-top: 1.4rem; }
  .meta, .note, .why, .evidence { color: #52514e; } .why, .evidence { display: block; font-size: .92em; }
  .headline { font-size: 1.1rem; }
  .table-wrap { overflow-x: auto; } table { border-collapse: collapse; width: 100%; margin: .8rem 0; font-size: .95rem; }
  caption { text-align: left; font-weight: 600; padding: .4rem 0; } th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid #e1e0d9; vertical-align: top; }
  thead th { border-bottom: 2px solid #c3c2b7; } .num { text-align: right; font-variant-numeric: tabular-nums; }
  .checks { padding-left: 1.2rem; } .check { margin: .7rem 0; }
  a { color: #1c5cab; } @media print { body { background: #fff; padding: 0; } nav { display: none; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<main>
${renderReportHtml(report)}
</main>
</body>
</html>
`;
}

/** Semicolon-separated with a BOM, so Excel with Slovak settings opens it correctly. */
export function agentsCsv(stats) {
  const cell = value => {
    const text = String(value ?? '');
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const head = ['Agent', 'Druh', 'Účel', 'Stiahnutí', 'Stránok', 'Rôznych ciest', 'Renderoval (CSS)', 'Spustil JavaScript', 'Čítal robots.txt', 'Skóre skrytého bota', 'Prvá návšteva', 'Posledná návšteva', 'User-Agent'];
  const rows = stats.agents.map(a => [
    a.named ? a.name : (a.category === 'hidden' ? 'Skrytý bot' : 'Nepredstavil sa'),
    a.category, a.purpose || '', a.requests, a.pages, a.distinctPaths,
    a.renders ? 'áno' : 'nie', a.pages ? `${a.ranJs} z ${a.pages}` : '', a.readRobots ? 'áno' : 'nie',
    a.score ?? '', a.firstSeen, a.lastSeen, a.key
  ]);
  return `﻿${[head, ...rows].map(r => r.map(cell).join(';')).join('\r\n')}\r\n`;
}
