// API client for backend service
// Falls back to localStorage if backend is unavailable or user is not authenticated

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface SavedJob {
  id: string;
  job_title: string;
  company: string;
  category?: string;
  city?: string;
  url: string;
  level?: string;
  size?: string;
  job_category?: string;
  applied?: boolean;
  applied_date?: string;
  comments?: string;
  created_date: string;
  /** Guest record whose upload to the account has not completed yet. */
  pending?: boolean;
  /**
   * Guest-only sync bookkeeping: the mergeable field values as of the last
   * successful upload to the account. Lets reconciliation tell "edited
   * locally after upload" (local edit wins) apart from "never uploaded"
   * (account copy wins ties). Stripped before any server payload.
   */
  lastUploaded?: { applied?: boolean; applied_date?: string; comments?: string };
}

export interface Company {
  id: string;
  name: string;
  description?: string;
  website_url?: string;
  logo_url?: string;
  founded_year?: string;
  headquarters?: string;
  growth_summary?: string;
  similar_companies?: string[];
}

// LocalStorage fallback keys
const SAVED_JOBS_KEY = 'techjobs_saved_jobs';
const COMPANIES_KEY = 'techjobs_companies';

// LocalStorage helpers
function readLocalJson<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt blob must not break every saved-jobs operation; back it up
    // for debugging and start clean.
    try { localStorage.setItem(`${key}_corrupt_backup`, data); } catch { /* quota */ }
    localStorage.removeItem(key);
    return [];
  }
}

function getLocalJobs(): SavedJob[] {
  return readLocalJson<SavedJob>(SAVED_JOBS_KEY);
}

function setLocalJobs(jobs: SavedJob[]): void {
  localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(jobs));
}

function getLocalCompanies(): Company[] {
  return readLocalJson<Company>(COMPANIES_KEY);
}

function setLocalCompanies(companies: Company[]): void {
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
}

// SavedJob operations
export const savedJobsApi = {
  list: async (sortBy?: string): Promise<SavedJob[]> => {
      try {
        const params = sortBy ? `?sort=${sortBy}` : '';
      const response = await fetch(`${API_BASE_URL}/saved-jobs${params}`, {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        // Not authenticated - use localStorage
        const jobs = getLocalJobs();
        if (sortBy === '-created_date') {
          return jobs.sort((a, b) => 
            new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
          );
        }
        return jobs;
      }
      
        if (!response.ok) throw new Error('Failed to fetch');
        const serverJobs: SavedJob[] = await response.json();
        // Guest records whose upload has not completed stay visible alongside
        // account saves, marked pending - otherwise a failed reconciliation
        // looks like "No saved jobs yet" after sign-in.
        const localJobs = getLocalJobs();
        const serverUrls = new Set(serverJobs.map((j) => j.url));
        const pending = localJobs
          .filter((j) => !serverUrls.has(j.url))
          .map((j) => ({ ...j, pending: true }));
        // A local record sharing a URL with an account row is an unresolved
        // duplicate (a failed conflict merge or an edit made after upload).
        // Flag the account row as pending too, so pendingCount, the banner
        // and the Retry sync action reflect the unsynced local details.
        const unresolvedUrls = new Set(
          localJobs.filter((j) => serverUrls.has(j.url)).map((j) => j.url),
        );
        return [
          ...pending,
          ...serverJobs.map((j) => (unresolvedUrls.has(j.url) ? { ...j, pending: true } : j)),
        ];
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const jobs = getLocalJobs();
    if (sortBy === '-created_date') {
      return jobs.sort((a, b) => 
        new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
      );
    }
    return jobs;
    }
  },

  create: async (job: Omit<SavedJob, 'id' | 'created_date'>): Promise<SavedJob> => {
      try {
        const response = await fetch(`${API_BASE_URL}/saved-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
          body: JSON.stringify(job)
        });
      
      if (response.status === 401) {
        // Not authenticated - use localStorage. Dedupe by URL: a rapid
        // double-save (before the list invalidates) must not create twins.
        const jobs = getLocalJobs();
        const existing = jobs.find((j) => j.url === job.url);
        if (existing) return existing;
        const newJob: SavedJob = {
          ...job,
          id: crypto.randomUUID(),
          created_date: new Date().toISOString(),
        };
        jobs.push(newJob);
        setLocalJobs(jobs);
        return newJob;
      }
      
        if (!response.ok) {
          if (response.status === 409) {
            // Job already exists, find and return it
            const jobs = await savedJobsApi.list();
            const existing = jobs.find(j => j.url === job.url);
            if (existing) return existing;
          }
          throw new Error('Failed to create');
        }
        return await response.json();
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const jobs = getLocalJobs();
    const newJob: SavedJob = {
      ...job,
      id: crypto.randomUUID(),
      created_date: new Date().toISOString(),
    };
    jobs.push(newJob);
    setLocalJobs(jobs);
    return newJob;
    }
  },

  update: async (id: string, data: Partial<SavedJob>): Promise<SavedJob | null> => {
      try {
        const response = await fetch(`${API_BASE_URL}/saved-jobs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
          body: JSON.stringify(data)
        });
      
      if (response.status === 401) {
        // Not authenticated - use localStorage
        const jobs = getLocalJobs();
        const index = jobs.findIndex(j => j.id === id);
        if (index === -1) return null;
        jobs[index] = { ...jobs[index], ...data };
        setLocalJobs(jobs);
        return jobs[index];
      }
      
        if (!response.ok) throw new Error('Failed to update');
        return await response.json();
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const jobs = getLocalJobs();
    const index = jobs.findIndex(j => j.id === id);
    if (index === -1) return null;
    jobs[index] = { ...jobs[index], ...data };
    setLocalJobs(jobs);
    return jobs[index];
    }
  },

  delete: async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE_URL}/saved-jobs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
        });
      
      if (response.status === 401) {
        // Not authenticated - use localStorage
        const jobs = getLocalJobs();
        const filtered = jobs.filter(j => j.id !== id);
        if (filtered.length === jobs.length) return false;
        setLocalJobs(filtered);
        return true;
      }
      
        if (!response.ok && response.status !== 404) throw new Error('Failed to delete');
        if (response.status === 404) {
          // Unknown to the server: remove a pending local record if it is one.
          const jobs = getLocalJobs();
          const filtered = jobs.filter(j => j.id !== id);
          if (filtered.length < jobs.length) { setLocalJobs(filtered); return true; }
        }
        return response.ok;
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const jobs = getLocalJobs();
    const filtered = jobs.filter(j => j.id !== id);
    if (filtered.length === jobs.length) return false;
    setLocalJobs(filtered);
    return true;
    }
  },

  findByUrl: async (url: string): Promise<SavedJob | undefined> => {
    const jobs = await savedJobsApi.list();
    return jobs.find(j => j.url === url);
  }
};

/**
 * On a duplicate URL (409), merge the guest's application details into the
 * existing account record: applied=true wins, dates and comments fill gaps.
 * Returns true once the account durably reflects the guest's state (or has
 * nothing to gain), false when the merge could not complete.
 */
async function mergeGuestDetailsIntoAccount(guest: SavedJob): Promise<boolean> {
  try {
    const listResponse = await fetch(`${API_BASE_URL}/saved-jobs`, {
      credentials: 'include',
    });
    if (!listResponse.ok) return false;
    const accountJobs: SavedJob[] = await listResponse.json();
    const existing = accountJobs.find((j) => j.url === guest.url);
    if (!existing) return true; // raced delete - nothing to preserve into
    // A field changed locally since the last successful upload is an
    // unresolved edit and wins over the account copy (including clearing a
    // comment or unmarking an application). A field that was never uploaded
    // keeps the conservative gap-fill: the account's own value is never
    // clobbered by stale guest data.
    const last = guest.lastUploaded ?? {};
    const dirty = {
      applied: 'applied' in last && guest.applied !== last.applied,
      applied_date: 'applied_date' in last && guest.applied_date !== last.applied_date,
      comments: 'comments' in last && guest.comments !== last.comments,
    };
    const merged: Partial<SavedJob> = {};
    if (dirty.applied ? true : guest.applied && !existing.applied) merged.applied = guest.applied;
    if (dirty.applied_date ? true : guest.applied_date && !existing.applied_date) merged.applied_date = guest.applied_date;
    if (dirty.comments ? true : guest.comments && !existing.comments) merged.comments = guest.comments;
    if (Object.keys(merged).length === 0) return true;
    const updateResponse = await fetch(`${API_BASE_URL}/saved-jobs/${existing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(merged),
    });
    return updateResponse.ok;
  } catch {
    return false;
  }
}

/**
 * Upload guest saves/applies to the account before the UI switches to
 * account storage. Retry-safe: the server deduplicates by URL (a 409 counts
 * as uploaded), applied dates/comments are preserved, and records whose
 * upload failed stay in localStorage for the next reconciliation attempt.
 */
// Sync metadata must not take part in the before/after upload comparison.
function stripSyncMeta(job: SavedJob): Omit<SavedJob, 'lastUploaded'> {
  const { lastUploaded, ...rest } = job;
  void lastUploaded;
  return rest;
}

// Login, the Saved Jobs page and the Retry sync action can all trigger a
// reconciliation at the same time. Two overlapping runs interleave their
// localStorage reads/writes; sharing one in-flight run keeps them convergent.
let reconcileInFlight: Promise<number> | null = null;

export function reconcileGuestSavedJobs(): Promise<number> {
  if (reconcileInFlight) return reconcileInFlight;
  reconcileInFlight = doReconcileGuestSavedJobs().finally(() => {
    reconcileInFlight = null;
  });
  return reconcileInFlight;
}

async function doReconcileGuestSavedJobs(): Promise<number> {
  const local = getLocalJobs();
  if (local.length === 0) return 0;
  const remaining: SavedJob[] = [];
  // Records uploaded this run: id -> JSON snapshot of what was uploaded.
  const uploadedSnapshots = new Map<string, string>();
  for (const job of local) {
    // Recheck the live record before uploading each queued item: a delete
    // that landed while a previous upload was in flight wins, and the
    // deleted record must not be resurrected on the account.
    const current = getLocalJobs().find((j) => j.id === job.id);
    if (!current) continue;
    // The server assigns its own id/created_date; everything else
    // (including applied state, dates and comments) is preserved. Built
    // from the live record so edits made before this item's turn upload too.
    const record: Omit<SavedJob, 'id' | 'created_date'> = {
      job_title: current.job_title,
      company: current.company,
      category: current.category,
      city: current.city,
      url: current.url,
      level: current.level,
      size: current.size,
      job_category: current.job_category,
      applied: current.applied,
      applied_date: current.applied_date,
      comments: current.comments,
    };
    const snapshot = JSON.stringify(stripSyncMeta(current));
    try {
      const response = await fetch(`${API_BASE_URL}/saved-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(record),
      });
      // 2xx: uploaded. 409: the account already has this URL - merge the
      // guest's application details into the account record first, and only
      // then drop the local copy.
      if (!response.ok && response.status !== 409) {
        remaining.push(current);
        continue;
      }
      if (response.status === 409) {
        const merged = await mergeGuestDetailsIntoAccount(current);
        if (!merged) {
          remaining.push(current); // merge failed - keep for next time
          continue;
        }
      }
      // The user may have deleted this record while its own upload was in
      // flight: undo a fresh 2xx upload so the delete stays deleted.
      const stillLocal = getLocalJobs().find((j) => j.id === job.id);
      if (!stillLocal) {
        if (response.ok) {
          const created: SavedJob | null = await response.json().catch(() => null);
          if (created?.id) {
            await fetch(`${API_BASE_URL}/saved-jobs/${created.id}`, {
              method: 'DELETE',
              credentials: 'include',
            }).catch(() => {});
          }
        }
        continue;
      }
      uploadedSnapshots.set(job.id, snapshot);
      // Remember what the account now holds so the next reconciliation can
      // tell a later local edit apart from never-uploaded guest data.
      const stamped = getLocalJobs().map((j) =>
        j.id === job.id
          ? { ...j, lastUploaded: { applied: record.applied, applied_date: record.applied_date, comments: record.comments } }
          : j,
      );
      setLocalJobs(stamped);
    } catch {
      remaining.push(current); // network failure - keep for next time
    }
  }
  // Preserve saves and edits made while the uploads were in flight.
  const next = getLocalJobs().filter(
    (job) => uploadedSnapshots.get(job.id) !== JSON.stringify(stripSyncMeta(job)),
  );
  if (next.length === 0) {
    localStorage.removeItem(SAVED_JOBS_KEY);
  } else {
    setLocalJobs(next);
  }
  return next.length;
}

// Company operations
export const companiesApi = {
  list: async (): Promise<Company[]> => {
      try {
      const response = await fetch(`${API_BASE_URL}/companies`, {
        credentials: 'include'
      });
        if (!response.ok) throw new Error('Failed to fetch');
        return await response.json();
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
      return getLocalCompanies();
    }
  },

  get: async (name: string): Promise<Company | undefined> => {
      try {
      const response = await fetch(`${API_BASE_URL}/companies/by-name/${encodeURIComponent(name)}`, {
        credentials: 'include'
      });
        if (response.status === 404) return undefined;
        if (!response.ok) throw new Error('Failed to fetch');
        return await response.json();
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const companies = getLocalCompanies();
    return companies.find(c => c.name === name);
    }
  },

  create: async (company: Omit<Company, 'id'>): Promise<Company> => {
      try {
        const response = await fetch(`${API_BASE_URL}/companies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
          body: JSON.stringify(company)
        });
        if (!response.ok) throw new Error('Failed to create');
        return await response.json();
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const companies = getLocalCompanies();
    const newCompany: Company = {
      ...company,
      id: crypto.randomUUID(),
    };
    companies.push(newCompany);
    setLocalCompanies(companies);
    return newCompany;
    }
  },

  upsert: async (name: string, data: Partial<Company>): Promise<Company> => {
      try {
        const response = await fetch(`${API_BASE_URL}/companies/by-name/${encodeURIComponent(name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to upsert');
        return await response.json();
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const companies = getLocalCompanies();
    const index = companies.findIndex(c => c.name === name);
    
    if (index === -1) {
      const newCompany: Company = {
        id: crypto.randomUUID(),
        name,
        ...data
      };
      companies.push(newCompany);
      setLocalCompanies(companies);
      return newCompany;
    }
    
    companies[index] = { ...companies[index], ...data };
    setLocalCompanies(companies);
    return companies[index];
    }
  }
};
