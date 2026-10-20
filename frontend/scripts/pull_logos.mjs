// Build-time logo pull: fetches the private logo assets repo and installs
// them into the frontend before bundling. The logo files are NOT committed
// to this repository; they live in a private repo (default
// c5fzs2ztdp-ui/techjob-logos) and are pulled with a read-only deploy key
// supplied via the LOGOS_DEPLOY_KEY environment variable.
//
// The script lives inside frontend/ so every build context that has the
// frontend sources (root Dockerfile, frontend/Dockerfile, local dev) also
// has the script. Run it from the frontend directory: `node scripts/pull_logos.mjs`.
//
// This script NEVER fails the build:
// - No LOGOS_DEPLOY_KEY set (CI, forks, contributors): the committed
//   placeholder manifest stays and every company renders its letter avatar.
// - Key set but the clone, validation (manifest and the required, complete logo-sources.json) or install fails for any reason: warn
//   and continue with whatever is already in the tree. Existing logos and
//   the existing manifest are only replaced after the new set is fully
//   staged and validated.
//
// Env:
//   LOGOS_DEPLOY_KEY  SSH private key (ed25519) with read access to the repo
//   LOGOS_REPO        optional override, owner/name form (default below)
//   LOGOS_PULL_TIMEOUT_MS  optional clone deadline (default 120000)
import {
  mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync, cpSync, mkdirSync,
  readFileSync, renameSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = process.env.LOGOS_REPO || 'c5fzs2ztdp-ui/techjob-logos';
const FRONTEND = fileURLToPath(new URL('..', import.meta.url));
const LOGOS_DIR = path.join(FRONTEND, 'public', 'logos');
const GENERATED = path.join(FRONTEND, 'src', 'generated', 'companyLogos.json');
const TIMEOUT_MS = Number(process.env.LOGOS_PULL_TIMEOUT_MS) || 120000;
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;

// The bundle imports this manifest statically, so it must always exist.
if (!existsSync(GENERATED)) {
  mkdirSync(path.dirname(GENERATED), { recursive: true });
  writeFileSync(GENERATED, '{}\n');
}

const key = process.env.LOGOS_DEPLOY_KEY;
if (!key) {
  console.log('pull_logos: LOGOS_DEPLOY_KEY not set - building with in-tree assets (letter avatars for unmapped companies)');
  process.exit(0);
}

// POSIX single-quote escaping so paths with spaces survive the shell that
// git uses to run GIT_SSH_COMMAND.
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Parse and validate a downloaded manifest: a plain object of
// company name -> safe filename, where every file exists in the staged dir.
function validateManifest(raw, logosDir) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`manifest is not valid JSON (${e.message})`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('manifest is not a name -> filename object');
  }
  const present = new Set(readdirSync(logosDir));
  for (const [name, file] of Object.entries(parsed)) {
    if (typeof file !== 'string' || !SAFE_FILENAME.test(file) || file === '.' || file === '..') {
      throw new Error(`manifest entry for "${name}" has an unsafe filename`);
    }
    if (!present.has(file)) {
      throw new Error(`manifest entry for "${name}" points to missing file ${file}`);
    }
  }
  return parsed;
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const PROVENANCE = new Set(['own-domain', 'own-domain-unrecorded', 'unrecorded']);
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

// Required provenance map (logo-sources.json, shipped in the private assets
// repo next to the logos): one record for every logo in the manifest, and no
// record for a company that has no logo. A record is one of:
//   - a source URL string, or an object with an http(s) source_url (plus an
//     optional page URL and own_domain / provenance fields): the URL the
//     logo was fetched from;
//   - { provenance: 'own-domain-unrecorded', own_domain }: the company's own
//     domain is known but the exact file URL was not recorded;
//   - { provenance: 'unrecorded' }: the logo predates provenance tracking.
// The unrecorded forms are explicit markers, never an invented source. A
// missing, malformed or incomplete map rejects the whole pull so the previous
// assets stay in place. Nothing from the map is committed to this repository.
function validateSources(logosDir, manifest) {
  const file = path.join(logosDir, 'logo-sources.json');
  if (!existsSync(file)) {
    throw new Error('logo-sources.json is missing (a source record is required for every logo)');
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`logo-sources.json is not valid JSON (${e.message})`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('logo-sources.json is not a company -> source object');
  }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  for (const [name, entry] of Object.entries(parsed)) {
    if (!has(manifest, name)) {
      throw new Error(`logo-sources.json entry "${name}" is not a company in the manifest`);
    }
    if (typeof entry === 'string') {
      if (!isHttpUrl(entry)) throw new Error(`logo-sources.json entry "${name}" has no valid http(s) source URL`);
      continue;
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`logo-sources.json entry "${name}" is not a URL or record`);
    }
    if (entry.provenance !== undefined && !PROVENANCE.has(entry.provenance)) {
      throw new Error(`logo-sources.json entry "${name}" has an unknown provenance`);
    }
    if (entry.own_domain !== undefined && !(typeof entry.own_domain === 'string' && HOSTNAME.test(entry.own_domain))) {
      throw new Error(`logo-sources.json entry "${name}" has an invalid own_domain`);
    }
    if (entry.page !== undefined && !isHttpUrl(entry.page)) {
      throw new Error(`logo-sources.json entry "${name}" has an invalid page URL`);
    }
    if (entry.source_url !== undefined || entry.provenance === undefined || entry.provenance === 'own-domain') {
      if (!isHttpUrl(entry.source_url)) {
        throw new Error(`logo-sources.json entry "${name}" has no valid http(s) source URL`);
      }
    } else if (entry.provenance === 'own-domain-unrecorded' && entry.own_domain === undefined) {
      throw new Error(`logo-sources.json entry "${name}" is own-domain-unrecorded without an own_domain`);
    }
  }
  const missing = Object.keys(manifest).filter((c) => !has(parsed, c));
  if (missing.length) {
    const sample = missing.slice(0, 3).join(', ');
    throw new Error(`logo-sources.json has no record for ${missing.length} logo(s) (e.g. ${sample})`);
  }
  return Object.keys(parsed).length;
}

let keyDir;
let backupDir;
let stagingDir;
try {
  keyDir = mkdtempSync(path.join(tmpdir(), 'logos-key-'));
  const keyFile = path.join(keyDir, 'id_ed25519');
  writeFileSync(keyFile, key.endsWith('\n') ? key : key + '\n');
  chmodSync(keyFile, 0o600);
  const dest = path.join(keyDir, 'repo');
  const sshCommand = [
    'ssh', '-i', shq(keyFile),
    '-o IdentitiesOnly=yes',
    '-o BatchMode=yes',
    '-o StrictHostKeyChecking=accept-new',
    '-o ConnectTimeout=20',
    '-o ServerAliveInterval=10',
    '-o ServerAliveCountMax=3',
  ].join(' ');
  execFileSync('git', ['clone', '--depth', '1', `git@github.com:${REPO}.git`, dest], {
    stdio: 'pipe',
    timeout: TIMEOUT_MS,
    killSignal: 'SIGKILL',
    env: { ...process.env, GIT_SSH_COMMAND: sshCommand, GIT_TERMINAL_PROMPT: '0' },
  });
  const srcLogos = path.join(dest, 'frontend', 'public', 'logos');
  const srcManifest = path.join(dest, 'frontend', 'src', 'generated', 'companyLogos.json');

  // Stage and validate everything before touching the live files.
  stagingDir = `${LOGOS_DIR}.staging`;
  rmSync(stagingDir, { recursive: true, force: true });
  cpSync(srcLogos, stagingDir, { recursive: true });
  const manifestText = readFileSync(srcManifest, 'utf8');
  const manifest = validateManifest(manifestText, stagingDir);
  const sourceCount = validateSources(stagingDir, manifest);
  const normalized = JSON.stringify(manifest, null, 2) + '\n';

  // Swap in. Keep a backup of the current logos until the manifest write
  // succeeds, and restore it if anything fails.
  backupDir = `${LOGOS_DIR}.backup`;
  rmSync(backupDir, { recursive: true, force: true });
  const hadLogos = existsSync(LOGOS_DIR);
  const oldManifest = readFileSync(GENERATED);
  if (hadLogos) renameSync(LOGOS_DIR, backupDir);
  try {
    renameSync(stagingDir, LOGOS_DIR);
    stagingDir = undefined;
    writeFileSync(GENERATED, normalized);
  } catch (e) {
    rmSync(LOGOS_DIR, { recursive: true, force: true });
    if (hadLogos) renameSync(backupDir, LOGOS_DIR);
    writeFileSync(GENERATED, oldManifest);
    throw e;
  }
  console.log(`pull_logos: installed ${Object.keys(manifest).length} logos (${sourceCount} source entries) from ${REPO}`);
} catch (e) {
  console.warn(`pull_logos: WARNING - could not pull logos (${e.message}); building with in-tree assets`);
} finally {
  if (keyDir) rmSync(keyDir, { recursive: true, force: true });
  if (stagingDir) rmSync(stagingDir, { recursive: true, force: true });
  if (backupDir) rmSync(backupDir, { recursive: true, force: true });
}
