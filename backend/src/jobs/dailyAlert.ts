import supabase from '../database';

// Daily new-jobs alert: diff the published feed against the last snapshot
// and email active subscribers what is new. All network/DB/email effects
// are injectable so the logic is unit-testable without side effects.

export interface FeedJob {
  url: string;
  title?: string;
  company?: string;
  cityHe?: string | null;
  city?: string | null;
  refreshState?: string | null;
}

export interface AlertDeps {
  fetchFeed: () => Promise<{ jobs: FeedJob[] }>;
  loadSnapshot: () => Promise<string[] | null>;
  saveSnapshot: (urls: string[]) => Promise<void>;
  listSubscribers: () => Promise<{ email: string; unsubscribe_token: string }[]>;
  sendMail: (to: string, subject: string, html: string) => Promise<void>;
  publicBaseUrl: string;
  maxListed?: number;
}

/** URLs of currently-open jobs, newest snapshot semantics. */
export function openJobUrls(jobs: FeedJob[]): string[] {
  return jobs.filter((j) => j.refreshState !== 'closed').map((j) => j.url);
}

/** Jobs present now but absent from the previous snapshot. */
export function computeNewJobs(jobs: FeedJob[], previousUrls: string[] | null): FeedJob[] {
  if (previousUrls === null) return []; // first run seeds the snapshot silently
  const seen = new Set(previousUrls);
  return jobs.filter((j) => j.refreshState !== 'closed' && !seen.has(j.url));
}

export function buildAlertHtml(newJobs: FeedJob[], total: number, unsubscribeUrl: string, maxListed = 20): string {
  const items = newJobs.slice(0, maxListed)
    .map((j) => `<li><a href="${j.url}">${escapeHtml(j.title || 'Job')}</a> - ${escapeHtml(j.company || '')}${j.cityHe || j.city ? `, ${escapeHtml(j.cityHe || j.city || '')}` : ''}</li>`)
    .join('\n');
  const more = total > maxListed ? `<p>And ${total - maxListed} more on the board.</p>` : '';
  return `<p>${total} new job${total === 1 ? '' : 's'} posted in the last day:</p><ul>${items}</ul>${more}<p><a href="${unsubscribeUrl}">Unsubscribe from these alerts</a></p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** One digest run. Returns a summary for logging. Never throws on a single
 *  subscriber failure - one bad address must not block the rest. */
export async function runDailyAlert(deps: AlertDeps): Promise<{ newCount: number; sent: number; seeded: boolean }> {
  const feed = await deps.fetchFeed();
  const open = feed.jobs.filter((j) => j.refreshState !== 'closed');
  const previous = await deps.loadSnapshot();
  const newJobs = computeNewJobs(feed.jobs, previous);
  await deps.saveSnapshot(openJobUrls(feed.jobs));
  if (previous === null) {
    return { newCount: 0, sent: 0, seeded: true };
  }
  if (newJobs.length === 0) {
    return { newCount: 0, sent: 0, seeded: false };
  }
  const subscribers = await deps.listSubscribers();
  let sent = 0;
  for (const sub of subscribers) {
    try {
      const unsubscribeUrl = `${deps.publicBaseUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token)}`;
      await deps.sendMail(
        sub.email,
        `${newJobs.length} new Israeli tech job${newJobs.length === 1 ? '' : 's'} today`,
        buildAlertHtml(newJobs, newJobs.length, unsubscribeUrl, deps.maxListed),
      );
      sent += 1;
    } catch (err) {
      console.error('Alert send failed for a subscriber:', err);
    }
  }
  return { newCount: newJobs.length, sent, seeded: false };
}

// --- Production wiring (thin adapters over supabase/nodemailer/fetch) ---

const STATE_KEY = 'jobs_snapshot';

export async function loadSnapshotFromDb(): Promise<string[] | null> {
  const { data, error } = await supabase.from('alert_state').select('value').eq('key', STATE_KEY).maybeSingle();
  if (error) throw error;
  return (data?.value as string[] | undefined) ?? null;
}

export async function saveSnapshotToDb(urls: string[]): Promise<void> {
  const { error } = await supabase.from('alert_state').upsert({ key: STATE_KEY, value: urls });
  if (error) throw error;
}
