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

export default async function middleware(request, event) {
  const userAgent = request.headers.get('user-agent') || '';
  const crawlerName = crawlerFrom(userAgent);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (crawlerName && supabaseUrl && serviceKey && ['GET','HEAD'].includes(request.method)) {
    const payload = {
      event_type: 'claimed_crawler_request',
      path: new URL(request.url).pathname.slice(0, 500),
      referrer_origin: null,
      crawler_name: crawlerName,
      user_agent: userAgent.slice(0, 500),
      metadata: { source: 'vercel_middleware', verification: 'user_agent_claim_only', method: request.method, is_test: request.headers.get('x-lab-test') === '1' }
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
    }).then(result => { if (!result.ok) console.error('crawler_write_failed', result.status); })
      .catch(() => console.error('crawler_write_unavailable'));
    if (event?.waitUntil) event.waitUntil(write); else await write;
  }
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

export const config = {
  matcher: ['/((?!api/|_vercel/|favicon.ico|styles.css|site.webmanifest).*)']
};
