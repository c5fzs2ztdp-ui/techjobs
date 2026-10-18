// API client for backend service
// Falls back to localStorage if backend is unavailable or user is not authenticated

import { authApi } from './auth';

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
  // The account id this record was synced to. Pending sync data belongs to
  // that account: another sign-in on the same browser must not receive (or
  // clear) it. Absent on genuinely unclaimed guest saves.
  syncedTo?: string;
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

// Shared by the 401 and offline create fallbacks: dedupe by URL among
// UNCLAIMED guest records only - a record synced to an account is invisible
// to a logged-out guest and must not swallow their save.
function createLocalGuestSave(job: Omit<SavedJob, 'id' | 'created_date'>): SavedJob {
  const jobs = getLocalJobs();
  const existing = jobs.find((j) => j.url === job.url && !j.syncedTo);
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

// SavedJob operations
export const savedJobsApi = {
  list: async (sortBy?: string): Promise<SavedJob[]> => {
      try {
        const params = sortBy ? `?sort=${sortBy}` : '';
      const response = await fetch(`${API_BASE_URL}/saved-jobs${params}`, {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        // Not authenticated: show only unclaimed guest saves - a record
        // synced to an account must not surface after logout.
        const jobs = getLocalJobs().filter((j) => !j.syncedTo);
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
        // looks like "No saved jobs yet" after sign-in. The overlay is scoped
        // to this account: a record synced to a different account (an earlier
        // sign-in on this browser) must not leak its details or private
        // comments here. When the account cannot be resolved, only unclaimed
        // guest records overlay - synced records still show from the server.
        const accountId = await getAuthenticatedAccountId();
        const localJobs = getLocalJobs().filter(
          (j) => !j.syncedTo || (accountId !== null && j.syncedTo === accountId),
        );
        // A server row whose deletion is queued for this account stays
        // hidden until the retry confirms it, instead of resurrecting.
        const pendingDeletes = new Set(getPendingDeleteIds(accountId));
        const visibleServerJobs = serverJobs.filter((j) => !pendingDeletes.has(j.id));
        const serverUrls = new Set(visibleServerJobs.map((j) => j.url));
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
          ...visibleServerJobs.map((j) => (unresolvedUrls.has(j.url) ? { ...j, pending: true } : j)),
        ];
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    // Same scoping as the success path: unclaimed guest records plus records
    // owned by the current account; if the identity cannot be confirmed,
    // fall back to unclaimed records only.
    const accountId = await getAuthenticatedAccountId();
    const jobs = getLocalJobs().filter(
      (j) => !j.syncedTo || (accountId !== null && j.syncedTo === accountId),
    );
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
        // Not authenticated - dedupe against unclaimed guest records only.
        return createLocalGuestSave(job);
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
    // Same dedupe as the 401 path: an offline double-save must not twin.
    return createLocalGuestSave(job);
    }
  },

  // url lets a successful server-side update also sync a retained local
  // duplicate: the local copy takes the new values and is stamped
  // lastUploaded, so the next reconciliation does not treat it as a dirty
  // edit and overwrite the newer account state.
  update: async (id: string, data: Partial<SavedJob>, url?: string): Promise<SavedJob | null> => {
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
        if (url) {
          const accountId = await getAuthenticatedAccountId();
          const jobs = getLocalJobs();
          const index = jobs.findIndex((j) => j.url === url && canMirrorToRecord(j, accountId));
          if (index !== -1) {
            const merged = { ...jobs[index], ...data };
            const last = { ...(jobs[index].lastUploaded ?? {}) };
            for (const f of ['applied', 'applied_date', 'comments'] as const) {
              if (f in data) last[f] = data[f] as never;
            }
            jobs[index] = { ...merged, lastUploaded: last };
            setLocalJobs(jobs);
          }
        }
        return await response.json();
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const jobs = getLocalJobs();
    let index = jobs.findIndex(j => j.id === id);
    // The displayed account row carries the server id while a retained local
    // duplicate has a different id: fall back to the job URL so the edit is
    // retained locally for the next reconciliation instead of being lost.
    if (index === -1 && url) {
      const accountId = await getAuthenticatedAccountId();
      index = jobs.findIndex((j) => j.url === url && canMirrorToRecord(j, accountId));
    }
    if (index === -1) throw error; // nowhere to retain the edit - reject the mutation
    jobs[index] = { ...jobs[index], ...data };
    setLocalJobs(jobs);
    return jobs[index];
    }
  },

  // url lets a successful server-side delete also retire a retained local
  // duplicate of the same job (a failed conflict merge or a pre-upload
  // edit); without it the local copy would resurrect the save on the next
  // reconciliation.
  delete: async (id: string, url?: string): Promise<boolean> => {
      // Resolve the account BEFORE the request and bind the delete to it: a
      // session flip between this check and the server is rejected as
      // ACCOUNT_MISMATCH (and retried under this same account) instead of
      // deleting - or queueing the retry - under the wrong account.
      const accountId = await getAuthenticatedAccountId();
      try {
        const response = await fetch(`${API_BASE_URL}/saved-jobs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: accountId ? { 'X-Expected-User-Id': accountId } : undefined
        });

      if (response.status === 409 && await isAccountMismatch(response)) {
        // The session changed before the request arrived; nothing was
        // deleted. Queue the delete under the account it was resolved for.
        if (accountId) {
          rememberPendingDelete(accountId, id);
          return true;
        }
        return false;
      }

      if (response.status === 401) {
        // Not authenticated - use localStorage
        const jobs = getLocalJobs();
        const filtered = jobs.filter(j => j.id !== id);
        if (filtered.length === jobs.length) return false;
        setLocalJobs(filtered);
        return true;
      }
      
        if (!response.ok && response.status !== 404) throw new Error('Failed to delete');
        if (response.ok && url) {
          const jobs = getLocalJobs();
          const filtered = jobs.filter((j) => !(j.url === url && canMirrorToRecord(j, accountId)));
          if (filtered.length < jobs.length) setLocalJobs(filtered);
        }
        if (response.status === 404) {
          // Confirmed absent for this account (the header above makes the
          // 404 account-verified): remove a pending local record by id, and
          // any retained local duplicate of the same job by URL, or the
          // next reconciliation recreates the deleted save.
          const jobs = getLocalJobs();
          const filtered = jobs.filter((j) => j.id !== id && !(url && j.url === url && canMirrorToRecord(j, accountId)));
          if (filtered.length < jobs.length) { setLocalJobs(filtered); return true; }
        }
        return response.ok;
      } catch (error) {
        console.error('Backend error, falling back to localStorage:', error);
    const jobs = getLocalJobs();
    const filtered = jobs.filter(j => j.id !== id);
    if (filtered.length < jobs.length) {
      setLocalJobs(filtered);
      return true;
    }
    // The row lives only on the server (a synced account save) and the
    // DELETE failed: queue it under the account resolved before the
    // request so the next reconciliation retries it, instead of dropping
    // the user's delete. When the account cannot be resolved there is no
    // safe scope - report failure so the UI does not claim removal.
    if (!accountId) return false;
    rememberPendingDelete(accountId, id);
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
async function mergeGuestDetailsIntoAccount(guest: SavedJob, accountId: string): Promise<boolean> {
  try {
    const listResponse = await fetch(`${API_BASE_URL}/saved-jobs`, {
      credentials: 'include',
      headers: { 'X-Expected-User-Id': accountId },
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
      headers: { 'Content-Type': 'application/json', 'X-Expected-User-Id': accountId },
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
function stripSyncMeta(job: SavedJob): Omit<SavedJob, 'lastUploaded' | 'syncedTo'> {
  const { lastUploaded, syncedTo, ...rest } = job;
  void lastUploaded;
  void syncedTo;
  return rest;
}

// A compensating DELETE that fails (5xx/network) must not be forgotten: the
// local record is already gone, so without a retry the account row would
// resurrect the deleted save on the next sync. Failed ids persist here,
// scoped to the account that created the row - a 404 under a different
// account must not clear another account's pending deletion.
const PENDING_DELETES_KEY = 'techjobs_pending_saved_job_deletes';

function getPendingDeleteMap(): { map: Record<string, string[]>; legacy: string[] } {
  try {
    const raw = localStorage.getItem(PENDING_DELETES_KEY);
    if (!raw) return { map: {}, legacy: [] };
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Pre-scoping format; attributed to the current account at flush time.
      return { map: {}, legacy: parsed.filter((x): x is string => typeof x === 'string') };
    }
    if (parsed && typeof parsed === 'object') {
      const map: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(v)) map[k] = v.filter((x): x is string => typeof x === 'string');
      }
      return { map, legacy: [] };
    }
  } catch {
    // fall through to empty
  }
  return { map: {}, legacy: [] };
}

function setPendingDeleteMap(map: Record<string, string[]>): void {
  const clean = Object.fromEntries(Object.entries(map).filter(([, v]) => v.length > 0));
  if (Object.keys(clean).length === 0) {
    localStorage.removeItem(PENDING_DELETES_KEY);
  } else {
    localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(clean));
  }
}

function rememberPendingDelete(accountId: string, id: string): void {
  const { map, legacy } = getPendingDeleteMap();
  const owned = [...(map[accountId] ?? []), ...legacy];
  if (!owned.includes(id)) owned.push(id);
  map[accountId] = owned;
  setPendingDeleteMap(map);
}

// The server rejects an expected-account write whose session no longer
// matches with 409 { code: 'ACCOUNT_MISMATCH' }; POST uses plain 409 for URL
// conflicts too, so the body decides.
function getPendingDeleteIds(accountId: string | null): string[] {
  const { map, legacy } = getPendingDeleteMap();
  return accountId ? [...(map[accountId] ?? []), ...legacy] : [];
}

async function isAccountMismatch(response: Response): Promise<boolean> {
  if (response.status !== 409) return false;
  const body: { code?: string } | null = await response.clone().json().catch(() => null);
  return body?.code === 'ACCOUNT_MISMATCH';
}

async function flushPendingDeletes(accountId: string): Promise<void> {
  const { map, legacy } = getPendingDeleteMap();
  // Legacy unscoped entries were created under the then-active account; the
  // current account is the best owner guess.
  const ids = [...(map[accountId] ?? []), ...legacy];
  if (ids.length === 0) return;
  const remaining: string[] = [];
  for (const id of ids) {
    try {
      const response = await fetch(`${API_BASE_URL}/saved-jobs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-Expected-User-Id': accountId },
      });
      // The server verifies the expected account before deleting, so a 2xx
      // or 404 here is confirmed for THIS account - stop retrying the id.
      if (!response.ok && response.status !== 404) {
        remaining.push(id);
        if (await isAccountMismatch(response)) {
          // Session changed mid-flush: every later delete would hit the
          // wrong account too - keep the rest queued and stop.
          remaining.push(...ids.slice(ids.indexOf(id) + 1));
          break;
        }
      }
    } catch {
      remaining.push(id);
    }
  }
  map[accountId] = remaining;
  setPendingDeleteMap(map);
}

// Pending sync data is scoped to the authenticated account that owns it, so
// a sign-in as another user on the same browser never receives or clears
// the previous account's saves.
// The backend mounts auth at the root level (/auth/me), NOT under the /api
// base, so this must go through authApi - fetching `${API_BASE_URL}/auth/me`
// misses the route, resolves null, and silently disables reconciliation.
async function getAuthenticatedAccountId(): Promise<string | null> {
  try {
    const state = await authApi.getMe();
    return state.authenticated && state.user?.id ? state.user.id : null;
  } catch {
    return null;
  }
}

// URL-based mirroring may only touch records the active account can affect:
// unclaimed guest saves or records synced to that account. Another account's
// retained copy of the same job URL is left alone. When the identity cannot
// be resolved, only unclaimed records are eligible.
function canMirrorToRecord(job: SavedJob, accountId: string | null): boolean {
  return !job.syncedTo || (accountId !== null && job.syncedTo === accountId);
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

// reconcileInFlight coordinates only callers in this JavaScript context,
// while localStorage is shared across tabs: without a cross-tab lock, tab B
// can reconcile while tab A's upload response is still in flight, remove the
// shared local record after a 409, and A then mistakes that cleanup for a
// user deletion and deletes the synced account row. The Web Locks API
// serializes reconciliation across tabs, so a missing local record during an
// in-flight upload can only be a real user deletion. Browsers without the
// API fall back to same-context coordination only.
const RECONCILE_LOCK_NAME = 'techjobs-saved-jobs-reconcile';

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

async function doReconcileGuestSavedJobs(): Promise<number> {
  const lockManager =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: LockManagerLike }).locks
      : undefined;
  if (lockManager) {
    return lockManager.request(RECONCILE_LOCK_NAME, runReconcileGuestSavedJobs);
  }
  return runReconcileGuestSavedJobs();
}

async function runReconcileGuestSavedJobs(): Promise<number> {
  const accountId = await getAuthenticatedAccountId();
  if (!accountId) return 0; // no account to sync into; retried after sign-in
  // Retry account-row deletions that failed on earlier runs first; they are
  // independent of the local queue and must survive it being empty.
  await flushPendingDeletes(accountId);
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
    // A save already synced to a different account (an earlier sign-in on
    // this browser) is left untouched instead of duplicating into this one.
    if (current.syncedTo && current.syncedTo !== accountId) continue;
    // Requests carry the browser's CURRENT session cookie, which another tab
    // can change mid-run: re-check the identity before every write, and stop
    // the run if it changed - A-owned records must not upload under B.
    const beforeWrite = await getAuthenticatedAccountId();
    if (beforeWrite !== accountId) break;
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
      // The expected-account header binds this write to the account resolved
      // at the start of the run: if another tab flipped the session before
      // the request arrived, the server rejects it instead of creating the
      // row under the wrong account.
      const response = await fetch(`${API_BASE_URL}/saved-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Expected-User-Id': accountId },
        credentials: 'include',
        body: JSON.stringify(record),
      });
      // 2xx: uploaded. 409: the account already has this URL - merge the
      // guest's application details into the account record first, and only
      // then drop the local copy. 409 with ACCOUNT_MISMATCH: the session
      // flipped mid-run - keep everything queued and stop.
      if (!response.ok && response.status !== 409) {
        remaining.push(current);
        continue;
      }
      if (response.status === 409) {
        if (await isAccountMismatch(response)) {
          // Keep this record and everything not yet attempted - but only
          // what is still in localStorage (a delete that landed mid-flight
          // must not be resurrected).
          const liveIds = new Set(getLocalJobs().map((j) => j.id));
          remaining.push(...local.slice(local.indexOf(job)).filter((j) => liveIds.has(j.id)));
          break;
        }
        const merged = await mergeGuestDetailsIntoAccount(current, accountId);
        if (!merged) {
          remaining.push(current); // merge failed - keep for next time
          continue;
        }
      }
      // If the session flipped while the request was in flight, the write
      // may have landed under a different account: keep the record local and
      // unstamped rather than recording it as synced to the old account.
      const afterWrite = await getAuthenticatedAccountId();
      if (afterWrite !== accountId) {
        remaining.push(current);
        continue;
      }
      // The user may have deleted this record while its own upload was in
      // flight: undo a fresh 2xx upload so the delete stays deleted.
      const stillLocal = getLocalJobs().find((j) => j.id === job.id);
      if (!stillLocal) {
        if (response.ok) {
          const created: SavedJob | null = await response.json().catch(() => null);
          if (created?.id) {
            // If this compensating delete fails, the local record is already
            // gone and nothing would retry it - persist the id so the next
            // reconciliation removes the orphaned account row.
            try {
              const deleteResponse = await fetch(`${API_BASE_URL}/saved-jobs/${created.id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'X-Expected-User-Id': accountId },
              });
              if (!deleteResponse.ok && deleteResponse.status !== 404) {
                rememberPendingDelete(accountId, created.id);
              }
            } catch {
              rememberPendingDelete(accountId, created.id);
            }
          }
        }
        continue;
      }
      uploadedSnapshots.set(job.id, snapshot);
      // Remember what the account now holds so the next reconciliation can
      // tell a later local edit apart from never-uploaded guest data.
      const stamped = getLocalJobs().map((j) =>
        j.id === job.id
          ? { ...j, syncedTo: accountId, lastUploaded: { applied: record.applied, applied_date: record.applied_date, comments: record.comments } }
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
