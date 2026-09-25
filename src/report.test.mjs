import assert from 'node:assert/strict';
import test from 'node:test';
import { analyse, wilson } from './behaviour.mjs';
import { agentsCsv, buildReport, renderReportDocument, renderReportHtml } from './report.mjs';

const variantByPath = new Map([
  ['/a/one/', 'structured'], ['/a/two/', 'baseline'], ['/b/three/', 'structured'], ['/b/four/', 'baseline']
]);
const row = (at, path, ua, kind) => ({ event_type: 'observed_request', occurred_at: at, path, user_agent: ua, resource_kind: kind, metadata: {} });
const EVIL = '<script>alert(1)</script>';
const rows = [
  row('2026-09-20T10:00:00.000Z', '/robots.txt', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'robots'),
  row('2026-09-20T10:01:00.000Z', '/a/one/', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'guide'),
  row('2026-09-22T09:00:00.000Z', '/a/two/', 'Mozilla/5.0 (compatible; GPTBot/1.2)', 'guide'),
  // A browser-like agent that takes a page without CSS or JavaScript becomes a
  // hidden bot, so its attacker-controlled User-Agent lands in the report.
  row('2026-09-22T09:00:01.000Z', '/b/three/', `Mozilla/5.0 ${EVIL} Chrome/140.0 Safari/537.36`, 'guide')
];
const audit = {
  score: 80, counts: { ok: 3, warn: 1, fail: 1, test: 1 }, pages: 5,
  stages: [{ id: 'access', score: 90 }, { id: 'discovery', score: 60 }],
  checks: [
    { id: 'x', stage: 'access', status: 'fail', title: 'Zlá vec', result: 'Našli sme problém.', why: 'Lebo.', evidence: 'documented', weight: 2 },
    { id: 'y', stage: 'access', status: 'ok', title: 'Dobrá vec', result: 'OK.', why: 'Lebo.', evidence: 'measured', weight: 1 },
    { id: 'z', stage: 'formats', status: 'test', title: 'Skúšame', result: '—', why: '—', evidence: 'hypothesis', weight: 0 }
  ]
};
const stats = analyse(rows, { variantByPath });
const report = buildReport({ stats, audit, generatedAt: '2026-09-25T12:00:00.000Z', days: 30, siteUrl: 'https://lab.test' });

test('the Wilson interval widens for small samples and stays inside 0..1', () => {
  const small = wilson(1, 4), large = wilson(250, 1000);
  assert.ok(small.high - small.low > large.high - large.low);
  assert.ok(wilson(0, 25).low === 0 && wilson(25, 25).high === 1);
});

test('builds the day series and coverage per bot group', () => {
  assert.deepEqual(stats.timeline.map(t => t.day), ['2026-09-20', '2026-09-21', '2026-09-22']);
  assert.deepEqual(stats.timeline[1].counts, {}); // a quiet day is kept, not dropped
  const search = stats.coverage.find(c => c.id === 'search');
  assert.equal(search.byVariant.structured.fetched, 1);
  assert.equal(search.byVariant.structured.published, 2);
});

test('the summary is plain Slovak and states the missing important crawlers', () => {
  assert.ok(report.summary[0].startsWith('Pripravenosť webu: 80 zo 100 bodov.'));
  assert.ok(report.summary.some(s => s.includes('Zatiaľ neprišli:') && s.includes('Bingbot')));
  assert.ok(report.headline.length > 40);
});

test('draws no conclusion from too little data', () => {
  const experiment = report.sections.find(s => s.id === 'pokus-faq');
  experiment.table.rows.forEach(r => assert.equal(r[3], 'príliš málo údajov na záver'));
});

test('HTML is structured for screen readers and escapes attacker-controlled text', () => {
  const html = renderReportHtml(report, { includeTitle: false });
  assert.ok(!html.includes('<h1'), 'no second h1 inside a page');
  assert.ok(html.includes('<h2 id="zhrnutie">1. Zhrnutie</h2>'));
  assert.ok(html.includes('<caption>'));
  assert.ok(html.includes('scope="col"') && html.includes('scope="row"'));
  assert.ok(!html.includes(EVIL), 'raw script tag must never appear');
  assert.ok(html.includes('&lt;script&gt;'));
  // Status is spelled out, not left to colour.
  assert.ok(html.includes('Nesplnené: Zlá vec.'));
  assert.ok(html.includes('Istota: dokumentované prevádzkovateľmi.'));
});

test('the downloadable document is standalone and in Slovak', () => {
  const doc = renderReportDocument(report);
  assert.ok(doc.startsWith('<!doctype html>'));
  assert.ok(doc.includes('<html lang="sk">'));
  assert.ok(doc.includes('<h1 id="sprava">Správa o viditeľnosti webu pre vyhľadávače a AI</h1>'));
  assert.ok(!doc.includes(EVIL));
});

test('CSV opens in Excel with Slovak settings and quotes risky cells', () => {
  const csv = agentsCsv(stats);
  assert.ok(csv.startsWith('﻿Agent;Druh;'));
  const line = csv.split('\r\n').find(l => l.includes('Mozilla/5.0 <script>'));
  assert.ok(line, 'user agent is present as text');
  const quoted = agentsCsv({ agents: [{ named: true, name: 'a;b', category: 'x', requests: 1, pages: 0, distinctPaths: 1, key: 'k"q' }] }).split('\r\n')[1];
  assert.ok(quoted.startsWith('"a;b";'));
  assert.ok(quoted.endsWith(';"k""q"'));
});
