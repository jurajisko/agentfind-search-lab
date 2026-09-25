/**
 * Machine-readable representations of each guide.
 *
 * The experiment question is which representation crawlers actually request
 * when several carry the same content: the HTML page, a Markdown file, a JSON
 * file, the llms.txt index, or the whole site in llms-full.txt.
 *
 * Each representation mirrors its guide's variant. A baseline guide gets no
 * FAQ and no facts here either, otherwise the structured-vs-baseline
 * comparison running on the HTML pages would leak through the side door.
 */
const guidePath = guide => `/${guide.section}/${guide.slug}/`;
const absolute = (siteUrl, path) => `${siteUrl}${path}`;

export const markdownPath = guide => `/${guide.section}/${guide.slug}.md`;
export const jsonPath = guide => `/${guide.section}/${guide.slug}.json`;

function structured(guide) {
  return guide.variant === 'structured';
}

export function guideMarkdown(guide, { section, siteUrl }) {
  const lines = [
    `# ${guide.title}`,
    '',
    `> ${guide.description}`,
    '',
    `Sekcia: ${section.label} · ${guide.readTime}`,
    `Zdroj: ${absolute(siteUrl, guidePath(guide))}`,
    ''
  ];
  if (structured(guide)) {
    lines.push('## Rýchle fakty', '');
    guide.facts.forEach(fact => lines.push(`- **${fact.label}:** ${fact.value}`));
    lines.push('');
  }
  for (const block of guide.body) {
    lines.push(`## ${block.heading}`, '');
    block.paragraphs.forEach(text => lines.push(text, ''));
    if (block.steps) {
      block.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
      lines.push('');
    }
  }
  if (structured(guide)) {
    lines.push('## Časté otázky', '');
    guide.faq.forEach(item => lines.push(`### ${item.question}`, '', item.answer, ''));
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function guideJson(guide, { section, siteUrl }) {
  const data = {
    schema_version: '1',
    url: absolute(siteUrl, guidePath(guide)),
    title: guide.title,
    description: guide.description,
    language: 'sk',
    section: { slug: section.slug, label: section.label },
    date_published: '2026-09-11',
    date_modified: '2026-09-11',
    body: guide.body.map(block => ({
      heading: block.heading,
      paragraphs: block.paragraphs,
      ...(block.steps ? { steps: block.steps } : {})
    })),
    alternates: {
      html: absolute(siteUrl, guidePath(guide)),
      markdown: absolute(siteUrl, markdownPath(guide))
    }
  };
  if (structured(guide)) {
    data.facts = guide.facts;
    data.faq = guide.faq;
  }
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Index in the llms.txt convention: H1, summary, then linked sections. */
export function llmsTxt({ guides, sections, siteUrl }) {
  const lines = [
    '# Search Lab',
    '',
    '> Krátke praktické návody v slovenčine: príroda, vesmír, autá, kvety, more, jedlo a záhrada. Každý návod je dostupný ako HTML stránka, Markdown aj JSON.',
    '',
    `Celý obsah v jednom súbore: ${absolute(siteUrl, '/llms-full.txt')}`,
    ''
  ];
  for (const section of sections) {
    const list = guides.filter(guide => guide.section === section.slug);
    if (!list.length) continue;
    lines.push(`## ${section.label}`, '');
    list.forEach(guide => lines.push(`- [${guide.title}](${absolute(siteUrl, markdownPath(guide))}): ${guide.description}`));
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function llmsFullTxt({ guides, sections, siteUrl }) {
  const byslug = new Map(sections.map(section => [section.slug, section]));
  const parts = guides.map(guide => guideMarkdown(guide, { section: byslug.get(guide.section), siteUrl }));
  return `# Search Lab — všetky návody\n\n${parts.join('\n---\n\n')}`;
}
