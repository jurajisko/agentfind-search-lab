import assert from 'node:assert/strict';
import test from 'node:test';
import { guides, sections as rawSections, variantFor } from './content.mjs';
import { guideJson, guideMarkdown, llmsFullTxt, llmsTxt, markdownPath } from './formats.mjs';

const siteUrl = 'https://lab.test';
const sections = rawSections.map(([slug, label]) => ({ slug, label }));
const sectionFor = slug => sections.find(s => s.slug === slug);
// Same augmentation as scripts/build.mjs.
const augmented = guides.map((guide, index) => ({
  ...guide,
  variant: variantFor(index),
  readTime: '3 min čítania',
  body: [{ heading: 'Jednoduchý postup', paragraphs: [guide.intro], steps: guide.steps }],
  facts: [{ label: 'Typ návodu', value: 'Praktický základ' }],
  faq: guide.faqs.map(([question, answer]) => ({ question, answer }))
}));
const structured = augmented.find(g => g.variant === 'structured');
const baseline = augmented.find(g => g.variant === 'baseline');

test('the baseline variant gets no FAQ or facts in any format', () => {
  // Otherwise the structured-vs-baseline experiment on the HTML pages leaks.
  const md = guideMarkdown(baseline, { section: sectionFor(baseline.section), siteUrl });
  assert.ok(!md.includes('Časté otázky'));
  assert.ok(!md.includes('Rýchle fakty'));
  baseline.faq.forEach(item => assert.ok(!md.includes(item.question), item.question));

  const json = JSON.parse(guideJson(baseline, { section: sectionFor(baseline.section), siteUrl }));
  assert.equal(json.faq, undefined);
  assert.equal(json.facts, undefined);
});

test('the structured variant carries its FAQ and facts in every format', () => {
  const md = guideMarkdown(structured, { section: sectionFor(structured.section), siteUrl });
  assert.ok(md.includes('## Časté otázky'));
  assert.ok(md.includes('## Rýchle fakty'));
  structured.faq.forEach(item => assert.ok(md.includes(item.question), item.question));

  const json = JSON.parse(guideJson(structured, { section: sectionFor(structured.section), siteUrl }));
  assert.equal(json.faq.length, structured.faq.length);
  assert.equal(json.facts.length, structured.facts.length);
});

test('markdown and JSON carry the same core content as the HTML page', () => {
  for (const guide of [structured, baseline]) {
    const md = guideMarkdown(guide, { section: sectionFor(guide.section), siteUrl });
    const json = JSON.parse(guideJson(guide, { section: sectionFor(guide.section), siteUrl }));
    assert.ok(md.startsWith(`# ${guide.title}\n`));
    assert.ok(md.includes(guide.intro));
    guide.steps.forEach(step => assert.ok(md.includes(step), step));
    assert.equal(json.title, guide.title);
    assert.deepEqual(json.body[0].steps, guide.steps);
    assert.equal(json.url, `${siteUrl}/${guide.section}/${guide.slug}/`);
    assert.equal(json.alternates.markdown, `${siteUrl}${markdownPath(guide)}`);
  }
});

test('llms.txt links every guide to its markdown file', () => {
  const index = llmsTxt({ guides: augmented, sections, siteUrl });
  assert.ok(index.startsWith('# Search Lab\n'));
  const links = [...index.matchAll(/\]\((https:\/\/lab\.test\/[^)]+\.md)\)/g)].map(m => m[1]);
  assert.equal(links.length, 50);
  assert.equal(new Set(links).size, 50);
});

test('llms-full.txt contains every guide', () => {
  const full = llmsFullTxt({ guides: augmented, sections, siteUrl });
  augmented.forEach(guide => assert.ok(full.includes(`# ${guide.title}`), guide.slug));
});
