import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Runs the real scripts/pull_logos.mjs against a fake `git` on PATH that
// "clones" a fixture directory, so the install / validate / fallback logic
// is exercised without network access or a deploy key.
const SCRIPT = path.resolve(process.cwd(), 'scripts/pull_logos.mjs');

let work: string;
let app: string;

function makeFixture(manifest: string, sources?: string): string {
  const fix = path.join(work, `fix-${Math.random().toString(36).slice(2)}`);
  mkdirSync(path.join(fix, 'frontend', 'public', 'logos'), { recursive: true });
  mkdirSync(path.join(fix, 'frontend', 'src', 'generated'), { recursive: true });
  writeFileSync(path.join(fix, 'frontend', 'public', 'logos', 'a.png'), 'png');
  writeFileSync(path.join(fix, 'frontend', 'src', 'generated', 'companyLogos.json'), manifest);
  if (sources !== undefined) writeFileSync(path.join(fix, 'frontend', 'public', 'logos', 'logo-sources.json'), sources);
  return fix;
}

function run(fixture: string, extraEnv: Record<string, string> = {}) {
  const bin = path.join(work, 'bin');
  mkdirSync(bin, { recursive: true });
  const fakeGit = path.join(bin, 'git');
  writeFileSync(fakeGit, '#!/bin/sh\nfor a; do d="$a"; done\n[ -n "$STALL" ] && exec sleep 30\ncp -r "$FIX" "$d"\n');
  chmodSync(fakeGit, 0o755);
  return spawnSync('node', ['scripts/pull_logos.mjs'], {
    cwd: app,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LOGOS_DEPLOY_KEY: 'k', FIX: fixture, ...extraEnv },
    encoding: 'utf8',
    timeout: 20000,
  });
}

const logos = () => readdirSync(path.join(app, 'public', 'logos')).sort();
const manifest = () => readFileSync(path.join(app, 'src', 'generated', 'companyLogos.json'), 'utf8').replace(/\s+/g, '');

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), 'pull-logos-test-'));
  app = path.join(work, 'app');
  mkdirSync(path.join(app, 'scripts'), { recursive: true });
  cpSync(SCRIPT, path.join(app, 'scripts', 'pull_logos.mjs'));
  mkdirSync(path.join(app, 'public', 'logos'), { recursive: true });
  mkdirSync(path.join(app, 'src', 'generated'), { recursive: true });
  writeFileSync(path.join(app, 'public', 'logos', 'old.png'), 'old');
  writeFileSync(path.join(app, 'src', 'generated', 'companyLogos.json'), '{"Old":"old.png"}\n');
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

const OK_SRC = '{"A":{"source_url":"https://x.example/a.png","page":"https://x.example/p"}}';

describe('pull_logos.mjs', () => {
  it('installs a valid pull and replaces the previous assets', () => {
    const r = run(makeFixture('{"A":"a.png"}', OK_SRC));
    expect(r.status).toBe(0);
    expect(logos()).toEqual(['a.png', 'logo-sources.json']);
    expect(manifest()).toBe('{"A":"a.png"}');
  });

  it('accepts string sources and explicit unrecorded markers', () => {
    const src = JSON.stringify({
      A: 'https://x.example/a.png',
      B: { provenance: 'own-domain-unrecorded', own_domain: 'b.example.com' },
      C: { provenance: 'unrecorded' },
      D: { provenance: 'own-domain', source_url: 'https://d.example/favicon.ico', own_domain: 'd.example' },
    });
    const r = run(makeFixture('{"A":"a.png","B":"a.png","C":"a.png","D":"a.png"}', src));
    expect(r.status).toBe(0);
    expect(logos()).toEqual(['a.png', 'logo-sources.json']);
  });

  it.each([
    ['malformed manifest JSON', '{not json', undefined],
    ['manifest pointing at a missing file', '{"A":"zz.png"}', OK_SRC],
    ['manifest with a path traversal filename', '{"A":"../x.png"}', OK_SRC],
    ['missing logo-sources.json', '{"A":"a.png"}', undefined],
    ['sources without a record for every logo', '{"A":"a.png","B":"a.png"}', OK_SRC],
    ['sources entry without a valid URL', '{"A":"a.png"}', '{"A":"not a url"}'],
    ['sources entry with a non-http(s) URL', '{"A":"a.png"}', '{"A":"javascript:alert(1)"}'],
    ['sources entry for a company not in the manifest', '{"A":"a.png"}', '{"A":"https://x.example/a.png","Zed":"https://x.example/z.png"}'],
    ['sources entry with an invalid page URL', '{"A":"a.png"}', '{"A":{"source_url":"https://x.example/a.png","page":"ftp://x"}}'],
    ['own-domain record without a source URL', '{"A":"a.png"}', '{"A":{"provenance":"own-domain","own_domain":"x.example.com"}}'],
    ['own-domain-unrecorded record without a domain', '{"A":"a.png"}', '{"A":{"provenance":"own-domain-unrecorded"}}'],
    ['record with an invalid own_domain', '{"A":"a.png"}', '{"A":{"provenance":"own-domain-unrecorded","own_domain":"not a host"}}'],
    ['record with an unknown provenance', '{"A":"a.png"}', '{"A":{"provenance":"trust-me"}}'],
    ['record that is neither a URL nor a provenance marker', '{"A":"a.png"}', '{"A":{}}'],
    ['malformed sources JSON', '{"A":"a.png"}', '{oops'],
  ])('keeps the previous logos and manifest on %s', (_name, m, s) => {
    const r = run(makeFixture(m, s));
    expect(r.status).toBe(0);
    expect(r.stderr + r.stdout).toContain('WARNING');
    expect(logos()).toEqual(['old.png']);
    expect(manifest()).toBe('{"Old":"old.png"}');
    expect(existsSync(path.join(app, 'public', 'logos.staging'))).toBe(false);
    expect(existsSync(path.join(app, 'public', 'logos.backup'))).toBe(false);
  });

  it('falls back after the clone deadline instead of blocking the build', () => {
    const r = run(makeFixture('{"A":"a.png"}', OK_SRC), { STALL: '1', LOGOS_PULL_TIMEOUT_MS: '1000' });
    expect(r.status).toBe(0);
    expect(logos()).toEqual(['old.png']);
  });

  it('skips the pull entirely without a deploy key', () => {
    const r = run(makeFixture('{"A":"a.png"}', OK_SRC), { LOGOS_DEPLOY_KEY: '' });
    expect(r.status).toBe(0);
    expect(logos()).toEqual(['old.png']);
  });
});
