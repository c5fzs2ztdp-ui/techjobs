import { openJobUrls, computeNewJobs, buildAlertHtml, runDailyAlert, type AlertDeps, type FeedJob } from '../jobs/dailyAlert';

const J = (url: string, extra: Partial<FeedJob> = {}): FeedJob => ({ url, title: 'Eng', company: 'Acme', ...extra });

function deps(overrides: Partial<AlertDeps>): { deps: AlertDeps; sent: { to: string; subject: string; html: string }[]; saved: string[][] } {
  const sent: { to: string; subject: string; html: string }[] = [];
  const saved: string[][] = [];
  return {
    sent,
    saved,
    deps: {
      fetchFeed: async () => ({ jobs: [] }),
      loadSnapshot: async () => [],
      saveSnapshot: async (urls) => { saved.push(urls); },
      listSubscribers: async () => [],
      sendMail: async (to, subject, html) => { sent.push({ to, subject, html }); },
      publicBaseUrl: 'https://site.example',
      ...overrides,
    },
  };
}

describe('openJobUrls', () => {
  it('excludes closed tombstones', () => {
    expect(openJobUrls([J('a'), J('b', { refreshState: 'closed' })])).toEqual(['a']);
  });
});

describe('computeNewJobs', () => {
  it('returns nothing on the first run (snapshot seeding must not spam)', () => {
    expect(computeNewJobs([J('a')], null)).toEqual([]);
  });
  it('returns only urls absent from the previous snapshot', () => {
    expect(computeNewJobs([J('a'), J('b')], ['a']).map((j) => j.url)).toEqual(['b']);
  });
  it('ignores closed jobs even when their url is new', () => {
    expect(computeNewJobs([J('c', { refreshState: 'closed' })], [])).toEqual([]);
  });
});

describe('buildAlertHtml', () => {
  it('escapes html and links the unsubscribe url', () => {
    const html = buildAlertHtml([J('https://x/1', { title: '<b>Hi</b>', company: 'A&B', cityHe: 'תל אביב' })], 1, 'https://site.example/api/alerts/unsubscribe?token=t');
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('unsubscribe?token=t');
  });
  it('caps the listed jobs and notes the remainder', () => {
    const jobs = Array.from({ length: 25 }, (_, i) => J(`https://x/${i}`));
    const html = buildAlertHtml(jobs, 25, 'u', 20);
    expect(html).toContain('And 5 more');
  });
});

describe('runDailyAlert', () => {
  it('seeds the snapshot on first run and sends nothing', async () => {
    const { deps: d, sent, saved } = deps({
      fetchFeed: async () => ({ jobs: [J('a'), J('b')] }),
      loadSnapshot: async () => null,
      listSubscribers: async () => [{ email: 'x@y.z', unsubscribe_token: 't' }],
    });
    const r = await runDailyAlert(d);
    expect(r).toEqual({ newCount: 0, sent: 0, seeded: true });
    expect(sent).toHaveLength(0);
    expect(saved).toEqual([['a', 'b']]);
  });

  it('sends one mail per active subscriber with a per-subscriber unsubscribe link', async () => {
    const { deps: d, sent } = deps({
      fetchFeed: async () => ({ jobs: [J('a'), J('b')] }),
      loadSnapshot: async () => ['a'],
      listSubscribers: async () => [
        { email: 'one@y.z', unsubscribe_token: 'tok1' },
        { email: 'two@y.z', unsubscribe_token: 'tok2' },
      ],
    });
    const r = await runDailyAlert(d);
    expect(r).toMatchObject({ newCount: 1, sent: 2, seeded: false });
    expect(sent[0].html).toContain('token=tok1');
    expect(sent[1].html).toContain('token=tok2');
    expect(sent[0].subject).toContain('1 new Israeli tech job');
  });

  it('sends nothing when there are no new jobs', async () => {
    const { deps: d, sent } = deps({
      fetchFeed: async () => ({ jobs: [J('a')] }),
      loadSnapshot: async () => ['a'],
      listSubscribers: async () => [{ email: 'x@y.z', unsubscribe_token: 't' }],
    });
    const r = await runDailyAlert(d);
    expect(r).toMatchObject({ newCount: 0, sent: 0 });
    expect(sent).toHaveLength(0);
  });

  it('one failing subscriber does not block the rest', async () => {
    let calls = 0;
    const { deps: d, sent } = deps({
      fetchFeed: async () => ({ jobs: [J('b')] }),
      loadSnapshot: async () => [],
      listSubscribers: async () => [
        { email: 'bad@y.z', unsubscribe_token: 't1' },
        { email: 'good@y.z', unsubscribe_token: 't2' },
      ],
      sendMail: async (to, subject, html) => { calls += 1; if (to.startsWith('bad')) throw new Error('smtp down'); sent.push({ to, subject, html }); },
    });
    const r = await runDailyAlert(d);
    expect(r.sent).toBe(1);
    expect(calls).toBe(2);
  });
});
