// Job data for TechJobsIL. The frontend fetches a JSON payload (produced by
// scripts/convert_jobs.mjs) straight from a plain URL - see VITE_JOBS_DATA_URL
// in the README - so data updates never require a site redeploy.
export const JOBS_DATA_URL =
  (import.meta.env.VITE_JOBS_DATA_URL as string) ||
  'https://raw.githubusercontent.com/c5fzs2ztdp-ui/techjobs/data/jobs.json';

// Renderer-facing fields from the techjob_map 21-field schema (ops/provenance fields stay in the dataset) plus site-specific derived fields.
export interface Job {
  company: string;
  title: string;
  location: string | null;
  url: string;
  city: string | null;           // canonical English city (normalized)
  department: string | null;
  description: string | null;
  employmentType: 'full-time' | 'part-time' | 'student' | 'intern' | 'temp' | 'contract' | null;
  workModel: 'remote' | 'hybrid' | 'on-site' | null;
  seniority: 'intern' | 'junior' | 'senior' | 'staff' | 'principal' | 'lead' | 'manager' | null;
  technologies: string[];
  postedAt: string | null;
  firstSeenAt: string | null;
  closedAt: string | null;       // set when the row is a closed tombstone (refreshState 'closed')
  refreshState: string | null;
  region: string | null;         // region slug (tel-aviv-gush-dan | sharon | center | shfela | jerusalem | haifa-krayot | north | south | negev | judea-samaria)
  cities: string[];              // all canonical cities (multi-location jobs)
  regions: string[];             // all regions matching `cities`
  // derived for the site
  cityHe: string | null;         // Hebrew display name when known
  job_category: string;          // role category derived from the title
  updated: string | null;        // postedAt || verifiedAt || firstSeenAt
}

export interface JobsPayload {
  updatedAt: string;
  count: number;
  /** Versioned contract with the publisher (scripts/convert_jobs.mjs). */
  schemaVersion?: number;
  cityLabels?: Record<string, string>;
  jobs: Job[];
}

/** Closed tombstone: the owning source verified the posting is gone. */
export function isClosed(job: Job): boolean {
  return job.refreshState === 'closed';
}

/** First seen today (Asia/Jerusalem) - drives the "New" badge. */
export function isNewToday(job: Job): boolean {
  if (!job.firstSeenAt) return false;
  const seen = new Date(job.firstSeenAt);
  if (Number.isNaN(seen.getTime())) return false;
  const dayInIsrael = (d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  return dayInIsrael(seen) === dayInIsrael(new Date());
}

/** Best human-readable city label: Hebrew when known, else English, else raw location. */
export function displayCity(job: Job): string {
  return job.cityHe || job.city || job.location || '';
}

export const REGION_LABELS: Record<string, string> = {
  'tel-aviv-gush-dan': 'תל אביב וגוש דן',
  sharon: 'השרון',
  center: 'מרכז',
  shfela: 'שפלה',
  jerusalem: 'ירושלים והסביבה',
  'haifa-krayot': 'חיפה והקריות',
  north: 'צפון',
  south: 'דרום',
  negev: 'נגב',
  'judea-samaria': 'יהודה ושומרון',
};

export const CATEGORY_LABELS: Record<string, string> = {
  software: 'Software',
  'data-ai': 'Data & AI',
  qa: 'QA',
  devops: 'DevOps & Infrastructure',
  security: 'Security',
  product: 'Product',
  design: 'Design',
  sales: 'Sales',
  marketing: 'Marketing',
  hr: 'HR',
  finance: 'Finance',
  'operations-logistics': 'Operations & Logistics',
  'customer-support': 'Customer Support',
  'hardware-electronics': 'Hardware & Electronics',
  'mechanical-manufacturing': 'Mechanical & Manufacturing',
  management: 'Management',
  admin: 'Admin',
  other: 'Other',
};

// The payload is published independently of the frontend deploy, so it is
// validated at the fetch boundary: a structurally incompatible response is
// rejected, and job records missing required renderer fields are dropped
// (with a warning) instead of crashing a card at render time.
export const JOBS_PAYLOAD_SCHEMA_VERSION = 1;

const REQUIRED_JOB_STRING_FIELDS = ['company', 'title', 'url', 'job_category'] as const;

// Optional renderer-facing fields are normalized, not just copied: a
// non-string scalar becomes null and arrays keep only string elements, so a
// malformed record renders as missing data instead of crashing a card
// (e.g. employmentType: 7 -> .replace crash, technologies: [{...}] ->
// invalid React child).
const OPTIONAL_STRING_FIELDS = [
  'location', 'city', 'department', 'description', 'employmentType', 'workModel',
  'seniority', 'postedAt', 'firstSeenAt', 'closedAt', 'refreshState', 'region',
  'cityHe', 'updated',
] as const;

// Bidi control characters can visually spoof rendered text (e.g. an RTL
// override reversing a title). They never belong in job data; strip them at
// the boundary rather than at every render site.
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// Enum and dictionary-key fields feed renderer lookups (workModelIcons,
// CATEGORY_LABELS, REGION_LABELS, cityLabels): a value like '__proto__'
// passes string-only validation but resolves through Object.prototype and
// crashes React when rendered. Restrict them to supported values here, at
// the boundary, so a malformed row degrades instead of taking down the page.
const EMPLOYMENT_TYPES = new Set(['full-time', 'part-time', 'student', 'intern', 'temp', 'contract']);
const WORK_MODELS = new Set(['remote', 'hybrid', 'on-site']);
const SENIORITIES = new Set(['intern', 'junior', 'senior', 'staff', 'principal', 'lead', 'manager']);
const KNOWN_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));

// A key that resolves through Object.prototype ('__proto__', 'toString',
// 'constructor', ...) poisons dictionary lookups at render time; real data
// never contains one. Unknown-but-ordinary values are harmless there (the
// lookups have fallbacks), so only inherited-property keys are rejected.
function isSafeLookupKey(value: string): boolean {
  return !(value in Object.prototype);
}

function cleanString(value: string): string {
  return value.replace(BIDI_CONTROLS, '');
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string').map(cleanString) : [];
}

export function parseJobsPayload(raw: unknown): JobsPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Incompatible jobs payload: expected an object envelope');
  }
  const envelope = raw as Record<string, unknown>;
  if (
    envelope.schemaVersion !== undefined &&
    envelope.schemaVersion !== JOBS_PAYLOAD_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported jobs payload schemaVersion: ${String(envelope.schemaVersion)}`);
  }
  if (!Array.isArray(envelope.jobs)) {
    throw new Error('Incompatible jobs payload: missing jobs array');
  }
  const jobs: Job[] = [];
  let dropped = 0;
  for (const record of envelope.jobs) {
    // A job url becomes a rendered href: anything but http(s) (e.g. a
    // javascript: URL smuggled into the feed) would be an XSS link, so a
    // bad-scheme record is dropped like any other malformed row.
    const url = (record as Record<string, unknown>)?.url;
    const valid =
      record !== null &&
      typeof record === 'object' &&
      REQUIRED_JOB_STRING_FIELDS.every(
        (f) => typeof (record as Record<string, unknown>)[f] === 'string',
      ) &&
      typeof url === 'string' &&
      /^https?:\/\//i.test(url);
    if (!valid) {
      dropped += 1;
      continue;
    }
    const rec: Record<string, unknown> = { ...(record as Record<string, unknown>) };
    for (const f of REQUIRED_JOB_STRING_FIELDS) {
      rec[f] = cleanString(rec[f] as string);
    }
    for (const f of OPTIONAL_STRING_FIELDS) {
      const v = rec[f];
      rec[f] = typeof v === 'string' && v !== '' ? cleanString(v) : null;
    }
    rec.technologies = stringArray(rec.technologies);
    // Dictionary lookups (cityLabels, REGION_LABELS) must never resolve an
    // inherited property, so drop prototype-polluting city/region values.
    rec.cities = stringArray(rec.cities).filter(isSafeLookupKey);
    rec.regions = stringArray(rec.regions).filter(isSafeLookupKey);
    if (rec.region !== null && !isSafeLookupKey(rec.region as string)) rec.region = null;
    if (rec.employmentType !== null && !EMPLOYMENT_TYPES.has(rec.employmentType as string)) rec.employmentType = null;
    if (rec.workModel !== null && !WORK_MODELS.has(rec.workModel as string)) rec.workModel = null;
    if (rec.seniority !== null && !SENIORITIES.has(rec.seniority as string)) rec.seniority = null;
    // An unknown category stays visible under 'other' instead of crashing
    // the card's CATEGORY_LABELS lookup.
    if (!KNOWN_CATEGORIES.has(rec.job_category as string)) rec.job_category = 'other';
    jobs.push(rec as unknown as Job);
  }
  if (dropped > 0) {
    console.warn(`Jobs payload: dropped ${dropped} record(s) missing required fields`);
  }
  // cityLabels is renderer-facing: only string values are admitted.
  const rawCityLabels = envelope.cityLabels;
  const cityLabels: Record<string, string> =
    rawCityLabels && typeof rawCityLabels === 'object' && !Array.isArray(rawCityLabels)
      ? Object.fromEntries(
          Object.entries(rawCityLabels)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
            .map(([k, v]) => [k, cleanString(v)]),
        )
      : {};
  return { ...(envelope as unknown as JobsPayload), cityLabels, jobs };
}

let inflightPayload: Promise<JobsPayload> | null = null;

export function fetchJobsPayload(): Promise<JobsPayload> {
  // Share one in-flight request so concurrent callers (jobs list, city
  // labels) don't each fetch and parse the whole payload. Settled promises
  // are cleared so react-query refetches still hit the network.
  if (!inflightPayload) {
    inflightPayload = (async () => {
      const response = await fetch(JOBS_DATA_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs data (${response.status})`);
      }
      return parseJobsPayload(await response.json());
    })().finally(() => {
      inflightPayload = null;
    });
  }
  return inflightPayload;
}

/** Shared react-query key for the payload. Every page derives its view from
 *  this one cache entry (via select), so navigating between Home, Jobs,
 *  Companies and the map never refetches or reparses the same snapshot. */
export const JOBS_PAYLOAD_QUERY_KEY = ['jobsPayload'] as const;

export function selectCityLabels(payload: JobsPayload): Record<string, string> {
  return payload.cityLabels || {};
}

export function sortJobs(jobs: Job[]): Job[] {
  // English-titled jobs first, then Hebrew-titled; newest first within each
  // group, undated jobs last inside their group. Copies before sorting - the
  // cached payload is shared across pages and must not be mutated.
  const langGroup = (title: string | null): number => {
    const m = (title || '').match(/[A-Za-zא-ת]/);
    return m && /[א-ת]/.test(m[0]) ? 1 : 0;
  };
  return [...jobs].sort((a, b) => {
    const g = langGroup(a.title) - langGroup(b.title);
    if (g !== 0) return g;
    const ta = a.updated ? new Date(a.updated).getTime() : 0;
    const tb = b.updated ? new Date(b.updated).getTime() : 0;
    return tb - ta;
  });
}

export function selectSortedJobs(payload: JobsPayload): Job[] {
  return sortJobs(payload.jobs || []);
}

export async function fetchCityLabels(): Promise<Record<string, string>> {
  return selectCityLabels(await fetchJobsPayload());
}

export async function fetchAllJobs(): Promise<Job[]> {
  return selectSortedJobs(await fetchJobsPayload());
}
