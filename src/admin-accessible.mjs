/**
 * Accessible report page for screen-reader and keyboard users.
 *
 * Follows the structure of bot-analyza-pristupna.html, which the team already
 * uses: skip link, no charts, only text and tables, numbered level-2 headings,
 * a table of contents, progress announced through a polite live region, and an
 * export section. Proper Slovak with diacritics so the screen reader
 * pronounces it correctly.
 *
 * The report fragment comes from /api/stats, where every data-derived string
 * is escaped by src/report.mjs. Credentials: the password typed here is kept
 * in sessionStorage for the tab only, shared with the visual admin page.
 *
 * The inline script avoids template literals and backslash escapes: it lives
 * inside this module's template literal.
 */
export function renderAccessibleAdmin() {
  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Správa o viditeľnosti webu — prístupná verzia</title>
<script>
  try { if (localStorage.getItem('searchlab_admin_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}
</script>
<style>
  :root { color-scheme: light; --plane:#f9f9f7; --surface:#fcfcfb; --ink:#0b0b0b; --ink-2:#52514e; --line:#e1e0d9; --axis:#c3c2b7; --link:#1c5cab; --focus:#2a78d6; --bad:#b42323; --ok:#006300; }
  :root[data-theme="dark"] { color-scheme: dark; --plane:#0d0d0d; --surface:#1a1a19; --ink:#ffffff; --ink-2:#c3c2b7; --line:#2c2c2a; --axis:#383835; --link:#86b6ef; --focus:#3987e5; --bad:#ef6a6a; --ok:#3fbf5a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--plane); color: var(--ink); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .skip { position: absolute; left: -9999px; top: 0; background: var(--ink); color: var(--surface); padding: .6rem 1rem; z-index: 10; }
  .skip:focus { left: 1rem; top: 1rem; }
  .wrap { max-width: 60rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: .5rem 0; }
  h2 { font-size: 1.35rem; margin: 2.2rem 0 .6rem; padding-top: 1rem; border-top: 1px solid var(--line); }
  h3 { font-size: 1.1rem; margin: 1.5rem 0 .4rem; }
  a { color: var(--link); } a:focus, button:focus, select:focus, input:focus, [tabindex]:focus { outline: 3px solid var(--focus); outline-offset: 2px; }
  .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 1rem 1.2rem; margin: 1rem 0; }
  label { display: block; font-weight: 600; margin: .6rem 0 .2rem; }
  input, select, button { font: inherit; padding: .5rem .7rem; border-radius: 6px; border: 1px solid var(--axis); background: var(--surface); color: var(--ink); }
  button { cursor: pointer; margin: .4rem .5rem .4rem 0; }
  .row { display: flex; flex-wrap: wrap; gap: 0 1.5rem; align-items: end; }
  .meta, .note, .why, .evidence, .hint { color: var(--ink-2); }
  .why, .evidence { display: block; font-size: .95em; }
  .error { color: var(--bad); font-weight: 600; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: .8rem 0; font-size: .96rem; }
  caption { text-align: left; font-weight: 600; padding: .3rem 0; }
  th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  thead th { border-bottom: 2px solid var(--axis); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .check { margin: .8rem 0; }
  [hidden] { display: none !important; }
  @media print { .no-print, .skip { display: none !important; } body { background: #fff; } }
</style>
</head>
<body>
<a class="skip" href="#hlavny-obsah">Preskočiť na hlavný obsah</a>
<div class="wrap">
  <header class="no-print">
    <h1>Správa o viditeľnosti webu pre vyhľadávače a AI</h1>
    <p>Prístupná verzia — bez grafov, len text a tabuľky. Jednotlivé časti správy sa dajú preskakovať nadpismi úrovne 2.</p>
    <p><a href="/admin/">Prejsť na vizuálnu verziu s grafmi</a> · <button id="theme" type="button">Prepnúť svetlý a tmavý režim</button></p>
  </header>

  <p id="stav" role="status" aria-live="polite" aria-atomic="true" class="hint"></p>

  <section id="prihlasenie" class="panel no-print" aria-labelledby="h-prihlasenie">
    <h2 id="h-prihlasenie" style="border:0;margin-top:0;padding-top:0">Prihlásenie</h2>
    <form id="login">
      <label for="heslo">Heslo</label>
      <input id="heslo" type="password" autocomplete="current-password" required>
      <p id="chyba" class="error" role="alert"></p>
      <button type="submit">Prihlásiť a načítať správu</button>
    </form>
  </section>

  <section id="nastavenia" class="panel no-print" aria-labelledby="h-nastavenia" hidden>
    <h2 id="h-nastavenia" style="border:0;margin-top:0;padding-top:0">Nastavenie správy</h2>
    <div class="row">
      <div>
        <label for="obdobie">Obdobie</label>
        <select id="obdobie">
          <option value="1">posledný deň</option>
          <option value="7">posledných 7 dní</option>
          <option value="30" selected>posledných 30 dní</option>
          <option value="90">posledných 90 dní</option>
        </select>
      </div>
      <div>
        <label for="testy">Testovacie záznamy</label>
        <select id="testy">
          <option value="0" selected>vynechať</option>
          <option value="1">zahrnúť</option>
        </select>
      </div>
      <div>
        <button id="nacitat" type="button">Načítať správu</button>
        <button id="odhlasit" type="button">Odhlásiť</button>
      </div>
    </div>
  </section>

  <main id="hlavny-obsah" tabindex="-1"></main>

  <section id="export" class="panel no-print" aria-labelledby="h-export" hidden>
    <h2 id="h-export" style="border:0;margin-top:0;padding-top:0">Export</h2>
    <p>Správu si môžete uložiť ako samostatný dokument, poslať ju firme alebo otvoriť tabuľku v Exceli.</p>
    <button id="stiahnut-spravu" type="button">Stiahnuť správu ako HTML dokument</button>
    <button id="stiahnut-csv" type="button">Stiahnuť tabuľku robotov (CSV pre Excel)</button>
    <button id="tlacit" type="button">Vytlačiť alebo uložiť ako PDF</button>
  </section>
</div>

<script>
(function () {
  var KEY = 'searchlab_admin';
  var DATA = null;
  function el(id) { return document.getElementById(id); }
  function say(text) { el('stav').textContent = ''; setTimeout(function () { el('stav').textContent = text; }, 50); }
  function token() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setToken(v) { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {} }

  function showLogin(message) {
    el('prihlasenie').hidden = false;
    el('nastavenia').hidden = true;
    el('export').hidden = true;
    el('hlavny-obsah').innerHTML = '';
    el('chyba').textContent = message || '';
    if (message) el('heslo').focus();
  }

  function download(name, type, content) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    say('Súbor ' + name + ' sa sťahuje.');
  }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  function load(moveFocus) {
    var auth = token();
    if (!auth) return showLogin('');
    say('Načítavam správu. Môže to trvať niekoľko sekúnd.');
    el('nacitat').disabled = true;
    fetch('/api/stats?days=' + encodeURIComponent(el('obdobie').value) + '&tests=' + encodeURIComponent(el('testy').value),
          { headers: { Authorization: 'Bearer ' + auth } })
      .then(function (r) {
        if (r.status === 401) { setToken(''); showLogin('Nesprávne heslo. Skúste to znova.'); return null; }
        if (r.status === 503) throw new Error('Server nie je nastavený: chýba heslo alebo prístup k databáze.');
        if (!r.ok) throw new Error('Chyba servera, kód ' + r.status + '.');
        return r.json();
      })
      .then(function (data) {
        el('nacitat').disabled = false;
        if (!data) return;
        DATA = data;
        el('prihlasenie').hidden = true;
        el('nastavenia').hidden = false;
        el('export').hidden = false;
        el('hlavny-obsah').innerHTML = data.reportHtml;
        var sections = el('hlavny-obsah').querySelectorAll('section').length;
        var message = 'Správa je načítaná. Počet častí: ' + sections + '.';
        if (data.truncated) message += ' Pozor: údajov bolo viac, ako sa dá naraz načítať. Skráťte obdobie.';
        say(message);
        if (moveFocus) {
          var first = document.getElementById('zhrnutie');
          if (first) { first.setAttribute('tabindex', '-1'); first.focus(); }
        }
      })
      .catch(function (e) { el('nacitat').disabled = false; say(e.message); });
  }

  el('login').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = el('heslo').value.trim();
    if (!v) return;
    setToken(v);
    el('heslo').value = '';
    load(true);
  });
  el('nacitat').addEventListener('click', function () { load(true); });
  el('odhlasit').addEventListener('click', function () { setToken(''); DATA = null; showLogin(''); say('Boli ste odhlásený.'); el('heslo').focus(); });
  el('stiahnut-spravu').addEventListener('click', function () { if (DATA) download('sprava-viditelnosti-' + stamp() + '.html', 'text/html;charset=utf-8', DATA.reportDocument); });
  el('stiahnut-csv').addEventListener('click', function () { if (DATA) download('roboty-' + stamp() + '.csv', 'text/csv;charset=utf-8', DATA.agentsCsv); });
  el('tlacit').addEventListener('click', function () { window.print(); });
  el('theme').addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') !== 'dark';
    if (dark) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('searchlab_admin_theme', dark ? 'dark' : 'light'); } catch (e) {}
    say(dark ? 'Zapnutý tmavý režim.' : 'Zapnutý svetlý režim.');
  });

  if (token()) load(false); else showLogin('');
}());
</script>
</body>
</html>
`;
}
