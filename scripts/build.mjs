import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides, sections as rawSections, variantFor } from '../src/content.mjs';
import { renderGuide, renderHome, renderResearch, renderSection } from '../src/templates.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '..');
const dist = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://agentfind-search-lab.vercel.app').replace(/\/$/, '');
const verification = {
  google: process.env.GOOGLE_SITE_VERIFICATION || '',
  bing: process.env.BING_SITE_VERIFICATION || ''
};
const sectionDescriptions = {
  priroda: 'Pozorovanie prírody a jednoduché výpravy von.',
  vesmir: 'Základné orientovanie na nočnej oblohe.',
  auta: 'Bežná starostlivosť o auto a bezpečná jazda.',
  kvety: 'Pestovanie kvetov doma, na balkóne aj v záhrade.',
  more: 'Základy mora, lodí a bezpečného pobytu pri vode.',
  jedlo: 'Jednoduché kuchynské postupy a suroviny.',
  zahrada: 'Praktické malé projekty pre záhradu.'
};
const sections = rawSections.map(([slug, label]) => ({ slug, label, description: sectionDescriptions[slug] }));

if (guides.length !== 50) throw new Error(`Expected 50 guides, found ${guides.length}.`);
if (new Set(guides.map(guide => `${guide.section}/${guide.slug}`)).size !== guides.length) throw new Error('Guide paths must be unique.');

const write = async (relativePath, contents) => {
  const target = path.join(dist, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
};

const sectionFor = slug => sections.find(section => section.slug === slug);
const guidePath = guide => `/${guide.section}/${guide.slug}/`;
const url = pathname => `${siteUrl}${pathname}`;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const augmentedGuides = guides.map((guide, index) => ({
  ...guide,
  variant: variantFor(index),
  readTime: '3 min čítania',
  body: [{ heading: 'Jednoduchý postup', paragraphs: [guide.intro], steps: guide.steps }],
  facts: [
    { label: 'Typ návodu', value: 'Praktický základ' },
    { label: 'Čas na začiatok', value: 'Približne 10 minút' },
    { label: 'Úroveň', value: 'Pre začiatočníkov' }
  ],
  faq: guide.faqs.map(([question, answer]) => ({ question, answer }))
}));
await write('index.html', renderHome({ guides: augmentedGuides, sections, siteUrl, verification }));
await write('research/index.html', renderResearch({ siteUrl, verification }));

for (const section of sections) {
  const sectionGuides = augmentedGuides.filter(guide => guide.section === section.slug);
  await write(`${section.slug}/index.html`, renderSection({ section, guides: sectionGuides, siteUrl, verification }));
}

for (const guide of augmentedGuides) {
  const related = augmentedGuides.filter(item => item.section === guide.section && item.slug !== guide.slug).slice(0, 3);
  await write(`${guide.section}/${guide.slug}/index.html`, renderGuide({ guide, section: sectionFor(guide.section), related, siteUrl, verification }));
}

const sitemapPaths = ['/', '/research/', ...sections.map(section => `/${section.slug}/`), ...augmentedGuides.map(guidePath)];
await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map(item => `  <url><loc>${url(item)}</loc></url>`).join('\n')}\n</urlset>\n`);
await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${url('/sitemap.xml')}\n`);
await write('site.webmanifest', JSON.stringify({ name: 'Search Lab', short_name: 'Search Lab', start_url: '/', display: 'browser', lang: 'sk' }, null, 2));

const css = await import('node:fs/promises').then(fs => fs.readFile(path.join(root, 'src/styles.css'), 'utf8'));
await write('styles.css', css);
console.log(`Built ${sitemapPaths.length} indexable pages in dist for ${siteUrl}`);
