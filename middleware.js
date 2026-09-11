const crawlerPatterns = [
  ['Googlebot', /googlebot/i],
  ['Bingbot', /bingbot/i],
  ['OAI-SearchBot', /oai-searchbot/i],
  ['ChatGPT-User', /chatgpt-user/i],
  ['GPTBot', /gptbot/i],
  ['PerplexityBot', /perplexitybot/i],
  ['Claude-SearchBot', /claude-searchbot/i],
  ['ClaudeBot', /claudebot/i],
  ['Facebook preview', /facebookexternalhit|facebot/i]
];

function crawlerFrom(userAgent) {
  return crawlerPatterns.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}

export default function middleware(request, event) {
  const userAgent = request.headers.get('user-agent') || '';
  const crawlerName = crawlerFrom(userAgent);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (crawlerName && supabaseUrl && serviceKey) {
    const payload = {
      event_type: 'claimed_crawler_request',
      path: request.nextUrl.pathname,
      referrer_origin: null,
      crawler_name: crawlerName,
      user_agent: userAgent.slice(0, 500),
      metadata: { source: 'vercel_middleware', verification: 'user_agent_claim_only' }
    };

    event.waitUntil(fetch(`${supabaseUrl}/rest/v1/search_lab_events`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).catch(() => undefined));
  }
}

export const config = {
  matcher: ['/((?!api|_vercel|favicon.ico|robots.txt|sitemap.xml|styles.css|site.webmanifest).*)']
};
