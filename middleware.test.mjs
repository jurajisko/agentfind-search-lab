import assert from 'node:assert/strict';
import test from 'node:test';
import { agentClassFrom, crawlerFrom, resourceKindFrom } from './middleware.js';

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
