const MAX_PATH_LENGTH = 500;
// Per-instance safeguard, not a distributed firewall. No IPs persisted.
const recent = new Map();

function normalizePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > MAX_PATH_LENGTH) return null;
  if (value.startsWith('//') || /[?#\\\s]/.test(value)) return null;
  return value;
}

function normalizeOrigin(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin) return new Response('Invalid origin', { status: 403 });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415 });

    let payload;
    try {
      const reader = request.body?.getReader();
      if (!reader) return new Response(null, { status: 400 });
      let size = 0, text = ''; const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); return new Response(null, { status: 413 }); }
        text += decoder.decode(value, { stream: true });
      }
      payload = JSON.parse(text + decoder.decode());
    } catch {
      return new Response('Invalid payload', { status: 400 });
    }

    const path = normalizePath(payload?.path);
    if (!path) return new Response('Invalid path', { status: 400 });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return new Response(null, { status: 503 });
    const now = Date.now();
    for (const [key, value] of recent) if (value.until <= now) recent.delete(key);
    const client = request.headers.get('x-vercel-forwarded-for') || 'unknown';
    const bucket = recent.get(client) || { count: 0, until: now + 60000, ids: new Set() };
    if (bucket.count >= 60 || recent.size >= 10000) return new Response(null, { status: 429 });
    if (payload.eventId && bucket.ids.has(payload.eventId)) return new Response(null, { status: 204 });
    bucket.count++; recent.set(client, bucket);

    const event = {
      event_type: 'browser_pageview',
      path,
      referrer_origin: normalizeOrigin(payload.referrerOrigin),
      crawler_name: null,
      user_agent: null,
      metadata: { source: 'first_party_script', is_test: request.headers.get('x-lab-test') === '1' }
    };

    try {
      const result = await fetch(`${supabaseUrl}/rest/v1/search_lab_events`, {
        signal: AbortSignal.timeout(4000),
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(event)
      });
      if (!result.ok) { console.error('telemetry_write_failed', result.status); return new Response(null, { status: 502 }); }
      if (typeof payload.eventId === 'string' && payload.eventId.length <= 64) bucket.ids.add(payload.eventId);
    } catch {
      console.error('telemetry_write_unavailable');
      return new Response(null, { status: 502 });
    }

    return new Response(null, { status: 204 });
  }
};
