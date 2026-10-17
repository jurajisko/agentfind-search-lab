/**
 * Checks a crawler's claimed identity against the IP ranges its operator
 * publishes.
 *
 * A User-Agent is only a claim: the nginx logs of a colleague's e-shops showed
 * a botnet of 139 000 addresses sending a perfect Chrome identity. The
 * operators listed in RANGE_SOURCES publish the addresses their crawlers use,
 * so a request that names their crawler can be confirmed or exposed.
 *
 * The middleware stores only the outcome, never the address:
 *  - ip_check:    verified | spoofed | unlisted | client_side | unavailable,
 *                 or null when the agent names no crawler
 *  - ip_operator: whose published ranges contain the address, even when the
 *                 agent claims to be a browser. That is how an AI fetcher with
 *                 a browser User-Agent becomes visible.
 *
 * Pure functions apart from loadRanges, which takes fetch as an argument.
 */

const GOOGLE = 'https://developers.google.com/static/search/apis/ipranges';
export const RANGE_SOURCES = {
  openai: ['https://openai.com/gptbot.json', 'https://openai.com/searchbot.json', 'https://openai.com/chatgpt-user.json'],
  anthropic: ['https://claude.com/crawling/bots.json'],
  perplexity: ['https://www.perplexity.com/perplexitybot.json', 'https://www.perplexity.com/perplexity-user.json'],
  google: [`${GOOGLE}/googlebot.json`, `${GOOGLE}/special-crawlers.json`, `${GOOGLE}/user-triggered-fetchers.json`, `${GOOGLE}/user-triggered-fetchers-google.json`],
  microsoft: ['https://www.bing.com/toolbox/bingbot.json'],
  apple: ['https://search.developer.apple.com/applebot.json'],
  duckduckgo: ['https://duckduckgo.com/duckduckbot.json'],
  commoncrawl: ['https://index.commoncrawl.org/ccbot.json']
};

// Crawler names as middleware.js reports them, mapped to their operator.
// A name missing here belongs to an operator that publishes no ranges.
export const OPERATOR_OF = {
  Googlebot: 'google', 'Google-Extended': 'google', GoogleOther: 'google',
  Bingbot: 'microsoft',
  'OAI-SearchBot': 'openai', 'ChatGPT-User': 'openai', GPTBot: 'openai',
  PerplexityBot: 'perplexity', 'Perplexity-User': 'perplexity',
  'Claude-SearchBot': 'anthropic', 'Claude-User': 'anthropic', ClaudeBot: 'anthropic', 'Anthropic-AI': 'anthropic',
  Applebot: 'apple', 'Applebot-Extended': 'apple',
  DuckDuckBot: 'duckduckgo',
  CCBot: 'commoncrawl'
};

function parseIpv4(text) {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = (value << 8n) | BigInt(part);
  }
  return value;
}

/** { version: 4 | 6, value: BigInt }, or null. IPv4-mapped IPv6 counts as IPv4. */
export function parseIp(text) {
  const ip = String(text || '').trim();
  if (ip.includes('.') && !ip.includes(':')) {
    const value = parseIpv4(ip);
    return value === null ? null : { version: 4, value };
  }
  if (!ip.includes(':')) return null;
  let head = ip;
  let tail = [];
  // An embedded IPv4 address takes the last two groups.
  const v4 = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const value = parseIpv4(v4[2]);
    if (value === null) return null;
    head = v4[1].endsWith('::') ? v4[1] : v4[1].slice(0, -1);
    tail = [(value >> 16n).toString(16), (value & 0xffffn).toString(16)];
  }
  const halves = head.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = [...(halves.length === 2 && halves[1] ? halves[1].split(':') : []), ...tail];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...right];
  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    value = (value << 16n) | BigInt(`0x${group}`);
  }
  if (value >> 32n === 0xffffn) return { version: 4, value: value & 0xffffffffn };
  return { version: 6, value };
}

/** { version, network, bits } with host bits cleared, or null. */
export function parseCidr(text) {
  const [address, length] = String(text || '').split('/');
  const ip = parseIp(address);
  if (!ip) return null;
  const width = ip.version === 4 ? 32 : 128;
  const bits = length === undefined ? width : Number(length);
  if (!Number.isInteger(bits) || bits < 0 || bits > width) return null;
  const shift = BigInt(width - bits);
  return { version: ip.version, network: (ip.value >> shift) << shift, bits };
}

export function inCidr(ip, cidr) {
  if (!ip || !cidr || ip.version !== cidr.version) return false;
  const shift = BigInt((ip.version === 4 ? 32 : 128) - cidr.bits);
  return (ip.value >> shift) << shift === cidr.network;
}

/** CIDRs from the { prefixes: [{ ipv4Prefix | ipv6Prefix }] } format all operators use. */
export function rangesFrom(json) {
  const prefixes = Array.isArray(json?.prefixes) ? json.prefixes : [];
  return prefixes.map(p => parseCidr(p.ipv4Prefix || p.ipv6Prefix)).filter(Boolean);
}

/** Every operator whose published ranges contain the address. */
export function operatorsFor(ipText, index) {
  const ip = parseIp(ipText);
  if (!ip || !index) return [];
  return [...index].filter(([, cidrs]) => cidrs.some(cidr => inCidr(ip, cidr))).map(([operator]) => operator);
}

/**
 * Outcome for one request. crawlerName is the claim from the User-Agent,
 * operators the result of operatorsFor, index the loaded ranges.
 */
export function verdict({ crawlerName, userAgent = '', operators = [], index }) {
  if (!crawlerName) return null;
  // Claude Code fetches from the user's own computer, so its address is never
  // Anthropic's. That is the documented behaviour, not a forgery.
  if (crawlerName === 'Claude-User' && /claude-code/i.test(userAgent)) return 'client_side';
  const operator = OPERATOR_OF[crawlerName];
  if (!operator) return 'unlisted';
  if (!index || !index.has(operator)) return 'unavailable';
  return operators.includes(operator) ? 'verified' : 'spoofed';
}

/**
 * What the middleware stores for one request. Ranges of two operators can
 * overlap on shared clouds, so the claimed operator wins when it matches.
 */
export function ipFacts({ crawlerName, userAgent, ip, index }) {
  const operators = operatorsFor(ip, index);
  const claimed = OPERATOR_OF[crawlerName];
  return {
    ip_operator: operators.includes(claimed) ? claimed : (operators[0] ?? null),
    ip_check: ip ? verdict({ crawlerName, userAgent, operators, index }) : (crawlerName ? 'unavailable' : null)
  };
}

/**
 * Fetches every operator's ranges. An operator whose lists did not all load
 * is left out, so its crawlers come out "unavailable", never falsely "spoofed".
 */
export async function loadRanges(fetchImpl, { timeoutMs = 2500 } = {}) {
  const index = new Map();
  await Promise.all(Object.entries(RANGE_SOURCES).map(async ([operator, urls]) => {
    try {
      const lists = await Promise.all(urls.map(async url => {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        const cidrs = rangesFrom(await response.json());
        if (!cidrs.length) throw new Error(`${url}: no prefixes`);
        return cidrs;
      }));
      index.set(operator, lists.flat());
    } catch {
      // Left out on purpose; see above.
    }
  }));
  return index;
}

/** The client address Vercel hands to middleware. */
export function clientIp(headers) {
  return headers.get('x-real-ip') || (headers.get('x-forwarded-for') || '').split(',')[0].trim() || '';
}
