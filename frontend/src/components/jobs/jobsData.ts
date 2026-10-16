// Job data for TechJobsIL - sourced exclusively from the techjob_map pipeline
// (halleelyasaf/techjob_map). A scheduled workflow in this repo converts the
// latest data/jobs.json into the payload on the `data` branch; the frontend
// fetches it straight from raw.githubusercontent.com, so data updates never
// require a site redeploy.
export const JOBS_DATA_URL =
  'https://raw.githubusercontent.com/c5fzs2ztdp-ui/techjobs/data/jobs.json';

// Full techjob_map 21-field schema plus site-specific derived fields.
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
  jobId: string | null;
  jobCode: string | null;
  source: string | null;
  verification: string | null;
  verifiedAt: string | null;
  firstSeenAt: string | null;
  lastRefreshAttemptAt: string | null;
  lastRefreshError: string | null;
  refreshState: string | null;
  region: string | null;         // region slug (tel-aviv-gush-dan | sharon | center | shfela | jerusalem | haifa-krayot | north | south | negev | judea-samaria)
  locationSource: 'city' | 'location' | 'title' | 'company-site' | null;
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
  jobs: Job[];
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

export async function fetchJobsPayload(): Promise<JobsPayload> {
  const response = await fetch(JOBS_DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs data (${response.status})`);
  }
  return (await response.json()) as JobsPayload;
}

export async function fetchAllJobs(): Promise<Job[]> {
  const payload = await fetchJobsPayload();
  const jobs = payload.jobs || [];
  // Sort by updated date (newest first), undated jobs last
  return jobs.sort((a, b) => {
    const ta = a.updated ? new Date(a.updated).getTime() : 0;
    const tb = b.updated ? new Date(b.updated).getTime() : 0;
    return tb - ta;
  });
}
