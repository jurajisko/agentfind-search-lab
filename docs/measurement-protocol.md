# Merací protokol Search Lab

## Po spustení

Zapísať dátum prvého produkčného nasadenia, URL, počet článkov a sitemapu. Google Search Console a Bing Webmaster Tools môžu najskôr niekoľko dní zobrazovať nulu; indexácia ani dopyty nie sú okamžité.

## Zdroje dát

| Zdroj | Čo sa zapisuje | Čo nedokazuje |
|---|---|---|
| Google Search Console | indexované URL, dopyty, zobrazenia, kliky, CTR, priemerná pozícia | návštevy z iných vyhľadávačov a odporúčanie v AI chate |
| Bing Webmaster Tools | indexácia a výkon v Bingu | výsledky Google |
| Vercel request logy | požiadavky Googlebot, Bingbot a ďalších botov | použitie obsahu v odpovedi AI agenta |
| Vercel Web Analytics | návštevy ľudí, ak bude zapnutá | návštevy botov, ktoré nespúšťajú JavaScript |

Meta/Facebook nefunguje ako všeobecný webový vyhľadávač. Open Graph značky umožnia správny náhľad pri zdieľaní; nie sú zdrojom organických search metrík.

## Porovnanie formátov

Články s párnym poradovým číslom sú skupina **rozšírený formát**: obsahujú viditeľné rýchle fakty, FAQ a JSON-LD FAQPage. Nepárne články sú skupina **základný formát**. Obe skupiny majú hodnotný pôvodný obsah a Article schema.

Po 28 dňoch od prvých zobrazení sa porovná agregovane:

- počet indexovaných URL,
- počet dopytov a zobrazení na článok,
- CTR,
- priemerná pozícia iba pri dostatočnom počte zobrazení.

Výsledok je hypotéza pre ďalší test, nie dôkaz príčinnej súvislosti. Témy majú rozdielny dopyt a sezónnosť.

## Prechod k firemným profilom AgentFind

Ak sa ukáže, že stránky sa spoľahlivo indexujú a získavajú dopyty, rovnaký technický základ použijeme pre prevzaté firemné profily: čisté HTML, canonical, lokálne sektorové stránky, sitemap a relevantné schema.org údaje. Pri skutočnej firme bude jej Google Search Console pripojenie vždy dobrovoľné a po súhlase vlastníka.
