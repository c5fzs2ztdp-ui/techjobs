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
function getLocalJobs(): SavedJob[] {
  const data = localStorage.getItem(SAVED_JOBS_KEY);
  return data ? JSON.parse(data) : [];
}

function setLocalJobs(jobs: SavedJob[]): void {
  localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(jobs));
}

function getLocalCompanies(): Company[] {
  const data = localStorage.getItem(COMPANIES_KEY);
  return data ? JSON.parse(data) : [];
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
        return await response.json();
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
        // Not authenticated - use localStorage
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
 * Upload guest saves/applies to the account before the UI switches to
 * account storage. Retry-safe: the server deduplicates by URL (a 409 counts
 * as uploaded), applied dates/comments are preserved, and records whose
 * upload failed stay in localStorage for the next reconciliation attempt.
 */
export async function reconcileGuestSavedJobs(): Promise<void> {
  const local = getLocalJobs();
  if (local.length === 0) return;
  const remaining: SavedJob[] = [];
  for (const job of local) {
    try {
      // The server assigns its own id/created_date; everything else
      // (including applied state, dates and comments) is preserved.
      const record: Omit<SavedJob, 'id' | 'created_date'> = {
        job_title: job.job_title,
        company: job.company,
        category: job.category,
        city: job.city,
        url: job.url,
        level: job.level,
        size: job.size,
        job_category: job.job_category,
        applied: job.applied,
        applied_date: job.applied_date,
        comments: job.comments,
      };
      const response = await fetch(`${API_BASE_URL}/saved-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(record),
      });
      // 2xx: uploaded. 409: the account already has this URL - dedupe, drop the copy.
      if (!response.ok && response.status !== 409) {
        remaining.push(job);
      }
    } catch {
      remaining.push(job); // network failure - keep for next time
    }
  }
  if (remaining.length === 0) {
    localStorage.removeItem(SAVED_JOBS_KEY);
  } else {
    setLocalJobs(remaining);
  }
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
