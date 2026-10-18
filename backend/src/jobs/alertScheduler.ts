import cron from 'node-cron';
import nodemailer from 'nodemailer';
import supabase from '../database';
import { runDailyAlert, loadSnapshotFromDb, saveSnapshotToDb, type FeedJob } from './dailyAlert';

// Wires the digest to real services. Activated from index.ts only when
// ALERTS_ENABLED=true. Required env vars:
//   JOBS_DATA_URL   - the published feed this deployment serves
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_FROM
//   PUBLIC_BASE_URL - site origin for unsubscribe links
export function startAlertScheduler(): void {
  const required = ['JOBS_DATA_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'ALERT_FROM', 'PUBLIC_BASE_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Daily alert NOT started; missing env vars: ${missing.join(', ')}`);
    return;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.ALERT_FROM!;
  const baseUrl = process.env.PUBLIC_BASE_URL!.replace(/\/$/, '');

  const send = async () => {
    const summary = await runDailyAlert({
      fetchFeed: async () => {
        const res = await fetch(process.env.JOBS_DATA_URL!);
        if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
        return (await res.json()) as { jobs: FeedJob[] };
      },
      loadSnapshot: loadSnapshotFromDb,
      saveSnapshot: saveSnapshotToDb,
      listSubscribers: async () => {
        const { data, error } = await supabase
          .from('alert_subscriptions')
          .select('email, unsubscribe_token')
          .eq('active', true);
        if (error) throw error;
        return data ?? [];
      },
      sendMail: async (to, subject, html) => {
        await transport.sendMail({ from, to, subject, html });
      },
      publicBaseUrl: baseUrl,
    });
    console.log('Daily alert run:', summary);
  };

  // 07:30 Asia/Jerusalem daily.
  cron.schedule('30 7 * * *', () => {
    send().catch((err) => console.error('Daily alert run failed:', err));
  }, { timezone: 'Asia/Jerusalem' });
  console.log('Daily alert scheduler started (07:30 Asia/Jerusalem)');
}
