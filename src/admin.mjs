/**
 * Internal reporting page. Never linked from the site and marked noindex.
 *
 * The page holds no credentials of its own: the password is typed by the
 * operator, kept in sessionStorage for the tab, and sent to /api/stats, which
 * is the only place that can reach Supabase.
 *
 * Every string that comes from the data (User-Agents, paths) is attacker
 * controlled — anyone can send any User-Agent — so everything is escaped and
 * rows are addressed by array index, never by embedding the value in markup.
 *
 * The inline script avoids template literals and backslash escapes on purpose:
 * it lives inside this module's template literal.
 */
export function renderAdmin() {
  return `<!doctype html>
<html lang="sk">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Search Lab — agenti</title>
    <script>
      try { if (localStorage.getItem('searchlab_admin_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}
    </script>
    <style>
      /* Light is the default on purpose and does not follow the OS setting;
         dark only comes on through the toggle. Palette follows analyza_logov. */
      :root { color-scheme: light;
        --plane:#f9f9f7; --surface:#fcfcfb; --surface-2:#f2f2ee;
        --ink:#0b0b0b; --ink-2:#52514e; --muted:#898781;
        --grid:#e1e0d9; --axis:#c3c2b7; --border:rgba(11,11,11,.10);
        --accent:#2a78d6; --ok:#0b8a0b; --warn:#9a6400; --bad:#d03b3b; --warn-dot:#fab219;
        --c-search:#2a78d6; --c-ai:#1baf7a; --c-hidden:#d03b3b; --c-tool:#eb6834; --c-browser:#b5b4ab; --c-seo:#8a5cd1; --c-social:#d6609e; --c-monitor:#1a9fb0; --c-generic:#fab219; --c-scan:#8f1f1f; --c-feed:#86b6ef;
        --p-training:#8a5cd1; --p-ai_search:#2a78d6; --p-user_fetch:#1a9fb0; --p-mixed:#898781; }
      :root[data-theme="dark"] { color-scheme: dark;
        --plane:#0d0d0d; --surface:#1a1a19; --surface-2:#222221;
        --ink:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
        --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10);
        --accent:#3987e5; --ok:#3fbf5a; --warn:#fab219; --bad:#ef6a6a; --warn-dot:#fab219;
        --c-search:#3987e5; --c-ai:#199e70; --c-hidden:#ef6a6a; --c-tool:#d95926; --c-browser:#6b6a64; --c-seo:#a27de0; --c-social:#e07ab0; --c-monitor:#2bb3c4; --c-generic:#fab219; --c-scan:#b33a3a; --c-feed:#5f93d4;
        --p-training:#a27de0; --p-ai_search:#3987e5; --p-user_fetch:#2bb3c4; --p-mixed:#898781; }
      * { box-sizing:border-box; }
      html, body { margin:0; padding:0; }
      body { background:var(--plane); color:var(--ink); font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
      .wrap { max-width:1280px; margin:0 auto; padding:24px 16px 64px; }
      header.top { display:flex; align-items:flex-start; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
      header.top .grow { flex:1 1 320px; min-width:0; }
      .eyebrow { font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); font-weight:600; }
      h1 { font-size:22px; margin:2px 0 2px; letter-spacing:-.01em; }
      h2 { font-size:15px; margin:0 0 4px; letter-spacing:-.005em; }
      h3 { font-size:13px; margin:20px 0 8px; color:var(--ink-2); text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
      p.sub, .muted { color:var(--ink-2); }
      p.sub { margin:0; font-size:13px; }
      .panel { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:18px 20px; margin-bottom:16px; }
      .panel > p.muted { margin:0 0 14px; font-size:13px; }
      .controls { display:flex; gap:10px; flex-wrap:wrap; align-items:end; }
      label { display:block; font-size:11.5px; color:var(--muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:.05em; font-weight:600; }
      input, select, button { font:inherit; font-size:13px; padding:7px 10px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--ink); min-width:0; }
      input:focus, select:focus { outline:2px solid var(--accent); outline-offset:-1px; }
      button { cursor:pointer; padding:7px 12px; }
      button:hover { background:var(--surface-2); }
      button.primary { background:var(--accent); border-color:transparent; color:#fff; font-weight:600; }
      button.primary:hover { background:var(--accent); opacity:.9; }
      .tabs { display:flex; gap:2px; border-bottom:1px solid var(--border); margin:6px 0 20px; overflow-x:auto; }
      .tabs button { background:none; border:0; border-bottom:2px solid transparent; border-radius:0; color:var(--ink-2); font-size:13.5px; padding:9px 14px; white-space:nowrap; }
      .tabs button:hover { color:var(--ink); background:none; }
      .tabs button[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--accent); font-weight:600; }
      .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(168px,1fr)); gap:12px; }
      .tile { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:14px 16px; }
      .tile span { display:block; font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
      .tile b { display:block; font-size:27px; font-weight:600; letter-spacing:-.02em; line-height:1.1; margin-top:4px; font-variant-numeric:tabular-nums; }
      .tile.alert b { color:var(--bad); }
      .grid2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th, td { text-align:left; padding:8px 10px; vertical-align:top; }
      th { color:var(--muted); font-weight:600; font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; border-bottom:1px solid var(--border); }
      td { border-bottom:1px solid var(--grid); }
      td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
      td:first-child { min-width:220px; }
      tbody tr:hover td { background:var(--surface-2); }
      tr.click { cursor:pointer; }
      .scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      /* Color is only a hint: the tag text always carries the meaning. */
      .tag { display:inline-flex; align-items:center; gap:5px; padding:1.5px 8px 1.5px 7px; border-radius:999px; font-size:11px; font-weight:600; white-space:nowrap; margin:2px 4px 2px 0;
        border:1px solid var(--border); background:var(--surface-2); color:var(--ink-2); }
      .tag::before { content:""; width:6px; height:6px; border-radius:50%; flex:none; background:var(--tc, var(--muted)); }
      .tag.ok { --tc:var(--ok); color:var(--ok); }
      .tag.warn { --tc:var(--warn-dot); color:var(--warn); }
      .tag.bad { --tc:var(--bad); color:var(--bad); border-color:var(--bad); }
      .tag.muted { color:var(--muted); }
      .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; vertical-align:middle; }
      code, .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; word-break:break-all; }
      .ua { color:var(--muted); display:block; margin-top:2px; }
      .bar { height:8px; background:var(--surface-2); border-radius:4px; overflow:hidden; display:flex; margin-bottom:10px; }
      .bar i { display:block; height:100%; }
      .legend { display:flex; flex-wrap:wrap; gap:16px; font-size:12.5px; color:var(--ink-2); margin-top:8px; }
      .hours { display:flex; align-items:flex-end; height:120px; margin-top:8px; border-bottom:1px solid var(--axis); }
      .hours .col { flex:1 1 0; min-width:1px; max-width:28px; display:flex; flex-direction:column-reverse; }
      .hours .col i { display:block; width:100%; }
      .hours .col i:last-child { border-radius:2px 2px 0 0; }
      .purpose { border-left:4px solid var(--axis); background:var(--plane); }
      .score { font-weight:700; font-variant-numeric:tabular-nums; }
      .note { color:var(--muted); font-size:12.5px; margin:10px 0 0; }
      .error { color:var(--bad); }
      .empty { color:var(--muted); padding:12px 0; margin:0; }
      .ovl { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:50; }
      .drawer { position:fixed; inset:0 0 0 auto; width:min(760px,100%); background:var(--plane); border-left:1px solid var(--border); overflow-y:auto; padding:22px 22px 60px; z-index:51; }
      .drawer .close { float:right; }
      .kv { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; margin:12px 0; }
      .kv div { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 12px; }
      .kv b { display:block; font-size:18px; font-weight:600; font-variant-numeric:tabular-nums; }
      .kv span { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
      .sig { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 12px; margin-bottom:6px; }
      .sig b { margin-right:6px; }
      [hidden] { display:none !important; }
      @media (max-width:640px) {
        .wrap { padding:16px 16px 48px; }
        .tile b { font-size:23px; }
        .drawer { padding:18px 16px 48px; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="top">
        <div class="grow">
          <div class="eyebrow">AgentFind Search Lab</div>
          <h1>Kto si co stiahol</h1>
          <p class="sub">Identita je tvrdenie v User-Agent, nie overenie. Signaly su dokazy, nie istota.</p>
        </div>
        <button id="theme" type="button">Tmavy / svetly</button>
      </header>

      <form id="login" class="panel" style="max-width:380px">
        <label for="password">Heslo</label>
        <input id="password" type="password" autocomplete="current-password" style="width:100%">
        <p id="loginError" class="note error" hidden></p>
        <p style="margin:12px 0 0"><button class="primary" type="submit">Prihlasit</button></p>
      </form>

      <div id="app" hidden>
        <div class="panel controls">
          <div>
            <label for="days">Obdobie</label>
            <select id="days">
              <option value="1">24 hodin</option>
              <option value="7">7 dni</option>
              <option value="30" selected>30 dni</option>
              <option value="90">90 dni</option>
            </select>
          </div>
          <div>
            <label for="tests">Testy</label>
            <select id="tests">
              <option value="0" selected>skryt</option>
              <option value="1">zobrazit</option>
            </select>
          </div>
          <button id="reload" class="primary" type="button">Obnovit</button>
          <button id="logout" type="button">Odhlasit</button>
          <p id="status" class="note" style="margin:0 0 8px auto"></p>
        </div>

        <nav class="tabs" role="tablist" id="tabs">
          <button role="tab" data-tab="overview" aria-selected="true">Prehlad</button>
          <button role="tab" data-tab="agents">Agenti</button>
          <button role="tab" data-tab="ai">AI podla ucelu</button>
          <button role="tab" data-tab="hidden">Skryti boti</button>
          <button role="tab" data-tab="expected">Kto neprisiel</button>
          <button role="tab" data-tab="content">Obsah</button>
          <button role="tab" data-tab="events">Udalosti</button>
        </nav>

        <div id="view"></div>
      </div>
    </div>

    <div id="ovl" class="ovl" hidden></div>
    <aside id="drawer" class="drawer" hidden aria-label="Detail agenta"></aside>

    <script>
      (function () {
        var KEY = 'searchlab_admin';
        var DATA = null;
        var TAB = 'overview';
        var FILTER = { category: '', q: '' };
        var CAT = {
          search:'Vyhladavac', ai:'AI', hidden:'Skryty bot', tool:'Skript / kniznica', browser:'Prehliadac',
          seo:'SEO nastroj', social:'Socialna siet', monitor:'Monitoring', generic:'Neznamy bot', scan:'Skener', feed:'RSS'
        };
        var PURPOSE = { training:'Uci sa', ai_search:'Index pre AI vyhladavanie', user_fetch:'Na ziadost pouzivatela', mixed:'Zmiesany ucel' };

        function el(id) { return document.getElementById(id); }
        function esc(v) {
          return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        }
        function num(v) { return Number(v || 0).toLocaleString('sk-SK'); }
        function time(v) {
          if (!v) return '-';
          return new Date(v).toLocaleString('sk-SK', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
        }
        function catColor(c) { return 'var(--c-' + (CAT[c] ? c : 'generic') + ')'; }
        function catTag(c) { return '<span class="tag" style="--tc:' + catColor(c) + '">' + esc(CAT[c] || c) + '</span>'; }
        function purposeTag(p) { return p ? '<span class="tag" style="--tc:var(--p-' + esc(p) + ')">' + esc(PURPOSE[p] || p) + '</span>' : ''; }
        function yes(v, good) { return v ? '<span class="tag ' + (good ? 'ok' : 'warn') + '">ano</span>' : '<span class="tag muted">nie</span>'; }
        function token() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
        function setToken(v) { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {} }
        function tile(value, label, alert) { return '<div class="tile' + (alert ? ' alert' : '') + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>'; }
        function panel(title, intro, body) {
          return '<section class="panel"><h2>' + esc(title) + '</h2>' + (intro ? '<p class="muted">' + intro + '</p>' : '') + body + '</section>';
        }
        function table(head, rows, empty) {
          if (!rows.length) return '<p class="empty">' + esc(empty || 'Ziadne data za toto obdobie.') + '</p>';
          return '<div class="scroll"><table><thead><tr>' + head.map(function (h) {
            return '<th' + (h.charAt(0) === '#' ? ' class="num"' : '') + '>' + esc(h.charAt(0) === '#' ? h.slice(1) : h) + '</th>';
          }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
        }
        function agentIndex(key) {
          for (var i = 0; i < DATA.agents.length; i++) if (DATA.agents[i].key === key) return i;
          return -1;
        }

        /* ---------- tabs ---------- */
        function overview() {
          var t = DATA.totals;
          var html = '<div class="tiles" style="margin-bottom:16px">' +
            tile(num(t.fetches), 'stiahnuti') +
            tile(num(t.agents), 'roznych agentov') +
            tile(num(t.ai), 'AI agentov') +
            tile(num(t.hidden), 'skrytych botov', t.hidden > 0) +
            tile(num(t.suspect), 'podozrivych') +
            tile(num(t.rendered), 'renderovalo (CSS)') +
            tile(num(t.readRobots), 'citalo robots.txt') +
            tile(num(t.expectedMissing), 'dolezitych neprislo', t.expectedMissing > 0) +
          '</div>';

          var totalReq = DATA.categories.reduce(function (s, c) { return s + c.requests; }, 0) || 1;
          var bar = '<div class="bar" style="height:14px">' + DATA.categories.map(function (c) {
            return '<i title="' + esc(c.label) + '" style="width:' + (c.requests / totalReq * 100) + '%;background:' + catColor(c.id) + '"></i>';
          }).join('') + '</div>';
          var rows = DATA.categories.map(function (c) {
            return '<tr><td><span class="dot" style="background:' + catColor(c.id) + '"></span>' + esc(c.label) + '<span class="ua">' + esc(c.desc) + '</span></td>' +
              '<td class="num">' + num(c.agents) + '</td><td class="num">' + num(c.requests) + '</td>' +
              '<td class="num">' + Math.round(c.requests / totalReq * 100) + ' %</td></tr>';
          });
          html += panel('Kto chodi', 'Podiel poziadaviek podla druhu agenta.', bar + table(['Druh', '#Agentov', '#Poziadaviek', '#Podiel'], rows));

          html += panel('AI podla ucelu', 'Pre firmu je rozdiel, ci AI obsah berie na trenovanie, alebo ho pouziva na odpovede.',
            '<div class="grid2">' + DATA.purposes.map(purposeCard).join('') + '</div>');

          html += panel('Po hodinach', 'Kazdy stlpec je jedna hodina, farba je druh agenta.', hourly());
          return html;
        }

        function purposeCard(p) {
          return '<div class="panel purpose" style="margin:0;border-left-color:var(--p-' + esc(p.id) + ')">' +
            '<h3 style="margin-top:0">' + esc(p.label) + '</h3><p class="muted" style="margin:0 0 8px;font-size:12px">' + esc(p.desc) + '</p>' +
            '<b style="font-size:22px">' + num(p.requests) + '</b> <span class="muted">poziadaviek, ' + num(p.agents) + ' agentov</span>' +
            (p.names.length ? '<p style="margin:8px 0 0">' + p.names.map(function (n) { return '<span class="tag muted">' + esc(n) + '</span>'; }).join('') + '</p>' : '<p class="note">Zatial nikto.</p>') +
          '</div>';
        }

        /* Hours without traffic are missing from the data. Fill them in, or a
           quiet week collapses to nothing and one busy hour fills the chart. */
        function fillHours(list, empty) {
          if (!list.length) return list;
          var seen = {};
          list.forEach(function (h) { seen[h[0]] = h[1]; });
          var start = Date.parse(list[0][0] + ':00:00Z');
          var end = Date.parse(list[list.length - 1][0] + ':00:00Z');
          var out = [];
          for (var t = start; t <= end && out.length < 2400; t += 3600000) {
            var k = new Date(t).toISOString().slice(0, 13);
            out.push([k, seen[k] !== undefined ? seen[k] : empty()]);
          }
          return out;
        }
        function gapFor(n) { return n > 200 ? 0 : (n > 80 ? 1 : 2); }

        function hourly() {
          var hours = fillHours(DATA.hourly, function () { return {}; });
          if (!hours.length) return '<p class="empty">Ziadne data.</p>';
          var max = 1;
          hours.forEach(function (h) { var s = 0; for (var k in h[1]) s += h[1][k]; if (s > max) max = s; });
          var cats = Object.keys(CAT);
          var cols = hours.map(function (h) {
            var parts = cats.filter(function (c) { return h[1][c]; }).map(function (c) {
              return '<i style="height:' + (h[1][c] / max * 110) + 'px;background:' + catColor(c) + '"></i>';
            }).join('');
            var total = 0; for (var k in h[1]) total += h[1][k];
            return '<div class="col" title="' + esc(h[0].replace('T', ' ') + ':00 UTC, ' + total + ' poziadaviek') + '">' + parts + '</div>';
          }).join('');
          var legend = '<div class="legend">' + cats.map(function (c) {
            return '<span><span class="dot" style="background:' + catColor(c) + '"></span>' + esc(CAT[c]) + '</span>';
          }).join('') + '</div>';
          return '<div class="hours" style="gap:' + gapFor(hours.length) + 'px">' + cols + '</div><p class="note">' + esc(hours[0][0].replace('T', ' ')) + ':00 az ' + esc(hours[hours.length - 1][0].replace('T', ' ')) + ':00 UTC</p>' + legend;
        }

        function agents() {
          var q = FILTER.q.toLowerCase();
          var list = DATA.agents.filter(function (a) {
            if (FILTER.category && a.category !== FILTER.category) return false;
            if (q && (a.name + ' ' + a.key).toLowerCase().indexOf(q) < 0) return false;
            return true;
          });
          var opts = '<option value="">vsetky</option>' + Object.keys(CAT).map(function (c) {
            return '<option value="' + c + '"' + (FILTER.category === c ? ' selected' : '') + '>' + esc(CAT[c]) + '</option>';
          }).join('');
          var controls = '<div class="controls" style="margin-bottom:12px"><div><label for="fcat">Druh</label><select id="fcat">' + opts + '</select></div>' +
            '<div style="flex:1;min-width:180px"><label for="fq">Hladat</label><input id="fq" style="width:100%" value="' + esc(FILTER.q) + '" placeholder="meno alebo User-Agent"></div></div>';
          var rows = list.map(function (a) {
            var i = DATA.agents.indexOf(a);
            return '<tr class="click" data-i="' + i + '"><td>' + esc(a.named ? a.name : (a.category === 'hidden' ? 'Skryty bot' : 'Nepredstavil sa')) +
              '<span class="ua mono">' + esc(a.key) + '</span></td>' +
              '<td>' + catTag(a.category) + purposeTag(a.purpose) + (a.suspect ? '<span class="tag warn">podozrivy</span>' : '') + '</td>' +
              '<td class="num">' + num(a.requests) + '</td><td class="num">' + num(a.distinctPaths) + '</td>' +
              '<td>' + (a.renders ? '<span class="tag ok">renderuje</span>' : '<span class="tag warn">iba text</span>') + '</td>' +
              '<td>' + (a.pages ? (a.ranJs ? '<span class="tag ok">' + a.ranJs + '/' + a.pages + '</span>' : '<span class="tag warn">nie</span>') : '<span class="tag muted">-</span>') + '</td>' +
              '<td>' + yes(a.readRobots, true) + '</td>' +
              '<td class="num">' + num(a.maxPerMinute) + '</td>' +
              '<td>' + esc(time(a.lastSeen)) + '</td></tr>';
          });
          return panel('Agenti', 'Klikni na riadok pre detail. "Iba text" = nikdy si nestiahol CSS, stranku nerenderoval.',
            controls + table(['Agent', 'Druh a ucel', '#Poziadaviek', '#Stranok', 'Render', 'JavaScript', 'robots.txt', '#Max/min', 'Naposledy'], rows, 'Nic nezodpoveda filtru.'));
        }

        function ai() {
          var html = '<div class="grid2" style="margin-bottom:16px">' + DATA.purposes.map(purposeCard).join('') + '</div>';
          var list = DATA.agents.filter(function (a) { return a.category === 'ai'; });
          var rows = list.map(function (a) {
            return '<tr class="click" data-i="' + DATA.agents.indexOf(a) + '"><td>' + esc(a.name) + '<span class="ua mono">' + esc(a.key) + '</span></td>' +
              '<td>' + purposeTag(a.purpose) + '</td><td class="num">' + num(a.requests) + '</td><td class="num">' + num(a.distinctPaths) + '</td>' +
              '<td>' + (a.renders ? '<span class="tag ok">ano</span>' : '<span class="tag warn">nie</span>') + '</td>' +
              '<td>' + yes(a.readRobots, true) + '</td><td>' + esc(a.role ? a.role.why : '') + '</td></tr>';
          });
          html += panel('AI agenti, ktori sa predstavili',
            'Pozor: vacsina AI asistentov sa v nasich testoch nepredstavila. ChatGPT prisiel ako curl, Grok ako Mac prehliadac. Tych najdes v kartach Agenti a Skryti boti.',
            table(['Agent', 'Ucel', '#Poziadaviek', '#Stranok', 'Render', 'robots.txt', 'Co znamena'], rows, 'Zatial neprisiel ziadny AI agent, ktory by sa predstavil.'));
          return html;
        }

        function hidden() {
          var list = DATA.agents.filter(function (a) { return a.category === 'hidden' || a.suspect; });
          var rows = list.map(function (a) {
            return '<tr class="click" data-i="' + DATA.agents.indexOf(a) + '"><td><span class="mono">' + esc(a.key) + '</span></td>' +
              '<td><span class="score" style="color:' + (a.category === 'hidden' ? 'var(--bad)' : 'var(--warn)') + '">' + a.score + '</span>/100</td>' +
              '<td>' + a.signals.filter(function (s) { return s.points > 0; }).map(function (s) { return '<span class="tag warn">' + esc(s.label) + '</span>'; }).join('') + '</td>' +
              '<td class="num">' + num(a.requests) + '</td><td>' + esc(time(a.lastSeen)) + '</td></tr>';
          });
          var html = panel('Tvaria sa ako prehliadac, spravaju sa ako stroj',
            'Skore od 30 = skryty bot, 15 az 29 = podozrivy. Kliknutim uvidis, preco.',
            table(['User-Agent', 'Skore', 'Signaly', '#Poziadaviek', 'Naposledy'], rows, 'Ziadny skryty bot v tomto obdobi.'));

          var crows = DATA.clusters.map(function (c) {
            return '<tr><td>' + esc(time(c.at)) + '</td><td><span class="mono">' + esc(c.path) + '</span></td>' +
              '<td class="num">' + num(c.requests) + '</td><td class="num">' + num(c.spanMs) + ' ms</td>' +
              '<td>' + c.userAgents.map(function (u) { return '<span class="ua mono">' + esc(u) + '</span>'; }).join('') + '</td></tr>';
          });
          html += panel('Viac identit naraz',
            'Rozne identity prehliadaca na tej istej stranke v priebehu 3 sekund. IP neukladame, takze agenta, ktory meni User-Agent, spoznavame takto.',
            table(['Cas', 'Stranka', '#Poziadaviek', '#Trvanie', 'Identity'], crows, 'Ziadna taka skupina.'));

          var sig = DATA.signals;
          html += panel('Ako sa skore pocita', '', Object.keys(sig).map(function (k) {
            var s = sig[k];
            return '<div class="sig"><b style="color:' + (s.points < 0 ? 'var(--ok)' : 'var(--warn)') + '">' + (s.points > 0 ? '+' : '') + s.points + '</b><b>' + esc(s.label) + '</b><span class="muted">' + esc(s.desc) + '</span></div>';
          }).join(''));
          return html;
        }

        function expected() {
          var rows = DATA.expected.map(function (e) {
            return '<tr><td>' + esc(e.name) + (e.must ? ' <span class="tag bad">dolezity</span>' : '') + '</td>' +
              '<td>' + (e.seen ? '<span class="tag ok">prisiel</span>' : '<span class="tag ' + (e.must ? 'bad' : 'muted') + '">neprisiel</span>') + '</td>' +
              '<td class="num">' + num(e.requests) + '</td><td>' + esc(e.seen ? time(e.lastSeen) : '-') + '</td><td>' + esc(e.why) + '</td></tr>';
          });
          var html = panel('Dolezite roboty, ktore by mali prist',
            'Ak "dolezity" robot za dlhsi cas neprisiel, stranka pre neho neexistuje. Nie je to chyba merania — treba ho pozvat (Search Console, Bing Webmaster) alebo ziskat odkazy.',
            table(['Robot', 'Stav', '#Poziadaviek', 'Naposledy', 'Co stratis bez neho'], rows));
          var readers = DATA.agents.filter(function (a) { return a.readRobots || a.readSitemap; }).map(function (a) {
            return '<tr class="click" data-i="' + DATA.agents.indexOf(a) + '"><td>' + esc(a.named ? a.name : a.key) + '</td><td>' + catTag(a.category) + '</td>' +
              '<td>' + yes(a.readRobots, true) + '</td><td>' + yes(a.readSitemap, true) + '</td></tr>';
          });
          html += panel('Kto cital pravidla a mapu webu', '', table(['Agent', 'Druh', 'robots.txt', 'sitemap.xml'], readers, 'Nikto.'));
          return html;
        }

        function content() {
          var v = DATA.variants;
          function vrow(label, d) {
            return '<tr><td>' + esc(label) + '</td><td class="num">' + num(d.pages) + ' / ' + num(d.published) + '</td><td class="num">' + num(d.requests) + '</td>' +
              '<td>' + d.byCategory.map(function (c) { return '<span class="tag" style="--tc:' + catColor(c[0]) + '">' + esc(CAT[c[0]] || c[0]) + ' ' + c[1] + '</span>'; }).join('') + '</td></tr>';
          }
          var html = panel('Rozsireny verzus zakladny variant',
            'Rozsireny ma FAQ, box Rychle fakty a FAQPage v JSON-LD. Stiahnutie nie je indexacia ani citacia; porovnanie ma zmysel az pri dostatku navstev.',
            table(['Variant', '#Stiahnutych stranok', '#Poziadaviek', 'Kto'], [vrow('Rozsireny', v.structured), vrow('Zakladny', v.baseline)]));
          var rows = DATA.pages.map(function (p) {
            return '<tr><td><span class="mono">' + esc(p.path) + '</span></td><td>' + esc(p.variant === 'structured' ? 'rozsireny' : (p.variant === 'baseline' ? 'zakladny' : p.variant)) + '</td>' +
              '<td class="num">' + num(p.requests) + '</td><td class="num">' + num(p.agents) + '</td>' +
              '<td>' + p.categories.map(function (c) { return '<span class="tag" style="--tc:' + catColor(c[0]) + '">' + esc(CAT[c[0]] || c[0]) + ' ' + c[1] + '</span>'; }).join('') + '</td></tr>';
          });
          html += panel('Stranky', '', table(['Stranka', 'Variant', '#Poziadaviek', '#Agentov', 'Kto'], rows));
          return html;
        }

        function events() {
          var rows = DATA.recent.map(function (r) {
            return '<tr><td>' + esc(time(r.at)) + '</td><td><span class="mono">' + esc(r.path) + '</span></td><td>' + esc(r.kind) + '</td>' +
              '<td>' + catTag(r.category) + '</td><td><span class="mono">' + esc(r.name) + '</span></td></tr>';
          });
          return panel('Posledne udalosti', 'Najnovsich 80 stiahnuti, bez navstev z klientskeho skriptu.', table(['Cas', 'Cesta', 'Typ', 'Druh', 'Agent'], rows));
        }

        /* ---------- drawer ---------- */
        function openAgent(i) {
          var a = DATA.agents[i];
          if (!a) return;
          var max = 1;
          var agentHours = fillHours(a.hours, function () { return 0; });
          agentHours.forEach(function (h) { if (h[1] > max) max = h[1]; });
          var hours = agentHours.length ? '<div class="hours" style="height:70px;gap:' + gapFor(agentHours.length) + 'px">' + agentHours.map(function (h) {
            return '<div class="col" title="' + esc(h[0].replace('T', ' ') + ':00, ' + h[1]) + '"><i style="height:' + (h[1] / max * 64) + 'px;background:' + catColor(a.category) + '"></i></div>';
          }).join('') + '</div>' : '';
          var html = '<button class="close" type="button" id="close">Zavriet</button>' +
            '<h2 style="margin-right:90px">' + esc(a.named ? a.name : (a.category === 'hidden' ? 'Skryty bot' : 'Nepredstavil sa')) + '</h2>' +
            '<p>' + catTag(a.category) + purposeTag(a.purpose) + (a.suspect ? '<span class="tag warn">podozrivy</span>' : '') + '</p>' +
            (a.role ? '<p class="muted">' + esc(a.role.why) + '</p>' : '') +
            '<div class="kv">' +
              '<div><span>Poziadaviek</span><b>' + num(a.requests) + '</b></div>' +
              '<div><span>Stranok</span><b>' + num(a.pages) + '</b></div>' +
              '<div><span>Roznych ciest</span><b>' + num(a.distinctPaths) + '</b></div>' +
              '<div><span>CSS a ikony</span><b>' + num(a.assets) + '</b></div>' +
              '<div><span>Spustil JS</span><b>' + (a.pages ? a.ranJs + '/' + a.pages : '-') + '</b></div>' +
              '<div><span>Max za minutu</span><b>' + num(a.maxPerMinute) + '</b></div>' +
            '</div>' +
            '<p class="note">Prvykrat ' + esc(time(a.firstSeen)) + ' · naposledy ' + esc(time(a.lastSeen)) + '</p>';
          if (a.score !== null) {
            html += '<h3>Skore ' + a.score + '/100</h3>' + (a.signals.length ? a.signals.map(function (s) {
              return '<div class="sig"><b style="color:' + (s.points < 0 ? 'var(--ok)' : 'var(--warn)') + '">' + (s.points > 0 ? '+' : '') + s.points + '</b><b>' + esc(s.label) + '</b><span class="muted">' + esc(s.desc) + '</span></div>';
            }).join('') : '<p class="muted">Ziadny signal.</p>');
          }
          html += '<h3>Identity (User-Agent)</h3>' + a.userAgents.map(function (u) {
            return '<div class="sig"><span class="mono">' + esc(u[0]) + '</span> <span class="muted">· ' + num(u[1]) + 'x</span></div>';
          }).join('');
          if (hours) html += '<h3>Po hodinach</h3>' + hours;
          html += '<h3>Co bral</h3>' + table(['Cesta', '#Pocet'], a.topPaths.map(function (p) {
            return '<tr><td><span class="mono">' + esc(p[0]) + '</span></td><td class="num">' + num(p[1]) + '</td></tr>';
          }));
          html += '<h3>Posledne poziadavky</h3>' + table(['Cas', 'Cesta', 'Typ'], a.events.map(function (e) {
            return '<tr><td>' + esc(time(e.at)) + '</td><td><span class="mono">' + esc(e.path) + '</span></td><td>' + esc(e.kind) + '</td></tr>';
          }));
          var d = el('drawer');
          d.innerHTML = html;
          d.hidden = false;
          el('ovl').hidden = false;
          d.scrollTop = 0;
          el('close').addEventListener('click', closeAgent);
          el('close').focus();
        }
        function closeAgent() { el('drawer').hidden = true; el('ovl').hidden = true; }

        /* ---------- rendering ---------- */
        var VIEWS = { overview:overview, agents:agents, ai:ai, hidden:hidden, expected:expected, content:content, events:events };
        function render() {
          if (!DATA) return;
          el('view').innerHTML = VIEWS[TAB]();
          var rows = el('view').querySelectorAll('tr.click');
          for (var i = 0; i < rows.length; i++) rows[i].addEventListener('click', function () { openAgent(Number(this.getAttribute('data-i'))); });
          var fcat = el('fcat');
          if (fcat) fcat.addEventListener('change', function () { FILTER.category = this.value; render(); });
          var fq = el('fq');
          if (fq) fq.addEventListener('input', function () {
            FILTER.q = this.value; var pos = this.selectionStart; render();
            var again = el('fq'); again.focus(); again.setSelectionRange(pos, pos);
          });
        }

        function load() {
          var auth = token();
          if (!auth) return showLogin();
          el('status').textContent = 'Nacitavam...';
          fetch('/api/stats?days=' + encodeURIComponent(el('days').value) + '&tests=' + encodeURIComponent(el('tests').value),
                { headers: { Authorization: 'Bearer ' + auth } })
            .then(function (r) {
              if (r.status === 401) { setToken(''); showLogin('Nespravne heslo.'); return null; }
              if (r.status === 503) throw new Error('Endpoint nie je nakonfigurovany.');
              if (!r.ok) throw new Error('Chyba servera: HTTP ' + r.status);
              return r.json();
            })
            .then(function (data) {
              if (!data) return;
              DATA = data;
              var s = 'Aktualizovane ' + time(data.generatedAt) + ' · ' + data.days + ' dni · ' + num(data.rowsRead) + ' riadkov';
              if (data.testRowsHidden) s += ' · skrytych testov ' + num(data.testRowsHidden);
              el('status').textContent = s;
              if (data.truncated) el('status').innerHTML = esc(s) + ' · <span class="error">dosiahnuty limit, skrat obdobie</span>';
              render();
            })
            .catch(function (e) { el('status').innerHTML = '<span class="error">' + esc(e.message) + '</span>'; });
        }

        function showLogin(message) {
          el('app').hidden = true; el('login').hidden = false; closeAgent();
          el('loginError').hidden = !message; el('loginError').textContent = message || '';
        }
        function showApp() { el('login').hidden = true; el('app').hidden = false; load(); }

        el('login').addEventListener('submit', function (e) {
          e.preventDefault();
          var v = el('password').value.trim();
          if (!v) return;
          setToken(v); el('password').value = ''; showApp();
        });
        el('tabs').addEventListener('click', function (e) {
          var b = e.target.closest('button[data-tab]');
          if (!b) return;
          TAB = b.getAttribute('data-tab');
          var all = el('tabs').querySelectorAll('button');
          for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-selected', all[i] === b ? 'true' : 'false');
          render();
        });
        el('reload').addEventListener('click', load);
        el('days').addEventListener('change', load);
        el('tests').addEventListener('change', load);
        el('logout').addEventListener('click', function () { setToken(''); DATA = null; showLogin(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAgent(); });
        el('ovl').addEventListener('click', closeAgent);
        el('theme').addEventListener('click', function () {
          var dark = document.documentElement.getAttribute('data-theme') !== 'dark';
          if (dark) document.documentElement.setAttribute('data-theme', 'dark');
          else document.documentElement.removeAttribute('data-theme');
          try { localStorage.setItem('searchlab_admin_theme', dark ? 'dark' : 'light'); } catch (e) {}
        });

        if (token()) showApp(); else showLogin();
      }());
    </script>
  </body>
</html>
`;
}
