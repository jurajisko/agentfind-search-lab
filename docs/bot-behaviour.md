# Co agent spravil, nie len ze prisiel

Middleware zapisuje kazdu poziadavku a klasifikuje ju. Z postupnosti poziadaviek
sa da odvodit sprava agenta. Nic z toho nie je overena identita: `crawler_name`
je iba tvrdenie v hlavicke User-Agent a da sa sfalsovat.

## Stlpce, ktore to umoznuju

| Stlpec | Na co je |
|---|---|
| `agent_class` | known_crawler, likely_automation, browser_like, no_user_agent, unknown |
| `resource_kind` | guide, section, home, robots, sitemap, stylesheet, icon, manifest |
| `event_type` | `claimed_crawler_request` zname boty, `observed_request` ostatni, `browser_pageview` klientsky skript |

## Testovanie dotazov

Kazdy dotaz nizsie vylucuje testy riadkom:

```sql
and coalesce(metadata->>'is_test','false') <> 'true'
```

Ked chces dotaz vyskusat na umelych datach zo `scripts/seed-test-events.mjs`,
tento riadok docasne zmen na:

```sql
and metadata->>'seed' = 'synthetic-v1'
```

Umele cisla nikdy nepouzivaj ako vysledok. Su len na overenie, ze dotaz vracia
to, co cakas.

## 1. Kto nas navstivil

```sql
select coalesce(crawler_name, '(neznamy)') as agent,
       agent_class,
       count(*) as poziadaviek,
       count(distinct path) as unikatnych_stranok,
       min(occurred_at) as prvykrat,
       max(occurred_at) as naposledy
from public.search_lab_events
where event_type in ('claimed_crawler_request','observed_request')
  and coalesce(metadata->>'is_test','false') <> 'true'
group by 1, 2
order by poziadaviek desc;
```

## 2. Scraper alebo renderer

Agent, ktory si nikdy nevypytal `styles.css`, stranku nerenderoval. Vytiahol
iba text.

```sql
select coalesce(crawler_name, left(user_agent, 40)) as agent,
       count(*) filter (where resource_kind = 'guide') as stranok,
       count(*) filter (where resource_kind = 'stylesheet') as css,
       case when count(*) filter (where resource_kind = 'stylesheet') = 0
            then 'iba text' else 'renderuje' end as zaver
from public.search_lab_events
where event_type in ('claimed_crawler_request','observed_request')
  and coalesce(metadata->>'is_test','false') <> 'true'
group by 1
order by stranok desc;
```

## 3. Spustil JavaScript

Middleware sa spusti vzdy. Klientsky skript iba vtedy, ked agent vykona
JavaScript. Cesta, ktora je v prvom a chyba v druhom, znamena, ze agent
skripty nespustil.

```sql
with server as (
  select distinct path
  from public.search_lab_events
  where event_type in ('claimed_crawler_request','observed_request')
    and resource_kind = 'guide'
    and occurred_at > now() - interval '7 days'
    and coalesce(metadata->>'is_test','false') <> 'true'
),
klient as (
  select distinct path
  from public.search_lab_events
  where event_type = 'browser_pageview'
    and occurred_at > now() - interval '7 days'
    and coalesce(metadata->>'is_test','false') <> 'true'
)
select s.path,
       case when k.path is null then 'bez JS' else 'aj JS' end as render
from server s
left join klient k on k.path = s.path
order by render, s.path;
```

## 4. Rychlost zberu

Vysoky pocet stranok za minutu je zber, nie citanie.

```sql
select coalesce(crawler_name, left(user_agent, 40)) as agent,
       date_trunc('minute', occurred_at) as minuta,
       count(*) as poziadaviek
from public.search_lab_events
where event_type in ('claimed_crawler_request','observed_request')
  and coalesce(metadata->>'is_test','false') <> 'true'
group by 1, 2
having count(*) > 5
order by poziadaviek desc
limit 50;
```

## 5. Precital si robots.txt

```sql
select coalesce(crawler_name, left(user_agent, 40)) as agent,
       bool_or(resource_kind = 'robots') as cital_robots,
       bool_or(resource_kind = 'sitemap') as cital_sitemap,
       min(occurred_at) filter (where resource_kind = 'robots') as cas_robots,
       min(occurred_at) filter (where resource_kind = 'guide') as prva_stranka
from public.search_lab_events
where event_type in ('claimed_crawler_request','observed_request')
  and coalesce(metadata->>'is_test','false') <> 'true'
group by 1
order by prva_stranka nulls last;
```

Ak je `cas_robots` neskorsi ako `prva_stranka`, agent zacal stahovat skor, nez
si pozrel pravidla.

## Co z toho necitat

- Stiahnutie nie je indexacia, citacia ani navstevnost.
- Nulovy pocet pre bota neznamena, ze nas nepozna. Mohol pouzit inu
  infrastrukturu alebo cache.
- Frazy, impresie a pozicie tu nie su. Tie su iba v Search Console a Bing
  Webmaster Tools.
- Tieto data nepovedia, preco nieco odporucil do vysledkov. Povedia, co si vzal.

## Pokus s formatmi (od 25. 9. 2026)

Kazdy clanok existuje v troch verziach s rovnakym obsahom:

| Verzia | Adresa | `resource_kind` |
|---|---|---|
| HTML | `/sekcia/clanok/` | `guide` |
| Markdown | `/sekcia/clanok.md` | `guide_md` |
| JSON | `/sekcia/clanok.json` | `guide_json` |

K tomu `/llms.txt` (zoznam clankov s odkazmi na Markdown, `llms_txt`) a
`/llms-full.txt` (cely web v jednom subore, `llms_full`).

Pravidla, aby pokus nepokazil ostatne merania:

- Markdown a JSON kopiruju variant clanku. Zakladny clanok nema FAQ ani fakty
  v ziadnom formate.
- Alternativy nie su v sitemape a maju hlavicku `X-Robots-Tag: noindex`, aby
  ich vyhladavace nezaradili ako duplikat HTML. Bot hlavicku uvidi az po
  stiahnuti, takze na meranie stahovania nema vplyv.
- Agent sa k nim dostane trema cestami: `<link rel="alternate">` v hlavicke,
  viditelny odkaz pod clankom, alebo `llms.txt`.

Vysledky ukazuje admin v karte "Formaty".

## Sprava pre firmu a pristupna verzia

Admin ma kartu "Sprava": zhrnutie ludskou recou, cestu k odporucaniu
(pristupnost, objavitelnost, pokrytie, citacie), grafy aktivity, pokusu s FAQ a
formatov, a zoznam "co pomaha a co skodi". Ku kazdemu grafu je tabulka.

Tu istu spravu v textovej podobe ma `/admin/pristupna/` pre citac obrazovky:
bez grafov, cislovane nadpisy urovne 2, obsah, stav vypisany slovom, spravna
slovencina s diakritikou. Obe stranky vedia stiahnut spravu ako samostatny
HTML dokument (pre klienta alebo tlac do PDF) a tabulku robotov ako CSV pre
Excel.

Pripravenost webu pocita audit pri kazdom builde (`src/audit.mjs`, vysledok
v `/admin/audit.json`). Kazda kontrola uvadza, ako isto vieme, ze na nej
zalezi: dokumentovane prevadzkovatelmi, namerane v nasich pokusoch, alebo
hypoteza. Hypotezy sa do skore nepocitaju.

Farby grafov su overene nastrojom na farbosleposť pre svetly aj tmavy rezim.
Poradie v `--g-*` premennych v admine nemenit.
