// Company logo fetcher: resolves each feed company's own domain (from the
// techjob_map source registry and the feed's job URLs), downloads its
// favicon/apple-touch-icon, and stores small logo files under
// frontend/public/logos/ with a manifest mapping company name -> file.
//
// Legal/reliability notes:
// - Only the company's own domain is fetched (favicon endpoints are public
//   assets served for exactly this purpose). No third-party logo APIs.
// - Polite: low concurrency, small inter-request delay, one attempt per
//   candidate path, short timeouts.
// - Unresolvable/unfetchable companies are simply absent from the manifest;
//   the UI falls back to the initial-letter avatar.
//
// Usage: node scripts/fetch_logos.mjs [feed.json] [source_registry.json]
// Defaults: feed from the published data branch; registry from a sibling
// techjob_map checkout (LOGO_REGISTRY env var overrides).

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const FEED_URL = 'https://raw.githubusercontent.com/c5fzs2ztdp-ui/techjobs/data/jobs.json';
const OUT_DIR = new URL('../frontend/public/logos/', import.meta.url).pathname;
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const CONCURRENCY = 4;
const DELAY_MS = 250;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024; // skip absurdly large "favicons"

const ATS_HOSTS = [
  'lever.co', 'greenhouse.io', 'workday', 'myworkdayjobs', 'comeet.com', 'comeet.co',
  'workable', 'smartrecruiters', 'ashby', 'oraclecloud', 'successfactors',
  'eightfold', 'phenom', 'jobvite', 'icims', 'amazon.jobs', 'taleo', 'brassring',
  'ultipro', 'recruitee', 'teamtailor', 'bamboohr', 'hirebridge', 'jobs.', 'careers.',
];

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function hostOf(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
}
function ownDomain(u) {
  const h = hostOf(u);
  if (!h) return null;
  if (ATS_HOSTS.some((a) => h.includes(a))) return null;
  return h;
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'TechJobsIL logo fetcher (favicon only)', ...opts.headers },
    });
  } finally { clearTimeout(t); }
}

// Candidate logo paths, best quality first.
const CANDIDATES = [
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/favicon-32x32.png',
  '/favicon.png',
  '/favicon.svg',
  '/favicon.ico',
];

function sniffExt(p, buf) {
  if (p.endsWith('.png') && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  if (p.endsWith('.svg') && buf.slice(0, 256).toString('latin1').includes('<svg')) return 'svg';
  if (p.endsWith('.ico') && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return 'ico';
  return null;
}

async function tryUrl(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 3000)); return 'retry'; }
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').toLowerCase();
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return null;
    if (!/image|octet-stream|icon|svg/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100 || buf.length > MAX_BYTES) return null;
    const ext = sniffExt(url.split('?')[0], buf);
    if (!ext) return null;
    return { buf, ext };
  } catch { return null; }
}

// Parse the homepage for <link rel="...icon..."> hrefs (covers sites that
// keep icons off the default paths, including SVG-only sites).
async function homepageIconUrls(domain) {
  try {
    const res = await fetchWithTimeout(`https://${domain}/`);
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 300000);
    const urls = [];
    const re = /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const tag = m[0];
      const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
      if (!href || href.startsWith('data:')) continue;
      // Prefer larger icons: put sizes >= 96 or apple-touch first
      const size = Number((tag.match(/sizes=["'](\d+)x/i) || [])[1] || 0);
      urls.push({ href, size });
      if (/apple-touch/i.test(tag)) urls[urls.length - 1].size = Math.max(urls[urls.length - 1].size, 180);
    }
    return urls
      .sort((a, b) => b.size - a.size)
      .map((u) => new URL(u.href, `https://${domain}/`).href)
      .filter((u) => /\.(png|svg|ico)(\?|$)/i.test(u))
      .slice(0, 3);
  } catch { return []; }
}

async function fetchLogo(domain) {
  const hosts = domain.startsWith('www.') ? [domain] : [domain, `www.${domain}`];
  for (const host of hosts) {
    // 1. homepage-declared icons (best quality signal)
    for (const url of await homepageIconUrls(host)) {
      const r = await tryUrl(url);
      if (r === 'retry') { const r2 = await tryUrl(url); if (r2 && r2 !== 'retry') return r2; }
      else if (r) return r;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    // 2. conventional paths
    for (const p of CANDIDATES) {
      const r = await tryUrl(`https://${host}${p}`);
      if (r === 'retry') { const r2 = await tryUrl(`https://${host}${p}`); if (r2 && r2 !== 'retry') return r2; }
      else if (r) return r;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  return null;
}

async function main() {
  const feedArg = process.argv[2];
  const registryArg = process.argv[3] || process.env.LOGO_REGISTRY || '/home/sandbox/techjob_map/sources/source_registry.json';

  let feed;
  if (feedArg) feed = JSON.parse(await readFile(feedArg, 'utf8'));
  else {
    const res = await fetchWithTimeout(FEED_URL);
    if (!res.ok) throw new Error(`feed fetch HTTP ${res.status}`);
    feed = await res.json();
  }
  const rows = Array.isArray(feed) ? feed : feed.jobs;
  const companies = [...new Set(rows.map((j) => j.company).filter(Boolean))].sort();
  console.log(`companies in feed: ${companies.length}`);

  const registry = existsSync(registryArg) ? JSON.parse(await readFile(registryArg, 'utf8')) : {};
  const byNorm = new Map();
  for (const [key, s] of Object.entries(registry)) {
    if (!s || typeof s !== 'object') continue;
    const name = s.company || key;
    for (const k of [norm(name), norm(key)]) if (k && !byNorm.has(k)) byNorm.set(k, s);
  }

  // Resolve a candidate own-domain per company.
  const jobDomainVotes = new Map(); // company -> Map(domain -> count)
  for (const j of rows) {
    const d = ownDomain(j.url || '');
    if (!d || !j.company) continue;
    if (!jobDomainVotes.has(j.company)) jobDomainVotes.set(j.company, new Map());
    const m = jobDomainVotes.get(j.company);
    m.set(d, (m.get(d) || 0) + 1);
  }

  const targets = new Map(); // company -> domain
  let unresolved = [];
  for (const c of companies) {
    const domains = [];
    const s = byNorm.get(norm(c));
    if (s) {
      for (const f of ['websiteUrl', 'careersUrl']) {
        const d = ownDomain(s[f] || '');
        if (d) domains.push(d);
      }
    }
    const votes = jobDomainVotes.get(c);
    if (votes) domains.push([...votes.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    if (domains.length) {
      // prefer the most-voted/registry domain; strip leading www.
      targets.set(c, domains[0].replace(/^www\./, ''));
    } else unresolved.push(c);
  }
  console.log(`domains resolved: ${targets.size}, unresolved: ${unresolved.length}`);

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = {};
  let done = 0, got = 0;
  const queue = [...targets.entries()];
  async function worker() {
    while (queue.length) {
      const [company, domain] = queue.shift();
      const logo = await fetchLogo(domain);
      if (logo) {
        const file = `${slugify(company)}.${logo.ext}`;
        await writeFile(path.join(OUT_DIR, file), logo.buf);
        manifest[company] = file;
        got++;
      } else {
        console.log(`miss - ${company} (${domain})`);
      }
      if (++done % 50 === 0) console.log(`progress ${done}/${targets.size}, got ${got}`);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const manifestJson = JSON.stringify(manifest, null, 1) + '\n';
  await writeFile(MANIFEST, manifestJson);
  // Static import copy for the frontend bundle (CompanyLogo.tsx).
  await writeFile(new URL('../frontend/src/generated/companyLogos.json', import.meta.url), manifestJson);
  console.log(`DONE: ${got}/${companies.length} companies got a logo (${Math.round((100 * got) / companies.length)}%)`);
  console.log(`unresolved sample: ${unresolved.slice(0, 20).join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
