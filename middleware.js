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
 *
 * It also negotiates the format of a guide: an agent whose Accept header
 * prefers text/markdown gets the guide's Markdown at the guide's own URL, so
 * it no longer has to find the .md link first. Everyone else gets the HTML,
 * with the Markdown advertised in a Link header.
 *
 * The claim is then checked against the IP ranges the operators publish
 * (src/verify.mjs). Only the outcome is stored, never the address. The check
 * runs after the response is sent, so it never slows a page down.
 */
import { guides } from './src/content.mjs';
import { RANGE_SOURCES, clientIp, ipFacts, loadRanges } from './src/verify.mjs';

const guidePaths = new Set(guides.map(guide => `/${guide.section}/${guide.slug}`));

// Ranges stay in memory per instance. A partial load is retried sooner, so a
// briefly unreachable list does not leave its crawlers unverified for hours.
const RANGES_TTL_MS = 6 * 3600 * 1000;
const RANGES_RETRY_MS = 5 * 60 * 1000;
let rangeCache = null;
function ranges() {
  if (!rangeCache || Date.now() > rangeCache.expires) {
    const entry = { expires: Infinity };
    entry.promise = loadRanges(fetch).then(index => {
      const complete = index.size === Object.keys(RANGE_SOURCES).length;
      entry.expires = Date.now() + (complete ? RANGES_TTL_MS : RANGES_RETRY_MS);
      return index;
    });
    rangeCache = entry;
  }
  return rangeCache.promise;
}

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
  ['CCBot', /ccbot/i],
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
  // IndexNow key file: an engine fetches it to check a submission is ours.
  ['indexnow_key', /^\/[0-9a-f]{32}\.txt$/],
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

/** The guide's path without the trailing slash, or null when it is not a guide. */
export function guideBase(pathname) {
  const base = pathname.replace(/\/$/, '');
  return guidePaths.has(base) ? base : null;
}

/**
 * True when the Accept header ranks Markdown at least as high as HTML. A tie
 * goes to Markdown: nobody lists text/markdown by accident, while browsers and
 * plain fetchers never list it at all.
 */
export function prefersMarkdown(accept) {
  const quality = new Map();
  for (const part of (accept || '').toLowerCase().split(',')) {
    const [type, ...params] = part.split(';').map(item => item.trim());
    if (!type) continue;
    const q = params.find(param => param.startsWith('q='));
    const value = q ? Number(q.slice(2)) : 1;
    quality.set(type, Number.isFinite(value) ? value : 0);
  }
  const markdown = Math.max(quality.get('text/markdown') ?? 0, quality.get('text/x-markdown') ?? 0);
  const html = quality.get('text/html') ?? quality.get('text/*') ?? quality.get('*/*') ?? 0;
  return markdown > 0 && markdown >= html;
}

export default async function middleware(request, event) {
  const userAgent = request.headers.get('user-agent') || '';
  const crawlerName = crawlerFrom(userAgent);
  const agentClass = agentClassFrom(userAgent, crawlerName);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accept = request.headers.get('accept') || '';
  const fullPath = new URL(request.url).pathname;
  const guide = guideBase(fullPath);
  const negotiated = Boolean(guide) && prefersMarkdown(accept);

  if (supabaseUrl && serviceKey && ['GET', 'HEAD'].includes(request.method)) {
    const pathname = fullPath.slice(0, 500);
    const payload = {
      // Known crawlers keep the original event type so existing reports and
      // the queries in docs/ keep working unchanged.
      event_type: crawlerName ? 'claimed_crawler_request' : 'observed_request',
      path: pathname,
      referrer_origin: null,
      crawler_name: crawlerName,
      agent_class: agentClass,
      // What the agent received, not what the path looks like: a negotiated
      // request counts as taking the Markdown in the format statistics.
      resource_kind: negotiated ? 'guide_md' : resourceKindFrom(pathname),
      user_agent: userAgent.slice(0, 500),
      metadata: {
        source: 'vercel_middleware',
        verification: 'user_agent_claim_only',
        method: request.method,
        accept: accept.slice(0, 200),
        // True when the Markdown was served at the HTML address because of
        // the Accept header, so this route stays separable from the .md link.
        negotiated_markdown: negotiated,
        // Present when the agent asked for compressed or ranged content; both
        // are hints about how it fetches rather than what it wants.
        accept_encoding: (request.headers.get('accept-encoding') || '').slice(0, 120),
        has_referer: Boolean(request.headers.get('referer')),
        // Web Bot Auth: the agent names the key directory its request is
        // signed with. Recorded, not verified.
        signature_agent: (request.headers.get('signature-agent') || '').replace(/"/g, '').trim().slice(0, 120) || null,
        is_test: request.headers.get('x-lab-test') === '1'
      }
    };
    const ip = clientIp(request.headers);

    const write = (async () => {
      const index = await ranges().catch(() => null);
      Object.assign(payload.metadata, ipFacts({ crawlerName, userAgent, ip, index }));
      const result = await fetch(`${supabaseUrl}/rest/v1/search_lab_events`, {
        signal: AbortSignal.timeout(3000),
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
      if (!result.ok) console.error('observed_write_failed', result.status);
    })().catch(() => console.error('observed_write_unavailable'));
    if (event?.waitUntil) event.waitUntil(write); else await write;
  }

  if (!guide) return new Response(null, { headers: { 'x-middleware-next': '1' } });

  // Vary: the same URL now answers with two formats, so no cache may hand the
  // Markdown to a browser or the HTML to an agent that asked for Markdown.
  // The vercel.json rule that adds noindex to *.md matches the requested path,
  // not the rewritten one, so the HTML address must not receive noindex here.
  // Check after a deploy: curl -sI -H 'Accept: text/markdown' <guide URL>.
  const markdown = `${guide}.md`;
  if (negotiated) {
    return new Response(null, {
      headers: {
        'x-middleware-rewrite': new URL(markdown, request.url).toString(),
        'Content-Type': 'text/markdown; charset=utf-8',
        Vary: 'Accept'
      }
    });
  }
  return new Response(null, {
    headers: {
      'x-middleware-next': '1',
      Vary: 'Accept',
      Link: `<${markdown}>; rel="alternate"; type="text/markdown"`
    }
  });
}

// Assets stay in the matcher on purpose: whether an agent fetches the
// stylesheet is the signal that separates a renderer from a text scraper.
// Only the collector endpoint and Vercel internals are excluded.
export const config = {
  matcher: ['/((?!api/|_vercel/|admin).*)']
};
