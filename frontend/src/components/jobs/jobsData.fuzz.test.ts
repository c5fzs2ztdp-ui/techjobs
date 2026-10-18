import { describe, it, expect } from 'vitest';
import { parseJobsPayload } from './jobsData';

// Deterministic PRNG so failures reproduce.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1337);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const WEIRD_STRINGS = [
  '', ' ', '\0', '\u202Espam noitpecer\u202C', 'a'.repeat(100000),
  '💼🔥', 'תל אביב', '״״״', '<script>alert(1)</script>', '\\n\\t',
  '𝕳𝖊𝖑𝖑𝖔', '\uFEFF', 'null', 'undefined', '__proto__',
];
const JUNK: unknown[] = [null, undefined, 0, -1, 7, 1.5, NaN, Infinity, true, false, [], [null], [{}], {}, {a:1}, ...WEIRD_STRINGS];
const REQ = ['company', 'title', 'url', 'job_category'] as const;
const OPT = ['location','city','department','description','employmentType','workModel','seniority','postedAt','firstSeenAt','closedAt','refreshState','region','cityHe','updated'] as const;

function baseJob() {
  return {
    company: 'Acme', title: 'Engineer', url: 'https://x.co/1', job_category: 'software',
    location: 'Tel Aviv', city: 'Tel Aviv', technologies: ['React'], cities: ['Tel Aviv'],
    regions: ['tel-aviv-gush-dan'], employmentType: 'full-time',
  };
}

function fuzzRecord(): unknown {
  const mode = Math.floor(rnd() * 6);
  if (mode === 0) return pick(JUNK);
  const rec: Record<string, unknown> = baseJob();
  // mutate 1-4 fields
  const n = 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const f = pick([...REQ, ...OPT, 'technologies', 'cities', 'regions', '__proto__', 'constructor', 'toString', 'unknownField']);
    rec[f] = pick(JUNK);
  }
  if (mode === 1) for (const f of REQ) if (rnd() < 0.5) delete rec[f];
  if (mode === 2) rec.technologies = Array.from({length: 1000}, () => pick(JUNK));
  return rec;
}

describe('parseJobsPayload fuzz', () => {
  it('survives envelope junk without unexpected throws', () => {
    const envelopes: unknown[] = [null, undefined, 42, 'x', [], {}, {jobs: null}, {jobs: {}}, {jobs: 'x'}, {schemaVersion: 2, jobs: []}, {schemaVersion: '1', jobs: []}, {jobs: []}];
    for (const env of envelopes) {
      try {
        const p = parseJobsPayload(env);
        expect(Array.isArray(p.jobs)).toBe(true);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(String((e as Error).message)).toMatch(/payload|schemaVersion/);
      }
    }
  });

  it('10k fuzzed records: output always well-formed, no pollution, no bidi', () => {
    for (let batch = 0; batch < 20; batch++) {
      const jobs = Array.from({length: 500}, fuzzRecord);
      const before = ({} as Record<string, unknown>).polluted;
      let p;
      try { p = parseJobsPayload({ updatedAt: 'x', count: jobs.length, schemaVersion: 1, jobs }); }
      catch (e) { throw new Error(`batch ${batch} threw: ${(e as Error).message}`); }
      expect(({} as Record<string, unknown>).polluted).toBe(before);
      for (const j of p.jobs) {
        for (const f of REQ) expect(typeof (j as unknown as Record<string, unknown>)[f]).toBe('string');
        for (const f of OPT) {
          const v = (j as unknown as Record<string, unknown>)[f];
          expect(v === null || typeof v === 'string').toBe(true);
        }
        for (const arr of [j.technologies, j.cities, j.regions]) {
          expect(Array.isArray(arr)).toBe(true);
          for (const el of arr) expect(typeof el).toBe('string');
        }
        const all = [...REQ, ...OPT].map(f => (j as unknown as Record<string, unknown>)[f]).filter(v => typeof v === 'string') as string[];
        all.push(...j.technologies, ...j.cities, ...j.regions);
        for (const s of all) expect(s).not.toMatch(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/);
      }
    }
  }, 60000);

  it('cityLabels fuzz: only clean string values admitted', () => {
    const cases: unknown[] = [null, undefined, 'x', 7, [], {a: 7, b: 'ok', c: null, d: '\u202Ex'}, {'__proto__': 'x'}];
    for (const cl of cases) {
      const p = parseJobsPayload({ schemaVersion: 1, jobs: [], cityLabels: cl });
      expect(typeof p.cityLabels).toBe('object');
      expect(Array.isArray(p.cityLabels)).toBe(false);
      for (const v of Object.values(p.cityLabels ?? {})) {
        expect(typeof v).toBe('string');
        expect(v).not.toMatch(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/);
      }
    }
  });

  it('huge payload parses in reasonable time', () => {
    const jobs = Array.from({length: 50000}, (_, i) => ({...baseJob(), url: `https://x.co/${i}`, description: 'd'.repeat(2000)}));
    const t0 = Date.now();
    const p = parseJobsPayload({ schemaVersion: 1, jobs });
    expect(p.jobs.length).toBe(50000);
    expect(Date.now() - t0).toBeLessThan(10000);
  }, 20000);
});
