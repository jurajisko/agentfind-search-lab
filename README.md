# AgentFind Search Lab

Samostatný verejný obsahový experiment s 50 praktickými slovenskými návodmi. Nejde o produkčný AgentFind register ani o sľub vyššieho umiestnenia vo vyhľadávačoch.

## Čo testujeme

- indexáciu otvorených HTML stránok,
- dopyty, zobrazenia, kliky, CTR a priemernú pozíciu v Google Search Console,
- samostatne údaje v Bing Webmaster Tools,
- rozdiel medzi dvomi rovnocennými formami článku: bežný formát a formát s viditeľnými rýchlymi faktami, FAQ a schema.org,
- požiadavky crawlerov vo Vercel logoch.

## Spustenie

```bash
npm run check
npm run build
```

Výsledok je v `dist/`. `vercel.json` nastavuje správny build aj výstupný adresár automaticky.

## Nasadenie a meranie

1. Pripojiť nový GitHub repozitár na nový Vercel projekt.
2. Po nasadení zadať skutočnú produkčnú adresu ako Vercel premennú `SITE_URL` a znovu deploynúť.
3. Pridať URL-prefix property v Google Search Console a overiť ju HTML meta tagom alebo DNS, ak bude vlastná doména.
4. Pridať web do Bing Webmaster Tools.
5. Poslať `/sitemap.xml` obom službám a začať zapisovať dátum spustenia.

`GOOGLE_SITE_VERIFICATION` a `BING_SITE_VERIFICATION` sú voliteľné Vercel environment variables. Build ich vloží do každej stránky ako overovací meta tag.

Úplná metodika je na `/research/` a v `docs/measurement-protocol.md`.
