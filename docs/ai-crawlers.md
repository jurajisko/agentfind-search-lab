# AI crawlery a vyhladavanie: co hovoria prevadzkovatelia

Zozbierane 24. 9. 2026 z oficialnej dokumentacie. Kde zdroj nie je od
prevadzkovatela, je to vyslovne napisane. Dokumentacia sa meni, pred pouzitim
u zakaznika over aktualny stav.

## Tri druhy AI robotov

Prevadzkovatelia dnes takmer zhodne rozlisuju tri ucely. Pre firmu je to
najdolezitejsie rozhodnutie, lebo blokovanie kazdeho ma iny nasledok:

| Ucel | Co robi | Ked ho zablokujes |
|---|---|---|
| **Uci sa** | berie obsah na trenovanie modelu | obsah nepojde do buducich modelov. Na vyhladavanie to **nema vplyv** |
| **Index pre AI vyhladavanie** | buduje index, z ktoreho AI vybera zdroje | AI ta **nebude citovat** |
| **Na ziadost pouzivatela** | nacita stranku, ked sa na nu pouzivatel pyta | AI stranku **nenacita**, aj ked jej das odkaz. Niektore ale robots.txt ignoruju |

## Prehlad podla prevadzkovatela

| Prevadzkovatel | Bot | Ucel | robots.txt | IP rozsahy |
|---|---|---|---|---|
| OpenAI | `GPTBot` | uci sa | respektuje | openai.com/gptbot.json |
| OpenAI | `OAI-SearchBot` | index pre ChatGPT vyhladavanie | respektuje | openai.com/searchbot.json |
| OpenAI | `ChatGPT-User` | na ziadost pouzivatela | **"may not apply"** | openai.com/chatgpt-user.json |
| OpenAI | `OAI-AdsBot` | kontrola cielovych stranok reklam v ChatGPT | respektuje | openai.com/adsbot.json |
| Anthropic | `ClaudeBot` | uci sa | respektuje | claude.com/crawling/bots.json |
| Anthropic | `Claude-SearchBot` | index pre vyhladavanie v Claude | respektuje | to iste |
| Anthropic | `Claude-User` | na ziadost pouzivatela | **respektuje** | to iste |
| Google | `Googlebot` | vyhladavanie Google | respektuje | developers.google.com (JSON) |
| Google | `Google-Extended` | **nie je crawler**, len token v robots.txt pre trenovanie Gemini | — | — |
| Google | `Google-Agent` | agenti Google, ktori prechadzaju web na ziadost | **vacsinou ignoruje** | user-triggered-agents.json |
| Google | `Google-GeminiNotebook` | zdroje, ktore pouzivatel vlozi do Gemini Notebook | **vacsinou ignoruje** | user-triggered-fetchers-google.json |
| Google | `GoogleOther` | vseobecny crawler pre rozne produktove timy | respektuje | — |
| Perplexity | `PerplexityBot` | index pre vyhladavanie, **nie** trenovanie | respektuje | perplexity.com/perplexitybot.json |
| Perplexity | `Perplexity-User` | na ziadost pouzivatela | **"generally ignores"** | perplexity.com/perplexity-user.json |
| Microsoft | `Bingbot` | Bing **a Copilot** (Copilot cita z Bing indexu) | respektuje | overenie cez Bing |
| Apple | `Applebot` | Siri, Spotlight, Safari; moze aj trenovat | respektuje | search.developer.apple.com/applebot.json |
| Apple | `Applebot-Extended` | **nie je crawler**, len token pre trenovanie | — | — |
| Meta | `meta-externalagent` | uci sa | respektuje | — |
| Meta | `meta-webindexer` | index pre vyhladavanie Meta AI | respektuje | — |
| Meta | `meta-externalfetcher` | na ziadost pouzivatela | **"may bypass"** | — |
| Meta | `meta-externalads` | reklama a obchodne produkty | respektuje | — |
| Meta | `facebookexternalhit` | nahlad odkazu pri zdielani | moze obist pri kontrole bezpecnosti | — |
| Mistral | `MistralAI-Training` | uci sa | respektuje | — |
| Mistral | `MistralAI-Index` | index pre Mistral vyhladavanie | respektuje | mistral.ai/mistralai-index-ips.json |
| Mistral | `MistralAI-User` | na ziadost pouzivatela | nie je automaticky crawler | mistral.ai/mistralai-user-ips.json |
| DuckDuckGo | `DuckAssistBot` | AI odpovede v realnom case, **nie** trenovanie | respektuje (zmena do 72 h) | duckduckgo.com/duckassistbot.json |
| Common Crawl | `CCBot` | verejny archiv, z ktoreho cerpa vela AI modelov | respektuje | index.commoncrawl.org/ccbot.json |
| xAI (Grok) | — | **ziadna oficialna dokumentacia crawlera nenajdena** | — | — |

## Co je pre nas nastroj najdolezitejsie

**1. Boty sa daju overit, nie len tvrdit.** OpenAI, Anthropic, Perplexity,
Apple, Mistral, DuckDuckGo aj Common Crawl zverejnuju IP rozsahy ako JSON. Dnes
vieme o botovi len to, ako sa sam nazve. Keby middleware pri poziadavke porovnal
IP s tymito zoznamami, mohli by sme ukladat len vysledok ("overeny OpenAI" alebo
"tvrdi, ze je OpenAI, ale nie je") a samotnu IP stale neukladat. To je rozdiel,
ktory beznym nastrojom chyba.

**2. Bing Webmaster ukazuje citacie v Copilote.** Od 10. 2. 2026 ma funkciu
"AI Performance": celkovy pocet citacii, pocet citovanych stranok za den,
**frazy, ktore AI pouzila pri hladani** (len vzorka) a citacie po jednotlivych
URL. Pokryva Copilot, AI suhrny v Bingu a vybranych partnerov. Je to jediny
oficialny zdroj, ktory ukazuje citacie v AI odpovediach. Registracia v Bing
Webmaster je preto este dolezitejsia, nez sa zdalo.

**3. Blokovanie "ucenia" nesposobi neviditelnost.** Google aj Apple to pisu
vyslovne: `Google-Extended` a `Applebot-Extended` su len tokeny a ich blokovanie
neovplyvni vyhladavanie. Firma, ktora nechce, aby sa z jej webu ucili modely,
moze blokovat ucenie a zostat viditelna.

**4. "Na ziadost pouzivatela" sa robots.txt casto netyka.** OpenAI, Google,
Perplexity aj Meta pisu, ze ich fetchery na ziadost pouzivatela robots.txt
ignorovat mozu. Anthropic tvrdi opak: `Claude-User` robots.txt respektuje.

**5. Zmeny robots.txt sa neprejavia hned.** OpenAI uvadza priblizne 24 hodin,
DuckDuckGo 72 hodin.

## Porovnanie s tym, co sme namerali my (12. 9. 2026)

| System | Dokumentacia hovori | My sme videli |
|---|---|---|
| ChatGPT | `ChatGPT-User` | `curl/8.5.0` zo sandboxu. Dokumentovany fetcher sa neukazal |
| Gemini | `Google-Agent` alebo `Google-GeminiNotebook` | User-Agent doslova `Google`. **V dokumentacii nie je** |
| Claude | `Claude-User` | `Claude-User (claude-code/...)`. Sedi s dokumentaciou |
| Perplexity | `Perplexity-User` | **ziadna poziadavka**, hoci tvrdil, ze stranku skusal nacitat |
| Copilot | `Bingbot` (cita z Bing indexu) | ziadna poziadavka. Sedi: nie sme v Bing indexe |
| Grok | nic oficialne | 3 identity Mac prehliadaca, 9 poziadaviek za pol sekundy |

**Nezavisle potvrdenie Groka (nie od xAI):** StackFox 6. 2. 2026 spravil rovnaky
pokus a nasiel User-Agent `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
AppleWebKit/537.36` a `Go-http-client/1.1`, 30 poziadaviek za menej nez sekundu,
z IP adries sieti AS9009 (M247 Europe) a AS212238 (Datacamp Limited), a
zastaranu verziu `Chrome/139` v case, ked aktualna bola 146. Zdroj uvadza, ze
Grok sa nikdy nepredstavi, takze pravidla v robots.txt na neho nezaberu. Ine
stranky tretich stran tvrdia, ze xAI dokumentuje `GrokBot/1.0` alebo `xAI-Bot`.
Na x.ai ani docs.x.ai sme taku stranku nenasli.

## K odporucaniu od ChatGPT

ChatGPT odporucil: povolit `OAI-SearchBot` v robots.txt, mat verejne a
zrozumitelne stranky (co firma predava, kde posobi, ceny, dostupnost, podmienky)
a doveryhodne zmienky na inych weboch, s tym, ze vysledok sa neda garantovat.

S dokumentaciou OpenAI to **suhlasi**. Doplnky z nasich dat:

- Nas robots.txt uz `OAI-SearchBot` povoluje (`User-agent: *` / `Allow: /`).
  Do 12. 9. OAI-SearchBot napriek tomu neprisiel (aktualny stav ukazuje admin v
  karte "Kto neprisiel"). Povolenie nestaci, bot o webe musi najprv vediet.
- Obsah musi byt v HTML bez JavaScriptu. Ziadny z AI agentov v nasom pokuse
  stranku nerenderoval.
- Pre Copilot a Perplexity plati to iste co pre ChatGPT vyhladavanie: bez indexu
  stranka neexistuje, ani s priamym odkazom.

## Zdroje

- OpenAI: https://developers.openai.com/api/docs/bots
- Anthropic (aktualizovane 7. 4. 2026): https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Google, fetchery na ziadost pouzivatela (aktualizovane 19. 8. 2026): https://developers.google.com/search/docs/crawling-indexing/google-user-triggered-fetchers
- Google, bezne crawlery a Google-Extended (aktualizovane 14. 7. 2026): https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
- Perplexity: https://docs.perplexity.ai/guides/bots
- Apple (aktualizovane 4. 9. 2026): https://support.apple.com/en-us/119829
- Meta: https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
- Mistral: https://docs.mistral.ai/robots
- DuckDuckGo: https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot
- Common Crawl: https://commoncrawl.org/ccbot
- Bing AI Performance (10. 2. 2026): https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- Grok, nezavisla studia (tretia strana): https://stackfox.co/research/grok-user-agent
