// Per-route SEO metadata: document title, meta description, Open Graph tags
// and canonical link, plus site-wide JSON-LD (Organization + WebSite).
// The SPA serves one static index.html for every route, so these tags must
// be synced client-side as the route changes (Google renders JavaScript).

const SITE_NAME = 'TechJobsIL';
const SITE_URL = 'https://techjobsil.com';
const DEFAULT_DESCRIPTION =
  "TechJobsIL - Find your dream job in Israeli tech. Discover opportunities at Israel's leading startups and tech companies.";

const PAGE_META: [RegExp, string, string][] = [
  [/^\/$/, 'TechJobsIL - Israeli Tech Jobs', DEFAULT_DESCRIPTION],
  [/^\/jobs/, 'Jobs - TechJobsIL',
    'Browse open tech jobs in Israel: software engineering, data, product, DevOps and more, refreshed hourly from company career pages.'],
  [/^\/companies/, 'Companies - TechJobsIL',
    'Explore Israeli tech companies that are hiring now and see their open positions.'],
  [/^\/company/, 'Company Profile - TechJobsIL',
    'Company profile and open positions at Israeli tech companies.'],
  [/^\/saved/, 'Saved Jobs - TechJobsIL', 'Your saved tech jobs.'],
  [/^\/map/, 'Jobs Map - TechJobsIL', 'See open tech jobs across Israel on a map.'],
  [/^\/privacy/, 'Privacy Policy - TechJobsIL', 'How TechJobsIL collects, uses and protects your data.'],
  [/^\/terms/, 'Terms of Service - TechJobsIL', 'The terms for using TechJobsIL.'],
  [/^\/accessibility/, 'Accessibility Statement - TechJobsIL', 'Accessibility statement for TechJobsIL.'],
];

const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      inLanguage: 'en',
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/techjobsil-logo-64.png`,
        width: 64,
        height: 64,
      },
    },
  ],
};

function setMetaContent(selector: string, value: string) {
  const tag = document.querySelector<HTMLMetaElement>(selector);
  if (tag) tag.content = value;
}

export function applyPageMeta(pathname: string, search: string) {
  const match = PAGE_META.find(([re]) => re.test(pathname));
  const title = match ? match[1] : 'Page Not Found - TechJobsIL';
  const description = match ? match[2] : DEFAULT_DESCRIPTION;

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);

  // index.html declares the homepage canonical, but the SPA serves
  // distinct pages at /jobs, /companies, /company, etc. Point the
  // canonical at the current route (keeping the company identifier) so
  // search engines don't collapse every page into "/".
  const company = pathname.startsWith('/company')
    ? new URLSearchParams(search).get('name')
    : null;
  const pageUrl =
    SITE_URL + (pathname === '/' ? '/' : pathname) +
    (company ? `?name=${encodeURIComponent(company)}` : '');
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = pageUrl;
  setMetaContent('meta[property="og:url"]', pageUrl);

  // Site-wide structured data, injected once.
  if (!document.getElementById('site-json-ld')) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'site-json-ld';
    script.textContent = JSON.stringify(SITE_JSON_LD);
    document.head.appendChild(script);
  }
}
