import assert from 'node:assert/strict';
import test from 'node:test';
import middleware, { agentClassFrom, crawlerFrom, guideBase, prefersMarkdown, resourceKindFrom } from './middleware.js';

const classify = userAgent => agentClassFrom(userAgent, crawlerFrom(userAgent));

test('recognises the on-demand fetchers an assistant uses when asked about a URL', () => {
  // These were missing before and are the ones a probe run actually produces.
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)'), 'Claude-User');
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)'), 'ChatGPT-User');
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; Perplexity-User/1.0)'), 'Perplexity-User');
});

test('keeps the narrower training and search crawlers apart', () => {
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; ClaudeBot/1.0)'), 'ClaudeBot');
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; Claude-SearchBot/1.0)'), 'Claude-SearchBot');
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; GPTBot/1.2)'), 'GPTBot');
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; OAI-SearchBot/1.0)'), 'OAI-SearchBot');
  assert.equal(crawlerFrom('Googlebot-Image/1.0'), 'Googlebot');
  assert.equal(crawlerFrom('Mozilla/5.0 (compatible; Google-Extended/1.0)'), 'Google-Extended');
});

test('classifies agents that are not on any list', () => {
  assert.equal(classify('Mozilla/5.0 (compatible; SomeNewAIBot/0.1; +https://example.com)'), 'likely_automation');
  assert.equal(classify('python-requests/2.32.3'), 'likely_automation');
  assert.equal(classify('curl/8.9.1'), 'likely_automation');
  assert.equal(classify('node-fetch/3.3.2'), 'likely_automation');
  assert.equal(classify(''), 'no_user_agent');
  assert.equal(classify('   '), 'no_user_agent');
});

test('an ordinary browser is recorded but not called automation', () => {
  assert.equal(classify('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'), 'browser_like');
  assert.equal(classify('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'), 'browser_like');
});

test('a named crawler wins over the generic automation guess', () => {
  assert.equal(classify('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), 'known_crawler');
});

test('separates the resources that reveal rendering behaviour', () => {
  assert.equal(resourceKindFrom('/styles.css'), 'stylesheet');
  assert.equal(resourceKindFrom('/robots.txt'), 'robots');
  assert.equal(resourceKindFrom('/sitemap.xml'), 'sitemap');
  assert.equal(resourceKindFrom('/site.webmanifest'), 'manifest');
  assert.equal(resourceKindFrom('/favicon.ico'), 'icon');
  assert.equal(resourceKindFrom('/'), 'home');
  assert.equal(resourceKindFrom('/research/'), 'research');
  assert.equal(resourceKindFrom('/priroda/'), 'section');
  assert.equal(resourceKindFrom('/priroda/pozorovanie-vtakov/'), 'guide');
});

test('tells alternate formats of a guide apart from the HTML page', () => {
  assert.equal(resourceKindFrom('/priroda/pozorovanie-vtakov.md'), 'guide_md');
  assert.equal(resourceKindFrom('/priroda/pozorovanie-vtakov.json'), 'guide_json');
  assert.equal(resourceKindFrom('/llms.txt'), 'llms_txt');
  assert.equal(resourceKindFrom('/llms-full.txt'), 'llms_full');
  // Unchanged neighbours.
  assert.equal(resourceKindFrom('/priroda/pozorovanie-vtakov'), 'guide');
  assert.equal(resourceKindFrom('/priroda/'), 'section');
  assert.equal(resourceKindFrom('/robots.txt'), 'robots');
});

test('recognises the IndexNow key file', () => {
  assert.equal(resourceKindFrom('/da408d8ce09675b416388d49028b52e7.txt'), 'indexnow_key');
  assert.equal(resourceKindFrom('/llms.txt'), 'llms_txt');
});

test('Markdown is chosen only when the agent ranks it at least as high as HTML', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.8'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown'), true);
  assert.equal(prefersMarkdown('text/x-markdown'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.9'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
  // Browsers, Googlebot and plain fetchers never ask for Markdown.
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown(''), false);
});

test('only real guides are negotiated', () => {
  assert.equal(guideBase('/priroda/pozorovanie-vtakov/'), '/priroda/pozorovanie-vtakov');
  assert.equal(guideBase('/priroda/pozorovanie-vtakov'), '/priroda/pozorovanie-vtakov');
  assert.equal(guideBase('/priroda/neexistuje/'), null);
  assert.equal(guideBase('/priroda/'), null);
  assert.equal(guideBase('/'), null);
});

const call = (path, accept) => middleware(new Request(`https://lab.test${path}`, { headers: accept ? { accept } : {} }));

test('an agent asking for Markdown gets the guide Markdown at the same URL', async () => {
  const response = await call('/priroda/pozorovanie-vtakov/', 'text/markdown, text/html;q=0.5');
  assert.equal(response.headers.get('x-middleware-rewrite'), 'https://lab.test/priroda/pozorovanie-vtakov.md');
  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(response.headers.get('vary'), 'Accept');
  assert.equal(response.headers.get('x-middleware-next'), null);
});

test('a browser gets the HTML with the Markdown advertised in a Link header', async () => {
  const response = await call('/priroda/pozorovanie-vtakov/', 'text/html,*/*;q=0.8');
  assert.equal(response.headers.get('x-middleware-next'), '1');
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
  assert.equal(response.headers.get('link'), '</priroda/pozorovanie-vtakov.md>; rel="alternate"; type="text/markdown"');
  assert.equal(response.headers.get('vary'), 'Accept');
});

test('pages that are not guides pass through untouched', async () => {
  for (const path of ['/', '/priroda/', '/robots.txt', '/priroda/pozorovanie-vtakov.md', '/priroda/neexistuje/']) {
    const response = await call(path, 'text/markdown');
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
    assert.equal(response.headers.get('x-middleware-rewrite'), null, path);
    assert.equal(response.headers.get('link'), null, path);
  }
});
