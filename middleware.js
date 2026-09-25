/**
 * Observes every request, not only known crawlers.
 *
 * A list of known user agents can only confirm what we already suspected, so
 * unrecognised agents are recorded too and classified afterwards. That is what
 * makes an unknown or newly launched AI fetcher visible at all.
 *
 * What can be derived later, per agent:
 *  - raw fetcher vs renderer: an agent that never requests styles.css only
 *    pulled the markup; assets are therefore matched, not excluded
 *  - JavaScript execution: middleware always fires, the client collector only
 *    fires when scripts run, so a path present here and missing from
 *    browser_pageview means the agent did not execute JavaScript
 *  - crawl breadth and burst rate: distinct paths over time
 *  - robots.txt and sitemap.xml compliance: whether they were fetched first
 *
 * Identification remains a User-Agent claim. It can be spoofed and is never
 * proof that the named agent made the request.
 */
const crawlerPatterns = [
  ['Googlebot', /googlebot/i],
  ['Google-Extended', /google-extended/i],
  ['GoogleOther', /googleother/i],
  ['Bingbot', /bingbot/i],
  ['OAI-SearchBot', /oai-searchbot/i],
  ['ChatGPT-User', /chatgpt-user/i],
  ['GPTBot', /gptbot/i],
  ['PerplexityBot', /perplexitybot/i],
  ['Perplexity-User', /perplexity-user/i],
  ['Claude-SearchBot', /claude-searchbot/i],
  ['Claude-User', /claude-user/i],
  ['ClaudeBot', /claudebot/i],
  ['Anthropic-AI', /anthropic-ai/i],
  ['Applebot-Extended', /applebot-extended/i],
  ['Applebot', /applebot/i],
  ['Amazonbot', /amazonbot/i],
  ['Meta-ExternalAgent', /meta-externalagent|meta-externalfetcher/i],
  ['Bytespider', /bytespider/i],
  ['YandexBot', /yandexbot/i],
  ['DuckDuckBot', /duckduckbot|duckassistbot/i],
  ['YouBot', /youbot/i],
  ['Cohere', /cohere-ai|cohere-training-data-crawler/i],
  ['Diffbot', /diffbot/i],
  ['Facebook preview', /facebookexternalhit|facebot/i],
  ['Twitterbot', /twitterbot/i],
  ['LinkedInBot', /linkedinbot/i],
  ['Slackbot', /slackbot/i]
];

// Generic markers of automation, used only when no named crawler matched.
const automationPattern = /bot\b|bot\/|crawler|spider|scraper|slurp|fetch|curl|wget|python|java|go-http|node|axios|okhttp|libwww|scrapy|headless|phantom|selenium|playwright|puppeteer|httpx|postman|insomnia/i;
const browserPattern = /(chrome|crios|safari|firefox|fxios|edg|opr|opera)\//i;

const resourceKinds = [
  ['robots', /^\/robots\.txt$/],
  ['sitemap', /^\/sitemap\.xml$/],
  // Alternate formats of the same guide. They must be matched before "guide",
  // whose pattern would otherwise swallow /section/slug.md as well.
  ['llms_txt', /^\/llms\.txt$/],
  ['llms_full', /^\/llms-full\.txt$/],
  ['guide_md', /^\/[^/]+\/[^/]+\.md$/],
  ['guide_json', /^\/[^/]+\/[^/]+\.json$/],
  ['manifest', /^\/site\.webmanifest$/],
  ['stylesheet', /\.css$/],
  ['icon', /\.(?:ico|png|svg|jpg|jpeg|webp|gif)$/],
  ['research', /^\/research\/?$/],
  ['home', /^\/$/],
  ['guide', /^\/[^/]+\/[^/]+\/?$/],
  ['section', /^\/[^/]+\/?$/]
];

export function crawlerFrom(userAgent) {
  return crawlerPatterns.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}

export function agentClassFrom(userAgent, crawlerName) {
  if (crawlerName) return 'known_crawler';
  if (!userAgent.trim()) return 'no_user_agent';
  if (automationPattern.test(userAgent)) return 'likely_automation';
  if (browserPattern.test(userAgent)) return 'browser_like';
  return 'unknown';
}

export function resourceKindFrom(pathname) {
  return resourceKinds.find(([, pattern]) => pattern.test(pathname))?.[0] ?? 'other';
}

export default async function middleware(request, event) {
  const userAgent = request.headers.get('user-agent') || '';
  const crawlerName = crawlerFrom(userAgent);
  const agentClass = agentClassFrom(userAgent, crawlerName);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey && ['GET', 'HEAD'].includes(request.method)) {
    const pathname = new URL(request.url).pathname.slice(0, 500);
    const payload = {
      // Known crawlers keep the original event type so existing reports and
      // the queries in docs/ keep working unchanged.
      event_type: crawlerName ? 'claimed_crawler_request' : 'observed_request',
      path: pathname,
      referrer_origin: null,
      crawler_name: crawlerName,
      agent_class: agentClass,
      resource_kind: resourceKindFrom(pathname),
      user_agent: userAgent.slice(0, 500),
      metadata: {
        source: 'vercel_middleware',
        verification: 'user_agent_claim_only',
        method: request.method,
        accept: (request.headers.get('accept') || '').slice(0, 200),
        // Present when the agent asked for compressed or ranged content; both
        // are hints about how it fetches rather than what it wants.
        accept_encoding: (request.headers.get('accept-encoding') || '').slice(0, 120),
        has_referer: Boolean(request.headers.get('referer')),
        is_test: request.headers.get('x-lab-test') === '1'
      }
    };

    const write = fetch(`${supabaseUrl}/rest/v1/search_lab_events`, {
      signal: AbortSignal.timeout(3000),
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).then(result => { if (!result.ok) console.error('observed_write_failed', result.status); })
      .catch(() => console.error('observed_write_unavailable'));
    if (event?.waitUntil) event.waitUntil(write); else await write;
  }

  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

// Assets stay in the matcher on purpose: whether an agent fetches the
// stylesheet is the signal that separates a renderer from a text scraper.
// Only the collector endpoint and Vercel internals are excluded.
export const config = {
  matcher: ['/((?!api/|_vercel/|admin).*)']
};
