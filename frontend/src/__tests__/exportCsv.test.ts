import { describe, it, expect } from 'vitest';
import { jobsToCsv } from '../components/jobs/exportCsv';
import type { Job } from '../components/jobs/jobsData';

function job(overrides: Partial<Job>): Job {
  return {
    company: 'Acme', title: 'Engineer', location: null, url: 'https://x.example/1',
    city: 'tel-aviv', department: null, description: null, employmentType: 'full-time',
    workModel: 'hybrid', seniority: 'senior', technologies: [], postedAt: '2026-10-01',
    firstSeenAt: null, closedAt: null, refreshState: null, region: 'tel-aviv-gush-dan',
    cities: ['tel-aviv'], regions: ['tel-aviv-gush-dan'], cityHe: 'תל אביב-יפו',
    job_category: 'software', updated: '2026-10-18', ...overrides,
  };
}

describe('jobsToCsv', () => {
  it('emits a header row and one row per job, CRLF-terminated, with a UTF-8 BOM', () => {
    const csv = jobsToCsv([job({}), job({ title: 'QA' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Title,Company,City,Region,Category,Work Model,Employment Type,Seniority,Posted,Updated,URL');
    expect(lines).toHaveLength(4); // header + 2 rows + trailing empty after final CRLF
    expect(lines[2]).toContain('QA');
  });

  it('escapes commas, quotes and newlines per RFC 4180', () => {
    const csv = jobsToCsv([job({ title: 'Senior "Staff", Engineer\nCore' })]);
    expect(csv).toContain('"Senior ""Staff"", Engineer\nCore"');
  });

  it('renders Hebrew city names and category labels', () => {
    const csv = jobsToCsv([job({})]);
    expect(csv).toContain('תל אביב-יפו');
    expect(csv).toContain('Software');
  });

  it('emits empty cells for null fields', () => {
    const csv = jobsToCsv([job({ city: null, cityHe: null, workModel: null, seniority: null })]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toBe('Engineer,Acme,,tel-aviv-gush-dan,Software,,full-time,,2026-10-01,2026-10-18,https://x.example/1');
  });

  it('returns header only for an empty list', () => {
    const csv = jobsToCsv([]);
    expect(csv.slice(1).split('\r\n')).toHaveLength(2);
  });
});
