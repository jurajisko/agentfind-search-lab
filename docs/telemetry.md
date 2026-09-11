# Vlastné meranie Search Lab

## Čo zapisujeme

| Udalosť | Zdroj | Dáta |
|---|---|---|
| `browser_pageview` | malý first-party skript v stránke | cesta, doména referrera, čas |
| `claimed_crawler_request` | Vercel Middleware pred statickou stránkou | cesta, deklarovaný crawler, user-agent, čas |

`browser_pageview` neznamená automaticky človeka: je to iba požiadavka z prehliadača, v ktorom sa spustil JavaScript. Väčšina bežných search botov JavaScript nespúšťa, ale niektoré automatizované prehliadače ho spustiť môžu.

Neukladáme IP adresy, cookies, úplné URL referrerov ani vyhľadávacie frázy návštevníkov.

## Dôležitá hranica

User-agent sa dá sfalšovať. Preto je crawler označený ako **claimed** — vieme, čo o sebe požiadavka tvrdí, nie že sme bot kryptograficky overili. Návšteva `OAI-SearchBot`, `ChatGPT-User` alebo `PerplexityBot` tiež nie je dôkaz, že daný AI produkt použil stránku vo svojej odpovedi.

Google a Bing bežne neposielajú konkrétnu vyhľadávaciu frázu pri návšteve. Frázy, zobrazenia, CTR a priemernú pozíciu získame iba cez Google Search Console a Bing Webmaster Tools.

## Potrebné Vercel premenné

Vercel → **Settings → Environment Variables**:

- `SUPABASE_URL` — URL projektu AgentFind Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — secret/service_role key toho istého projektu

Nastaviť pre **Production**. `SUPABASE_SERVICE_ROLE_KEY` nesmie byť nikdy vložený do frontendu ani do GitHubu. Po uložení treba spustiť nový deployment.
