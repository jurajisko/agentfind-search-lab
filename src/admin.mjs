/**
 * Internal reporting page. Never linked from the site and marked noindex.
 *
 * The page holds no credentials of its own: the password is typed by the
 * operator, kept in sessionStorage for the tab, and sent to /api/stats, which
 * is the only place that can reach Supabase.
 */
export function renderAdmin() {
  return `<!doctype html>
<html lang="sk">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Search Lab — merania agentov</title>
    <style>
      :root { color-scheme: light dark; --bg:#0b1020; --panel:#151b31; --line:#2a3350; --text:#e8ecf8; --muted:#97a2c4; --accent:#5eead4; --warn:#fbbf24; }
      * { box-sizing: border-box; }
      body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--text); font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
      .wrap { max-width:1100px; margin:0 auto; }
      h1 { font-size:22px; margin:0 0 4px; }
      h2 { font-size:16px; margin:32px 0 10px; }
      p.sub { color:var(--muted); margin:0 0 24px; }
      .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
      .controls { display:flex; gap:12px; flex-wrap:wrap; align-items:end; margin-bottom:20px; }
      label { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }
      input, select, button { font:inherit; padding:8px 10px; border-radius:8px; border:1px solid var(--line); background:#101731; color:var(--text); }
      button { background:var(--accent); color:#062024; border:0; font-weight:600; cursor:pointer; }
      button.ghost { background:transparent; color:var(--text); border:1px solid var(--line); font-weight:400; }
      .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
      .tile { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; }
      .tile b { display:block; font-size:26px; line-height:1.1; }
      .tile span { color:var(--muted); font-size:12px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
      th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
      td.num { text-align:right; font-variant-numeric:tabular-nums; }
      .scroll { overflow-x:auto; }
      .tag { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; border:1px solid var(--line); white-space:nowrap; }
      .tag.warn { color:var(--warn); border-color:var(--warn); }
      .tag.ok { color:var(--accent); border-color:var(--accent); }
      code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; color:var(--muted); word-break:break-all; }
      .note { color:var(--muted); font-size:12px; margin-top:10px; }
      .error { color:#fca5a5; }
      [hidden] { display:none !important; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Search Lab — merania agentov</h1>
      <p class="sub">Co si agenti realne stiahli. Identita je tvrdenie v User-Agent, nie overenie.</p>

      <form id="login" class="panel" style="max-width:380px">
        <label for="password">Heslo</label>
        <input id="password" type="password" autocomplete="current-password" style="width:100%">
        <p id="loginError" class="note error" hidden></p>
        <p style="margin:12px 0 0"><button type="submit">Prihlasit</button></p>
      </form>

      <div id="app" hidden>
        <div class="controls">
          <div>
            <label for="days">Obdobie</label>
            <select id="days">
              <option value="1">24 hodin</option>
              <option value="7" selected>7 dni</option>
              <option value="30">30 dni</option>
              <option value="90">90 dni</option>
            </select>
          </div>
          <div>
            <label for="tests">Testovacie riadky</label>
            <select id="tests">
              <option value="0" selected>skryt</option>
              <option value="1">zobrazit</option>
            </select>
          </div>
          <button id="reload" type="button">Obnovit</button>
          <button id="logout" class="ghost" type="button">Odhlasit</button>
        </div>

        <p id="status" class="note"></p>
        <div id="content" hidden></div>
      </div>
    </div>

    <script>
      (function () {
        var KEY = 'searchlab_admin';
        var el = function (id) { return document.getElementById(id); };
        var esc = function (value) {
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        };
        var num = function (value) { return Number(value || 0).toLocaleString('sk-SK'); };
        var time = function (value) {
          if (!value) return '-';
          var d = new Date(value);
          return d.toLocaleString('sk-SK', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        };

        function token() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
        function setToken(value) { try { value ? sessionStorage.setItem(KEY, value) : sessionStorage.removeItem(KEY); } catch (e) {} }

        function tile(value, label) {
          return '<div class="tile"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
        }

        function agentsTable(agents) {
          if (!agents.length) return '<p class="note">Za toto obdobie nie su ziadne stiahnutia.</p>';
          var rows = agents.map(function (a) {
            var name = a.crawlerName
              ? '<span class="tag ok">' + esc(a.crawlerName) + '</span>'
              : '<span class="tag warn">nepredstavil sa</span>';
            var render = a.renders
              ? '<span class="tag ok">renderuje</span>'
              : '<span class="tag warn">iba text</span>';
            return '<tr>' +
              '<td>' + name + '<div><code>' + esc(a.userAgent || '(prazdny)') + '</code></div></td>' +
              '<td>' + esc(a.agentClass) + '</td>' +
              '<td class="num">' + num(a.requests) + '</td>' +
              '<td class="num">' + num(a.distinctPaths) + '</td>' +
              '<td class="num">' + num(a.burst) + '</td>' +
              '<td>' + render + '</td>' +
              '<td>' + (a.readRobots ? 'ano' : '<span class="tag warn">nie</span>') + '</td>' +
              '<td>' + esc(a.kinds.join(', ')) + '</td>' +
              '<td>' + esc(time(a.lastSeen)) + '</td>' +
            '</tr>';
          }).join('');
          return '<div class="panel scroll"><table><thead><tr>' +
            '<th>Agent</th><th>Trieda</th><th>Poziadaviek</th><th>Stranok</th>' +
            '<th>Za minutu</th><th>Render</th><th>robots.txt</th><th>Co bral</th><th>Naposledy</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="note">Kto si nikdy nevypytal styles.css, stranku nevyrenderoval. ' +
            'Vysoke cislo v stlpci "za minutu" je zber, nie citanie.</p>';
        }

        function variantBlock(v) {
          var s = v.structured, b = v.baseline;
          var line = function (label, d) {
            return '<tr><td>' + esc(label) + '</td>' +
              '<td class="num">' + num(d.pages) + ' / ' + num(d.published) + '</td>' +
              '<td class="num">' + num(d.requests) + '</td></tr>';
          };
          return '<div class="panel scroll"><table><thead><tr>' +
            '<th>Variant</th><th>Stiahnutych stranok</th><th>Poziadaviek</th>' +
            '</tr></thead><tbody>' +
            line('Rozsireny (FAQ + JSON-LD)', s) + line('Zakladny', b) +
            '</tbody></table></div>' +
            '<p class="note">Porovnanie ma zmysel az pri dostatocnom pocte navstev. ' +
            'Stiahnutie nie je indexacia ani citacia.</p>';
        }

        function pagesTable(pages) {
          if (!pages.length) return '';
          var rows = pages.map(function (p) {
            return '<tr><td><code>' + esc(p.path) + '</code></td>' +
              '<td>' + esc(p.variant === 'structured' ? 'rozsireny' : p.variant) + '</td>' +
              '<td class="num">' + num(p.requests) + '</td>' +
              '<td class="num">' + num(p.agents) + '</td></tr>';
          }).join('');
          return '<div class="panel scroll"><table><thead><tr>' +
            '<th>Stranka</th><th>Variant</th><th>Poziadaviek</th><th>Agentov</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        }

        function recentTable(recent) {
          if (!recent.length) return '';
          var rows = recent.map(function (r) {
            return '<tr><td>' + esc(time(r.occurredAt)) + '</td>' +
              '<td><code>' + esc(r.path) + '</code></td>' +
              '<td>' + esc(r.kind || '-') + '</td>' +
              '<td>' + esc(r.agent) + '</td>' +
              '<td>' + esc(r.agentClass || '-') + '</td></tr>';
          }).join('');
          return '<div class="panel scroll"><table><thead><tr>' +
            '<th>Cas</th><th>Cesta</th><th>Typ</th><th>Agent</th><th>Trieda</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        }

        function render(data) {
          var t = data.totals;
          var html = '<div class="tiles">' +
            tile(num(t.fetches), 'stiahnuti agentmi') +
            tile(num(t.distinctAgents), 'roznych agentov') +
            tile(num(t.namedCrawlers), 'predstavilo sa menom') +
            tile(num(t.disguisedAsBrowser), 'tvari sa ako prehliadac') +
            tile(num(t.rendered), 'skutocne renderovalo') +
            tile(num(t.browserPageviews), 'pageviews z prehliadaca') +
          '</div>';

          html += '<h2>Agenti</h2>' + agentsTable(data.agents);
          html += '<h2>Rozsireny verzus zakladny variant</h2>' + variantBlock(data.variants);
          html += '<h2>Najcastejsie stranky</h2>' + pagesTable(data.pages);
          html += '<h2>Posledne udalosti</h2>' + recentTable(data.recent);

          if (t.testRowsHidden) {
            html += '<p class="note">Skrytych ' + num(t.testRowsHidden) + ' testovacich riadkov.</p>';
          }
          if (data.truncated) {
            html += '<p class="note error">Dosiahnuty limit citania. Cisla su necuplne, skrat obdobie.</p>';
          }
          el('content').innerHTML = html;
          el('content').hidden = false;
          el('status').textContent = 'Aktualizovane ' + time(data.generatedAt) +
            ' · obdobie ' + data.days + ' dni · precitanych ' + num(t.rowsRead) + ' riadkov';
        }

        function load() {
          var auth = token();
          if (!auth) return showLogin();
          el('status').textContent = 'Nacitavam...';
          el('content').hidden = true;
          var query = '?days=' + encodeURIComponent(el('days').value) +
                      '&tests=' + encodeURIComponent(el('tests').value);
          fetch('/api/stats' + query, { headers: { Authorization: 'Bearer ' + auth } })
            .then(function (response) {
              if (response.status === 401) { setToken(''); showLogin('Nespravne heslo.'); return null; }
              if (response.status === 503) throw new Error('Endpoint nie je nakonfigurovany (chyba ADMIN_PASSWORD alebo pristup k databaze).');
              if (!response.ok) throw new Error('Chyba servera: HTTP ' + response.status);
              return response.json();
            })
            .then(function (data) { if (data) render(data); })
            .catch(function (error) { el('status').innerHTML = '<span class="error">' + esc(error.message) + '</span>'; });
        }

        function showLogin(message) {
          el('app').hidden = true;
          el('login').hidden = false;
          var box = el('loginError');
          box.hidden = !message;
          box.textContent = message || '';
        }

        function showApp() {
          el('login').hidden = true;
          el('app').hidden = false;
          load();
        }

        el('login').addEventListener('submit', function (event) {
          event.preventDefault();
          var value = el('password').value.trim();
          if (!value) return;
          setToken(value);
          el('password').value = '';
          showApp();
        });
        el('reload').addEventListener('click', load);
        el('days').addEventListener('change', load);
        el('tests').addEventListener('change', load);
        el('logout').addEventListener('click', function () { setToken(''); showLogin(); });

        if (token()) showApp(); else showLogin();
      }());
    </script>
  </body>
</html>
`;
}
