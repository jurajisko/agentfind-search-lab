/**
 * Read-only reporting endpoint for the admin page.
 *
 * The service role key stays on the server: the browser never receives it and
 * never talks to Supabase directly. Access is a single shared password in
 * ADMIN_PASSWORD, which is enough for an internal tool and no more than that.
 *
 * Rows are aggregated here rather than in SQL so no further migration is
 * needed. That caps the window at ROW_LIMIT rows; the response says when the
 * cap was hit so a number is never silently wrong.
 */
import { guides, variantFor } from '../src/content.mjs';

const ROW_LIMIT = 10000;
const MAX_DAYS = 90;

const variantByPath = new Map(
  guides.map((guide, index) => [`/${guide.section}/${guide.slug}/`, variantFor(index)])
);

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorised(request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  return safeEqual(supplied, expected);
}

const agentLabel = row => row.crawler_name || (row.user_agent || '').slice(0, 60) || '(bez User-Agenta)';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey || !process.env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'not_configured' }), {
        status: 503, headers: { 'content-type': 'application/json' }
      });
    }
    if (!authorised(request)) {
      return new Response(JSON.stringify({ error: 'unauthorised' }), {
        status: 401, headers: { 'content-type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 7, 1), MAX_DAYS);
    const includeTests = url.searchParams.get('tests') === '1';
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const query = new URLSearchParams({
      select: 'event_type,path,crawler_name,agent_class,resource_kind,user_agent,referrer_origin,metadata,occurred_at',
      occurred_at: `gte.${since}`,
      order: 'occurred_at.desc',
      limit: String(ROW_LIMIT)
    });

    let rows;
    try {
      const result = await fetch(`${supabaseUrl}/rest/v1/search_lab_events?${query}`, {
        signal: AbortSignal.timeout(10000),
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      });
      if (!result.ok) {
        console.error('stats_read_failed', result.status);
        return new Response(JSON.stringify({ error: 'read_failed' }), {
          status: 502, headers: { 'content-type': 'application/json' }
        });
      }
      rows = await result.json();
    } catch {
      console.error('stats_read_unavailable');
      return new Response(JSON.stringify({ error: 'read_unavailable' }), {
        status: 502, headers: { 'content-type': 'application/json' }
      });
    }

    const all = Array.isArray(rows) ? rows : [];
    const isTest = row => String(row?.metadata?.is_test) === 'true';
    const used = includeTests ? all : all.filter(row => !isTest(row));
    const fetches = used.filter(row => row.event_type !== 'browser_pageview');
    const pageviews = used.filter(row => row.event_type === 'browser_pageview');

    // One row per agent identity, with the signals that say how it behaves.
    const agents = new Map();
    for (const row of fetches) {
      const key = `${agentLabel(row)}|${row.agent_class || 'unknown'}`;
      const entry = agents.get(key) || {
        agent: agentLabel(row),
        crawlerName: row.crawler_name,
        agentClass: row.agent_class || 'unknown',
        userAgent: row.user_agent || '',
        requests: 0,
        paths: new Set(),
        stylesheet: 0,
        robots: 0,
        sitemap: 0,
        firstSeen: row.occurred_at,
        lastSeen: row.occurred_at,
        kinds: new Set()
      };
      entry.requests++;
      entry.paths.add(row.path);
      entry.kinds.add(row.resource_kind || 'other');
      if (row.resource_kind === 'stylesheet') entry.stylesheet++;
      if (row.resource_kind === 'robots') entry.robots++;
      if (row.resource_kind === 'sitemap') entry.sitemap++;
      if (row.occurred_at < entry.firstSeen) entry.firstSeen = row.occurred_at;
      if (row.occurred_at > entry.lastSeen) entry.lastSeen = row.occurred_at;
      agents.set(key, entry);
    }

    const agentList = [...agents.values()]
      .map(entry => {
        const spanSeconds = Math.max(
          (new Date(entry.lastSeen) - new Date(entry.firstSeen)) / 1000, 0
        );
        return {
          agent: entry.agent,
          crawlerName: entry.crawlerName,
          agentClass: entry.agentClass,
          userAgent: entry.userAgent,
          requests: entry.requests,
          distinctPaths: entry.paths.size,
          stylesheet: entry.stylesheet,
          // No stylesheet request means the markup was taken without rendering.
          renders: entry.stylesheet > 0,
          readRobots: entry.robots > 0,
          readSitemap: entry.sitemap > 0,
          kinds: [...entry.kinds].sort(),
          firstSeen: entry.firstSeen,
          lastSeen: entry.lastSeen,
          // Requests per minute across the agent's own active window.
          burst: spanSeconds > 0 ? Number((entry.requests / (spanSeconds / 60)).toFixed(1)) : entry.requests
        };
      })
      .sort((a, b) => b.requests - a.requests);

    const tally = (list, key) => {
      const out = {};
      for (const row of list) out[row[key] || 'unknown'] = (out[row[key] || 'unknown'] || 0) + 1;
      return Object.entries(out).sort((a, b) => b[1] - a[1]);
    };

    // Which pages were fetched, and under which content variant.
    const pages = new Map();
    for (const row of fetches) {
      if (row.resource_kind !== 'guide') continue;
      const entry = pages.get(row.path) || {
        path: row.path,
        variant: variantByPath.get(row.path) || 'unknown',
        requests: 0,
        agents: new Set()
      };
      entry.requests++;
      entry.agents.add(agentLabel(row));
      pages.set(row.path, entry);
    }
    const pageList = [...pages.values()]
      .map(entry => ({ ...entry, agents: entry.agents.size }))
      .sort((a, b) => b.requests - a.requests);

    const variants = { structured: { pages: 0, requests: 0 }, baseline: { pages: 0, requests: 0 } };
    for (const page of pageList) {
      if (!variants[page.variant]) continue;
      variants[page.variant].pages++;
      variants[page.variant].requests += page.requests;
    }
    // Denominator: how many pages of each variant exist at all, so coverage is
    // readable as "fetched x of y", not as a bare count.
    const published = { structured: 0, baseline: 0 };
    for (const variant of variantByPath.values()) published[variant]++;

    const byHour = {};
    for (const row of fetches) {
      const hour = row.occurred_at.slice(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
    }

    return new Response(JSON.stringify({
      generatedAt: new Date().toISOString(),
      days,
      includeTests,
      truncated: all.length >= ROW_LIMIT,
      totals: {
        rowsRead: all.length,
        fetches: fetches.length,
        browserPageviews: pageviews.length,
        testRowsHidden: includeTests ? 0 : all.length - used.length,
        distinctAgents: agentList.length,
        namedCrawlers: agentList.filter(entry => entry.crawlerName).length,
        disguisedAsBrowser: agentList.filter(entry => !entry.crawlerName && entry.agentClass === 'browser_like').length,
        rendered: agentList.filter(entry => entry.renders).length
      },
      agentClasses: tally(fetches, 'agent_class'),
      resourceKinds: tally(fetches, 'resource_kind'),
      agents: agentList,
      pages: pageList.slice(0, 60),
      variants: {
        structured: { ...variants.structured, published: published.structured },
        baseline: { ...variants.baseline, published: published.baseline }
      },
      byHour: Object.entries(byHour).sort(),
      recent: fetches.slice(0, 60).map(row => ({
        occurredAt: row.occurred_at,
        path: row.path,
        kind: row.resource_kind,
        agent: agentLabel(row),
        agentClass: row.agent_class
      }))
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
};
