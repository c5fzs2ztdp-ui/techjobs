import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJobsPayload, fetchAllJobs } from '@/components/jobs/jobsData';

const payloadResponse = (body: unknown) =>
  ({ ok: true, json: async () => body } as Response);

afterEach(() => vi.unstubAllGlobals());

describe('fetchJobsPayload normalization', () => {
  it('fills missing arrays so renderers never throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => payloadResponse({
      updatedAt: '2026-10-17T00:00:00Z', count: 2,
      jobs: [
        { company: 'A', title: 'Engineer', url: 'https://x/1' }, // no technologies/cities/regions
        { company: 'B', title: 'מהנדס', url: 'https://x/2', technologies: null, cities: 'tel-aviv' },
      ],
    })));
    const payload = await fetchJobsPayload();
    expect(payload.jobs[0].technologies).toEqual([]);
    expect(payload.jobs[0].cities).toEqual([]);
    expect(payload.jobs[1].technologies).toEqual([]);
    expect(payload.jobs[1].cities).toEqual([]);
  });

  it('survives an empty/malformed payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => payloadResponse({})));
    const jobs = await fetchAllJobs();
    expect(jobs).toEqual([]);
  });
});

describe('fetchAllJobs ordering', () => {
  it('sorts English titles first, then newest; undated last within group', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => payloadResponse({
      jobs: [
        { company: 'A', title: 'מהנדס תוכנה', url: 'https://x/1', updated: '2026-10-17' },
        { company: 'B', title: 'Old Engineer', url: 'https://x/2', updated: '2026-01-01' },
        { company: 'C', title: 'New Engineer', url: 'https://x/3', updated: '2026-10-17' },
        { company: 'D', title: 'Undated Engineer', url: 'https://x/4', updated: null },
      ],
    })));
    const titles = (await fetchAllJobs()).map(j => j.title);
    expect(titles).toEqual(['New Engineer', 'Old Engineer', 'Undated Engineer', 'מהנדס תוכנה']);
  });
});
