const baseStyles = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
`;

export const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const absolute = (siteUrl, path = '/') => `${siteUrl.replace(/\/$/, '')}${path}`;

const jsonLd = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

export function pageHead({ title, description, path, siteUrl, verification, structuredData = [] }) {
  const canonical = absolute(siteUrl, path);
  const graph = structuredData.map(jsonLd).join('\n');
  const googleVerification = verification.google
    ? `<meta name="google-site-verification" content="${escapeHtml(verification.google)}">`
    : '';
  const bingVerification = verification.bing
    ? `<meta name="msvalidate.01" content="${escapeHtml(verification.bing)}">`
    : '';

  return `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Search Lab">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    ${googleVerification}
    ${bingVerification}
    ${baseStyles}
    ${graph}`;
}

export function layout({ title, description, path, siteUrl, verification, structuredData, content }) {
  return `<!doctype html>
<html lang="sk">
  <head>
    ${pageHead({ title, description, path, siteUrl, verification, structuredData })}
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Search Lab domov">Search <span>Lab</span></a>
      <nav aria-label="Hlavná navigácia">
        <a href="/">Návody</a>
        <a href="/research/">Metodika</a>
      </nav>
    </header>
    ${content}
    <footer class="site-footer">
      <p><strong>Search Lab</strong> je transparentný obsahový experiment AgentFindu.</p>
      <p>Nemeriame „AI ranking“. Sledujeme indexáciu, vyhľadávacie dopyty a technickú čitateľnosť stránok.</p>
    </footer>
  </body>
</html>`;
}

const guidePath = guide => `/${guide.section}/${guide.slug}/`;

export function renderHome({ guides, sections, siteUrl, verification }) {
  const sectionCards = sections.map(section => {
    const count = guides.filter(guide => guide.section === section.slug).length;
    return `<a class="section-card" href="/${section.slug}/">
      <span class="eyebrow">${count} návodov</span>
      <h2>${escapeHtml(section.label)}</h2>
      <p>${escapeHtml(section.description)}</p>
      <span class="arrow">Prejsť na tému →</span>
    </a>`;
  }).join('');

  return layout({
    title: 'Search Lab — praktické návody a otvorený SEO experiment',
    description: 'Päťdesiat praktických slovenských návodov a otvorená metodika merania indexácie, dopytov a technickej čitateľnosti vo vyhľadávačoch.',
    path: '/', siteUrl, verification,
    structuredData: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Search Lab', url: absolute(siteUrl) }],
    content: `<main>
      <section class="hero">
        <p class="kicker">Otvorený experiment · 50 praktických článkov</p>
        <h1>Čo sa dá zmerať, keď web naozaj pomáha?</h1>
        <p class="lead">Praktické návody o prírode, vesmíre, autách, kvetoch, mori, jedle a záhrade. Každá stránka je verejná, rýchla a čitateľná bez JavaScriptu.</p>
        <a class="button" href="/research/">Pozrieť metodiku merania</a>
      </section>
      <section class="notice" aria-label="Ako funguje experiment">
        <strong>Prečo tento web existuje?</strong>
        <span>Porovnávame dve rovnocenné formy článkov: bežnú stránku a stránku s jasnými faktami, FAQ a štruktúrovanými dátami. Výsledky budeme čítať z Google Search Console a Bing Webmaster Tools.</span>
      </section>
      <section class="section-grid" aria-label="Témy návodov">${sectionCards}</section>
    </main>`
  });
}

export function renderSection({ section, guides, siteUrl, verification }) {
  const cards = guides.map(guide => `<article class="guide-card">
    <p class="eyebrow">${escapeHtml(guide.readTime)} · ${escapeHtml(guide.variant === 'structured' ? 'Rozšírený formát' : 'Základný formát')}</p>
    <h2><a href="${guidePath(guide)}">${escapeHtml(guide.title)}</a></h2>
    <p>${escapeHtml(guide.description)}</p>
    <a class="text-link" href="${guidePath(guide)}">Čítať návod →</a>
  </article>`).join('');

  return layout({
    title: `${section.label} — návody | Search Lab`,
    description: `Praktické slovenské návody na tému ${section.label.toLowerCase()}.`,
    path: `/${section.slug}/`, siteUrl, verification,
    structuredData: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${section.label} — Search Lab`, url: absolute(siteUrl, `/${section.slug}/`) }],
    content: `<main class="content-shell">
      <p class="breadcrumb"><a href="/">Návody</a> / ${escapeHtml(section.label)}</p>
      <header class="page-intro"><p class="kicker">Téma</p><h1>${escapeHtml(section.label)}</h1><p>${escapeHtml(section.description)}</p></header>
      <section class="guide-grid">${cards}</section>
    </main>`
  });
}

export function renderGuide({ guide, section, related, siteUrl, verification }) {
  const path = guidePath(guide);
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'sk',
    datePublished: '2026-09-11',
    dateModified: '2026-09-11',
    mainEntityOfPage: absolute(siteUrl, path),
    author: { '@type': 'Organization', name: 'Search Lab' },
    publisher: { '@type': 'Organization', name: 'Search Lab' }
  };
  const schemas = [articleSchema];
  if (guide.variant === 'structured') {
    schemas.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: guide.faq.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } }))
    });
  }
  const facts = guide.variant === 'structured' ? `<aside class="facts" aria-label="Rýchle fakty">
    <p class="eyebrow">Rýchle fakty</p><dl>
      ${guide.facts.map(fact => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join('')}
    </dl>
  </aside>` : '';
  const faq = guide.variant === 'structured' ? `<section class="faq"><h2>Časté otázky</h2>${guide.faq.map(item => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</section>` : '';
  const relatedCards = related.map(item => `<a href="${guidePath(item)}">${escapeHtml(item.title)} <span>→</span></a>`).join('');

  return layout({
    title: `${guide.title} | Search Lab`, description: guide.description, path, siteUrl, verification, structuredData: schemas,
    content: `<main class="article-shell">
      <p class="breadcrumb"><a href="/">Návody</a> / <a href="/${guide.section}/">${escapeHtml(section.label)}</a></p>
      <article>
        <header class="article-header"><p class="kicker">${escapeHtml(section.label)} · ${escapeHtml(guide.readTime)}</p><h1>${escapeHtml(guide.title)}</h1><p class="lead">${escapeHtml(guide.description)}</p></header>
        ${facts}
        <div class="article-body">
          ${guide.body.map(block => `<section><h2>${escapeHtml(block.heading)}</h2>${block.paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}${block.steps ? `<ol>${block.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : ''}</section>`).join('')}
        </div>
        ${faq}
      </article>
      <aside class="related"><p class="eyebrow">Súvisiace návody</p><div>${relatedCards}</div></aside>
    </main>`
  });
}

export function renderResearch({ siteUrl, verification }) {
  return layout({
    title: 'Metodika merania | Search Lab',
    description: 'Ako Search Lab meria indexáciu, dopyty, zobrazenia a technickú pripravenosť bez sľubov o AI rankingu.',
    path: '/research/', siteUrl, verification,
    structuredData: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Metodika merania Search Lab', url: absolute(siteUrl, '/research/') }],
    content: `<main class="content-shell research">
      <p class="breadcrumb"><a href="/">Návody</a> / Metodika</p>
      <header class="page-intro"><p class="kicker">Merací plán</p><h1>Čo budeme merať a čo z toho vieme vyvodiť</h1><p>Nie je to test „kto je lepší v Google“. Sledujeme reálne dáta po indexácii a porovnávame porovnateľné skupiny stránok.</p></header>
      <section class="metric-grid">
        <article><h2>Google Search Console</h2><p>Indexované URL, dopyty, zobrazenia, kliky, CTR a priemerná pozícia pre každú stránku a skupinu stránok.</p></article>
        <article><h2>Bing Webmaster Tools</h2><p>Samostatná indexácia a výkon v Bingu. Dáta nebudeme miešať s Googlom.</p></article>
        <article><h2>Technická čitateľnosť</h2><p>Sitemap, canonical, HTML bez nutnosti JavaScriptu, interné odkazy, Article schema a na vybraných stránkach FAQ schema.</p></article>
        <article><h2>Prehľady botov</h2><p>Vercel request logy môžu ukázať požiadavky crawlerov. Nie sú dôkazom, že AI odpovie obsahom v chate.</p></article>
      </section>
      <section class="method"><h2>Dve skupiny</h2><p>Polovica článkov má navyše viditeľné rýchle fakty, FAQ a zodpovedajúce schema.org dáta. Druhá polovica má rovnako užitočný návod, ale bežnú štruktúru. Porovnanie začneme až po dostatočnej indexácii a aspoň 28 dňoch dát.</p><p>Výsledok bude len orientačný signál. Téma, sezónnosť a nulový dopyt môžu výsledok skresliť, preto budeme pozerať na skupiny a nie na jediný článok.</p></section>
      <section class="method"><h2>Čo tento web netvrdí</h2><p>Neexistuje verejný „AI ranking“ ani spôsob, ako z návštevy bota dokázať, že ChatGPT, Perplexity alebo iný agent stránku odporučil. Tieto služby nepotrebujeme na štart. Ak neskôr budeme testovať odpovede konkrétneho nástroja, budeme to viesť ako samostatný manuálny experiment.</p></section>
    </main>`
  });
}
