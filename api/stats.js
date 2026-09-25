/**
 * Read-only reporting endpoint for the admin page.
 *
 * The service role key stays on the server: the browser never receives it and
 * never talks to Supabase directly. Access is a single shared password in
 * ADMIN_PASSWORD, which is enough for an internal tool and no more than that.
 *
 * Classification and behaviour analysis live in src/behaviour.mjs and run at
 * read time, so better signatures reclassify past rows without a migration.
 * The window is capped at ROW_LIMIT rows; the response says when the cap was
 * hit so a number is never silently wrong.
 */
import { guides, variantFor } from '../src/content.mjs';
import { analyse } from '../src/behaviour.mjs';
import { agentsCsv, buildReport, renderReportDocument, renderReportHtml } from '../src/report.mjs';

// The readiness audit is computed at build time and published next to the
// admin page. Anything that does not look like an audit is ignored rather
// than trusted.
async function loadAudit(requestUrl) {
  try {
    const response = await fetch(new URL('/admin/audit.json', requestUrl), { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const audit = await response.json();
    return audit && Array.isArray(audit.checks) && Array.isArray(audit.stages) ? audit : null;
  } catch {
    return null;
  }
}

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

const json = (body, status) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey || !process.env.ADMIN_PASSWORD) return json({ error: 'not_configured' }, 503);
    if (!authorised(request)) return json({ error: 'unauthorised' }, 401);

    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 7, 1), MAX_DAYS);
    const includeTests = url.searchParams.get('tests') === '1';
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const query = new URLSearchParams({
      select: 'event_type,path,crawler_name,agent_class,resource_kind,user_agent,metadata,occurred_at',
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
        return json({ error: 'read_failed' }, 502);
      }
      rows = await result.json();
    } catch {
      console.error('stats_read_unavailable');
      return json({ error: 'read_unavailable' }, 502);
    }

    const all = Array.isArray(rows) ? rows : [];
    const isTest = row => String(row?.metadata?.is_test) === 'true';
    const used = includeTests ? all : all.filter(row => !isTest(row));
    const stats = analyse(used, { variantByPath });
    const generatedAt = new Date().toISOString();
    const audit = await loadAudit(request.url);
    const siteUrl = new URL(request.url).origin;
    const report = buildReport({ stats, audit, generatedAt, days, siteUrl });

    return json({
      generatedAt,
      days,
      includeTests,
      truncated: all.length >= ROW_LIMIT,
      rowsRead: all.length,
      testRowsHidden: includeTests ? 0 : all.length - used.length,
      ...stats,
      audit,
      report,
      reportHtml: renderReportHtml(report, { includeTitle: false }),
      reportDocument: renderReportDocument(report),
      agentsCsv: agentsCsv(stats)
    }, 200);
  }
};
