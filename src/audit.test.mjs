import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSite, robotsAllows } from './audit.mjs';

test('robots.txt: the most specific group wins, then the longest path', () => {
  const robots = 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Bingbot\nDisallow: /private/\nAllow: /private/open/';
  assert.equal(robotsAllows(robots, 'Googlebot'), true);
  assert.equal(robotsAllows(robots, 'GPTBot'), false);
  assert.equal(robotsAllows(robots, 'gptbot'), false);
  assert.equal(robotsAllows(robots, 'Bingbot', '/'), true);
  assert.equal(robotsAllows(robots, 'Bingbot', '/private/x'), false);
  assert.equal(robotsAllows(robots, 'Bingbot', '/private/open/x'), true);
  assert.equal(robotsAllows('', 'Anything'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow:', 'Anything'), true);
});

test('robots.txt: consecutive user-agent lines share one group', () => {
  const robots = 'User-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /';
  assert.equal(robotsAllows(robots, 'OAI-SearchBot'), false);
  assert.equal(robotsAllows(robots, 'PerplexityBot'), false);
  assert.equal(robotsAllows(robots, 'Googlebot'), true);
});

const page = ({ title = 'Návod na niečo užitočné', description = 'Popis stránky, ktorý má primeranú dĺžku pre vyhľadávač aj AI.', canonical, links = [], robots = '', body = 'Text '.repeat(80), ld = true }) => `<!doctype html><html lang="sk"><head>
<title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}">
${robots ? `<meta name="robots" content="${robots}">` : ''}
<meta name="google-site-verification" content="g"><meta name="msvalidate.01" content="b">
${ld ? '<script type="application/ld+json">{"@type":"Article"}</script>' : ''}
</head><body><h1>Nadpis</h1><p>${body}</p>${links.map(l => `<a href="${l}">x</a>`).join('')}</body></html>`;

function site(overrides = {}) {
  const base = 'https://lab.test';
  const files = new Map([
    ['index.html', page({ canonical: `${base}/`, links: ['/a/', '/b/'] })],
    ['a/index.html', page({ canonical: `${base}/a/` })],
    ['b/index.html', page({ canonical: `${base}/b/` })],
    ['robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`],
    ['sitemap.xml', `<urlset><url><loc>${base}/</loc></url><url><loc>${base}/a/</loc></url><url><loc>${base}/b/</loc></url></urlset>`],
    ['admin/index.html', page({ canonical: `${base}/admin/`, robots: 'noindex' })]
  ]);
  for (const [k, v] of Object.entries(overrides)) files.set(k, v);
  return auditSite(files, { siteUrl: base });
}
const check = (audit, id) => audit.checks.find(c => c.id === id);

test('a clean site scores 100 and ignores the admin pages', () => {
  const audit = site();
  assert.equal(audit.pages, 3);
  assert.equal(audit.score, 100);
  assert.equal(audit.counts.fail, 0);
  assert.equal(check(audit, 'noindex').status, 'ok');
});

test('flags what hurts visibility', () => {
  const audit = site({
    'robots.txt': 'User-agent: OAI-SearchBot\nDisallow: /\n',
    'b/index.html': page({ canonical: 'https://lab.test/b/', robots: 'noindex' }),
    'c/index.html': page({ canonical: 'https://lab.test/c/', body: 'krátko', ld: false })
  });
  assert.equal(check(audit, 'robots-visibility').status, 'fail');
  assert.match(check(audit, 'robots-visibility').result, /OAI-SearchBot/);
  assert.equal(check(audit, 'noindex').status, 'fail');
  assert.equal(check(audit, 'internal-links').status, 'warn'); // c is an orphan
  assert.equal(check(audit, 'sitemap').status, 'warn');        // c missing, no Sitemap line
  assert.ok(audit.score < 100);
});

test('training bots are a decision, not a failure, and hypotheses never score', () => {
  const allowed = site();
  const blocked = site({ 'robots.txt': 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: https://lab.test/sitemap.xml\n' });
  assert.equal(check(blocked, 'robots-training').status, 'info');
  assert.equal(blocked.score, allowed.score);
  for (const id of ['faq', 'llms-txt', 'alternates']) assert.equal(check(allowed, id).status, 'test');
});
