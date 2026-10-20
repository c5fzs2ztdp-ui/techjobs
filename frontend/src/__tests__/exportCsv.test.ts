import { describe, it, expect } from 'vitest';
import { jobsToCsv, csvFileName } from '../components/jobs/exportCsv';
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
  it('exports derived regions when the upstream scalar region is missing', () => {
    const csv = jobsToCsv([job({ region: null, regions: ['sharon'] })]);
    expect(csv.slice(1).split('\r\n')[1].split(',')[3]).toBe('sharon');
  });

  it('exports every derived region for multi-region jobs, joined with "; "', () => {
    const csv = jobsToCsv([job({ region: 'tel-aviv-gush-dan', regions: ['tel-aviv-gush-dan', 'haifa'] })]);
    expect(csv.slice(1).split('\r\n')[1].split(',')[3]).toBe('tel-aviv-gush-dan; haifa');
  });

  it('falls back to the scalar region when no regions are derived', () => {
    const csv = jobsToCsv([job({ region: 'north', regions: [] })]);
    expect(csv.slice(1).split('\r\n')[1].split(',')[3]).toBe('north');
  });

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

  it('neutralizes spreadsheet formula injection in feed-controlled cells', () => {
    for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=1+1', '\n=1+1', '\r\n=1+1', '  =cmd|"/c calc"!A1']) {
      const csv = jobsToCsv([job({ title: evil })]);
      const cell = csv.slice(1).split('\r\n')[1].split(',')[0];
      // the neutralizing quote is the first character, inside RFC 4180
      // quoting when the value itself needs quoting
      expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
    }
    // ordinary leading-dash-free text stays untouched
    const csv = jobsToCsv([job({ title: 'Senior Dev' })]);
    expect(csv.slice(1).split('\r\n')[1].split(',')[0]).toBe('Senior Dev');
  });

  it('names the download file with the Israel calendar day, not UTC', () => {
    // 2026-10-19 01:30 IDT is still 2026-10-18 in UTC
    const lateEveningUtc = new Date('2026-10-18T22:30:00Z');
    expect(csvFileName(lateEveningUtc)).toBe('techjobs-2026-10-19.csv');
  });

  it('returns header only for an empty list', () => {
    const csv = jobsToCsv([]);
    expect(csv.slice(1).split('\r\n')).toHaveLength(2);
  });
});
