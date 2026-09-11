const MAX_PATH_LENGTH = 500;

function normalizePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > MAX_PATH_LENGTH) return null;
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
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) return new Response('Invalid origin', { status: 403 });

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response('Invalid payload', { status: 400 });
    }

    const path = normalizePath(payload.path);
    if (!path) return new Response('Invalid path', { status: 400 });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return new Response(null, { status: 204 });

    const event = {
      event_type: 'human_pageview',
      path,
      referrer_origin: normalizeOrigin(payload.referrerOrigin),
      crawler_name: null,
      user_agent: null,
      metadata: { source: 'first_party_script' }
    };

    try {
      await fetch(`${supabaseUrl}/rest/v1/search_lab_events`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(event)
      });
    } catch {
      // Analytics must never affect the visitor's page load.
    }

    return new Response(null, { status: 204 });
  }
};
