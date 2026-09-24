/**
 * Agent identification for reporting.
 *
 * Signatures are ported from bot-analyza-engine.js (the nginx log analyser in
 * c:\wamp64\www\analyza_logov) so both tools name the same agent the same way.
 * Two things are added that a server log alone cannot give:
 *
 *  - AI agents are split by purpose. "It is an AI crawler" is not actionable;
 *    whether it trains a model, builds an AI search index, or fetches a page
 *    live for one user decides whether a site owner should let it in.
 *  - Observations from our own probes (e.g. Gemini's live fetcher sends the
 *    bare User-Agent "Google") are marked as observed, not documented.
 *
 * Everything here is a User-Agent claim. It can be spoofed.
 * Classification runs at read time, so improving a signature reclassifies all
 * past rows without touching the database.
 */

export const CATEGORIES = {
  search:  { label: 'Vyhladavac',        desc: 'Indexuje web pre vysledky vyhladavania.' },
  ai:      { label: 'AI',                desc: 'Zbiera obsah pre AI modely alebo AI odpovede.' },
  seo:     { label: 'SEO nastroj',       desc: 'Komercny SEO alebo marketingovy crawler.' },
  social:  { label: 'Socialna siet',     desc: 'Stahuje nahlad odkazu pri zdielani.' },
  monitor: { label: 'Monitoring',        desc: 'Kontroluje dostupnost alebo rychlost webu.' },
  feed:    { label: 'RSS',               desc: 'Odobera feed.' },
  tool:    { label: 'Skript / kniznica', desc: 'Surovy HTTP klient: skript, integracia alebo sandbox AI asistenta.' },
  scan:    { label: 'Skener',            desc: 'Hlada zranitelnosti.' },
  generic: { label: 'Neznamy bot',       desc: 'Prizna sa, ze je bot, ale nepozname ho.' },
  hidden:  { label: 'Skryty bot',        desc: 'Tvari sa ako prehliadac, sprava sa ako stroj.' },
  browser: { label: 'Prehliadac',        desc: 'Vyzera a sprava sa ako clovek v prehliadaci.' }
};

// Only meaningful for category "ai".
export const PURPOSES = {
  training:   { label: 'Uci sa',                 desc: 'Berie obsah na trenovanie modelu. Blokovanie neovplyvni, ci ta AI najde vo vyhladavani.' },
  ai_search:  { label: 'Index pre AI vyhladavanie', desc: 'Buduje index, z ktoreho AI vybera zdroje a citacie. Toto rozhoduje, ci ta odcituje.' },
  user_fetch: { label: 'Na ziadost pouzivatela', desc: 'Nacita stranku nazivo, ked sa na nu pouzivatel AI asistenta pyta.' },
  mixed:      { label: 'Zmiesany ucel',          desc: 'Prevadzkovatel ucel neoddeluje alebo ho nezverejnuje.' }
};

// [pattern, name, category, purpose]. Order matters: first match wins, so
// narrower patterns come before broader ones from the same operator.
const SIGNATURES = [
  // --- observed in our own probes ---
  [/^google$/i, 'Google (Gemini, nacitanie na ziadost)', 'ai', 'user_fetch'],

  // --- search engines ---
  [/googlebot-image/i, 'Googlebot Image', 'search'],
  [/googlebot-video/i, 'Googlebot Video', 'search'],
  [/googlebot-news/i, 'Googlebot News', 'search'],
  [/adsbot-google/i, 'AdsBot Google', 'search'],
  [/mediapartners-google/i, 'Mediapartners (AdSense)', 'search'],
  [/apis-google/i, 'APIs-Google', 'search'],
  [/feedfetcher-google/i, 'Feedfetcher Google', 'feed'],
  [/google-inspectiontool/i, 'Google Inspection Tool', 'search'],
  [/storebot-google/i, 'Google StoreBot', 'search'],
  [/google-read-aloud/i, 'Google Read Aloud', 'search'],
  [/google-extended/i, 'Google-Extended (Gemini)', 'ai', 'training'],
  [/googleother/i, 'GoogleOther', 'search'],
  [/googlebot/i, 'Googlebot', 'search'],
  [/google favicon/i, 'Google Favicon', 'search'],
  [/bingpreview/i, 'BingPreview', 'search'],
  [/adidxbot/i, 'AdIdxBot (Bing Ads)', 'search'],
  [/bingbot|msnbot/i, 'Bingbot', 'search'],
  [/yandex(bot|images|video|media|blogs|metrika|accessibility|renderresources|mobilebot)/i, 'YandexBot', 'search'],
  [/seznambot|seznam screenshot/i, 'SeznamBot', 'search'],
  [/duckassistbot/i, 'DuckAssistBot', 'ai', 'ai_search'],
  [/duckduck(bot|go)/i, 'DuckDuckBot', 'search'],
  [/baiduspider/i, 'Baiduspider', 'search'],
  [/sogou (web|inst|spider)/i, 'Sogou Spider', 'search'],
  [/naver|yeti\//i, 'Naver Yeti', 'search'],
  [/petalbot|aspiegel/i, 'PetalBot (Huawei)', 'search'],
  [/qwantify|qwantbot/i, 'Qwant', 'search'],
  [/exabot/i, 'Exabot', 'search'],
  [/mojeekbot/i, 'MojeekBot', 'search'],
  [/coccocbot/i, 'CocCocBot', 'search'],
  [/yisouspider/i, 'YisouSpider', 'search'],
  [/applebot-extended/i, 'Applebot-Extended', 'ai', 'training'],
  [/applebot/i, 'Applebot', 'search'],
  [/slurp/i, 'Yahoo Slurp', 'search'],

  // --- AI, split by purpose ---
  [/gptbot/i, 'GPTBot (OpenAI)', 'ai', 'training'],
  [/oai-searchbot/i, 'OAI-SearchBot (OpenAI)', 'ai', 'ai_search'],
  [/chatgpt-user/i, 'ChatGPT-User (OpenAI)', 'ai', 'user_fetch'],
  [/claude-searchbot/i, 'Claude-SearchBot (Anthropic)', 'ai', 'ai_search'],
  [/claude-user/i, 'Claude-User (Anthropic)', 'ai', 'user_fetch'],
  [/claudebot/i, 'ClaudeBot (Anthropic)', 'ai', 'training'],
  [/anthropic-ai/i, 'anthropic-ai', 'ai', 'training'],
  [/perplexity-user/i, 'Perplexity-User', 'ai', 'user_fetch'],
  [/perplexitybot/i, 'PerplexityBot', 'ai', 'ai_search'],
  [/mistralai-user/i, 'MistralAI-User', 'ai', 'user_fetch'],
  [/ccbot/i, 'CCBot (Common Crawl)', 'ai', 'training'],
  [/bytespider/i, 'Bytespider (ByteDance)', 'ai', 'training'],
  [/tiktokspider/i, 'TikTokSpider', 'ai', 'training'],
  [/meta-externalfetcher/i, 'Meta-ExternalFetcher', 'ai', 'user_fetch'],
  [/meta-externalagent|facebookbot/i, 'Meta-ExternalAgent', 'ai', 'training'],
  [/amazonbot/i, 'Amazonbot', 'ai', 'mixed'],
  [/cohere-training-data-crawler/i, 'Cohere training crawler', 'ai', 'training'],
  [/cohere-ai/i, 'Cohere AI', 'ai', 'mixed'],
  [/diffbot/i, 'Diffbot', 'ai', 'mixed'],
  [/omgili|webz\.io/i, 'Omgili / Webz.io', 'ai', 'training'],
  [/img2dataset/i, 'img2dataset', 'ai', 'training'],
  [/imagesift/i, 'ImagesiftBot', 'ai', 'training'],
  [/youbot/i, 'YouBot', 'ai', 'ai_search'],
  [/ai2bot|allenai/i, 'AI2Bot', 'ai', 'training'],
  [/timpibot/i, 'Timpibot', 'ai', 'training'],
  [/kangaroo bot/i, 'Kangaroo Bot', 'ai', 'training'],
  [/firecrawl/i, 'Firecrawl', 'ai', 'mixed'],
  [/brightbot|scrapy-?bot/i, 'Bright Data', 'ai', 'mixed'],
  [/novaact|operator\//i, 'AI agent (Operator / NovaAct)', 'ai', 'user_fetch'],

  // --- SEO / marketing ---
  [/ahrefsbot|ahrefssiteaudit/i, 'AhrefsBot', 'seo'],
  [/semrushbot|siteauditbot/i, 'SemrushBot', 'seo'],
  [/mj12bot/i, 'MJ12bot (Majestic)', 'seo'],
  [/dotbot/i, 'DotBot (Moz)', 'seo'],
  [/rogerbot/i, 'rogerbot (Moz)', 'seo'],
  [/dataforseo/i, 'DataForSeoBot', 'seo'],
  [/blexbot/i, 'BLEXBot', 'seo'],
  [/barkrowler|babbar/i, 'Barkrowler (Babbar)', 'seo'],
  [/serpstat/i, 'SerpstatBot', 'seo'],
  [/screaming frog/i, 'Screaming Frog', 'seo'],
  [/sitebulb/i, 'Sitebulb', 'seo'],
  [/seokicks/i, 'SEOkicks', 'seo'],
  [/zoominfobot/i, 'ZoomInfoBot', 'seo'],
  [/seranking/i, 'SE Ranking', 'seo'],
  [/sistrix/i, 'SISTRIX', 'seo'],
  [/seobility/i, 'Seobility', 'seo'],
  [/onsite-bot|oncrawl/i, 'OnCrawl', 'seo'],
  [/trendictionbot/i, 'Trendiction', 'seo'],

  // --- social previews ---
  [/facebookexternalhit|facebookcatalog|facebot/i, 'Facebook', 'social'],
  [/twitterbot/i, 'Twitterbot / X', 'social'],
  [/linkedinbot/i, 'LinkedInBot', 'social'],
  [/pinterest/i, 'Pinterest', 'social'],
  [/slackbot|slack-imgproxy/i, 'Slackbot', 'social'],
  [/discordbot/i, 'Discordbot', 'social'],
  [/telegrambot/i, 'TelegramBot', 'social'],
  [/whatsapp/i, 'WhatsApp', 'social'],
  [/redditbot/i, 'Redditbot', 'social'],
  [/embedly|iframely|skypeuripreview|vkshare/i, 'Nahlad odkazu', 'social'],

  // --- monitoring ---
  [/uptimerobot/i, 'UptimeRobot', 'monitor'],
  [/pingdom/i, 'Pingdom', 'monitor'],
  [/statuscake/i, 'StatusCake', 'monitor'],
  [/site24x7/i, 'Site24x7', 'monitor'],
  [/betteruptime|better uptime/i, 'Better Uptime', 'monitor'],
  [/chrome-lighthouse|lighthouse/i, 'Lighthouse / PageSpeed', 'monitor'],
  [/pagespeed|webpagetest|gtmetrix/i, 'PageSpeed / WebPageTest', 'monitor'],
  [/vercel-screenshot|vercelbot/i, 'Vercel', 'monitor'],

  // --- RSS ---
  [/feedly/i, 'Feedly', 'feed'],
  [/inoreader/i, 'Inoreader', 'feed'],
  [/newsblur|theoldreader|feedbin|feedburner/i, 'RSS citacka', 'feed'],

  // --- scanners ---
  [/zgrab|zmap|masscan/i, 'Sietovy skener', 'scan'],
  [/nuclei|projectdiscovery/i, 'Nuclei', 'scan'],
  [/nmap|nikto|sqlmap|wpscan|acunetix|netsparker|arachni|dirbuster|gobuster|feroxbuster|wfuzz/i, 'Bezpecnostny skener', 'scan'],
  [/censys|shodan|internetmeasurement|expanse|leakix|criminalip|binaryedge|stretchoid/i, 'Internetovy skener', 'scan'],

  // --- raw HTTP clients. AI assistants often land here: ChatGPT and Copilot
  //     fetched our pages with plain curl from their sandboxes. ---
  [/^curl\/|\bcurl\//i, 'curl', 'tool'],
  [/^wget|\bwget\//i, 'Wget', 'tool'],
  [/python-requests/i, 'python-requests', 'tool'],
  [/python-urllib|urllib/i, 'python-urllib', 'tool'],
  [/aiohttp/i, 'aiohttp', 'tool'],
  [/python-httpx|\bhttpx/i, 'httpx', 'tool'],
  [/scrapy/i, 'Scrapy', 'tool'],
  [/go-http-client/i, 'Go-http-client', 'tool'],
  [/^java\/|\bjava\/1\./i, 'Java HTTP client', 'tool'],
  [/okhttp/i, 'OkHttp', 'tool'],
  [/apache-httpclient/i, 'Apache HttpClient', 'tool'],
  [/axios/i, 'axios', 'tool'],
  [/node-fetch|undici|node\.js/i, 'Node.js fetch', 'tool'],
  [/guzzle/i, 'Guzzle (PHP)', 'tool'],
  [/libwww-perl|lwp::/i, 'libwww-perl', 'tool'],
  [/headlesschrome/i, 'HeadlessChrome', 'tool'],
  [/phantomjs|puppeteer|playwright|selenium|webdriver|cypress/i, 'Automatizovany prehliadac', 'tool'],
  [/postman|insomnia/i, 'API klient', 'tool']
];

const GENERIC = /(bot\b|bot\/|[-_]bot|crawler|crawling|spider|scraper|scraping|fetcher|indexer|archiver|\+https?:\/\/)/i;

/**
 * What a site owner loses by blocking the agent. `must` marks agents whose
 * absence or blocking is a real visibility problem.
 */
export const ROLES = {
  'Googlebot': { must: true, why: 'Vyhladavanie Google. Bez neho nie si v Google vobec.' },
  'Bingbot': { must: true, why: 'Bing, a s nim Copilot a DuckDuckGo. Copilot bez Bing indexu stranku nevidi, ani s priamym odkazom (overene 12.9.2026).' },
  'OAI-SearchBot (OpenAI)': { must: true, why: 'Index pre vyhladavanie v ChatGPT. Rozhoduje, ci ta ChatGPT odcituje.' },
  'ChatGPT-User (OpenAI)': { must: true, why: 'Nacitanie nazivo pre pouzivatela ChatGPT. V nasom teste ale ChatGPT prisiel ako curl.' },
  'Claude-SearchBot (Anthropic)': { must: true, why: 'Index pre vyhladavanie v Claude.' },
  'Claude-User (Anthropic)': { must: true, why: 'Nacitanie nazivo pre pouzivatela Claude.' },
  'PerplexityBot': { must: true, why: 'Index Perplexity. Bez neho Perplexity stranku nenacita ani s priamym odkazom (overene 12.9.2026).' },
  'Perplexity-User': { must: true, why: 'Nacitanie nazivo pre pouzivatela Perplexity.' },
  'SeznamBot': { must: false, why: 'Seznam.cz, pre cesky a slovensky trh stale podstatny.' },
  'Applebot': { must: false, why: 'Siri a Spotlight na iPhonoch.' },
  'DuckDuckBot': { must: false, why: 'Vlastny robot DuckDuckGo. Hlavny index berie z Bingu.' },
  'GPTBot (OpenAI)': { must: false, why: 'Trenovanie modelov OpenAI. Blokovanie neovplyvni, ci ta ChatGPT najde.' },
  'ClaudeBot (Anthropic)': { must: false, why: 'Trenovanie modelov Anthropic.' },
  'Google-Extended (Gemini)': { must: false, why: 'Trenovanie Gemini. Neovplyvnuje vyhladavanie Google. Je to hlavne token pre robots.txt, stahuje Googlebot.' },
  'Applebot-Extended': { must: false, why: 'Trenovanie AI od Apple. Neovplyvnuje Siri ani Spotlight.' },
  'CCBot (Common Crawl)': { must: false, why: 'Verejny archiv, z ktoreho cerpa mnozstvo AI modelov.' },
  'Bytespider (ByteDance)': { must: false, why: 'ByteDance / TikTok. Povestne agresivny.' },
  'Meta-ExternalAgent': { must: false, why: 'Trenovanie AI od Meta.' },
  'Amazonbot': { must: false, why: 'Alexa a nakupny asistent Rufus.' }
};

/** Crawlers worth checking for even when they never showed up. */
export const EXPECTED = Object.entries(ROLES)
  .filter(([, role]) => role.must)
  .map(([name]) => name)
  .concat(['SeznamBot', 'Applebot', 'GPTBot (OpenAI)', 'ClaudeBot (Anthropic)', 'CCBot (Common Crawl)']);

const BROWSER = /(chrome|crios|safari|firefox|fxios|edg|opr|opera)\//i;

export function identify(userAgent) {
  const ua = (userAgent || '').trim();
  if (!ua) return { name: '(bez User-Agenta)', category: 'generic', purpose: null, named: false };

  for (const [pattern, name, category, purpose] of SIGNATURES) {
    if (pattern.test(ua)) return { name, category, purpose: purpose || null, named: true };
  }
  if (GENERIC.test(ua)) {
    const match = ua.match(/([A-Za-z0-9_.-]{2,30}(?:bot|crawler|spider|scraper|fetcher))/i);
    return { name: match ? match[1] : 'Neznamy bot', category: 'generic', purpose: null, named: false };
  }
  if (BROWSER.test(ua)) return { name: ua, category: 'browser', purpose: null, named: false };
  return { name: ua.slice(0, 80), category: 'generic', purpose: null, named: false };
}

export function chromeMajor(userAgent) {
  const match = (userAgent || '').match(/Chrome\/(\d+)\./);
  return match ? Number(match[1]) : 0;
}
