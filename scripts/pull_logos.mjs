// Build-time logo pull: fetches the private logo assets repo and installs
// them into the frontend before bundling. The logo files are NOT committed
// to this repository; they live in a private repo (default
// c5fzs2ztdp-ui/techjob-logos) and are pulled with a read-only deploy key
// supplied via the LOGOS_DEPLOY_KEY environment variable.
//
// This script NEVER fails the build:
// - No LOGOS_DEPLOY_KEY set (CI, forks, contributors): the committed
//   placeholder manifest stays and every company renders its letter avatar.
// - Key set but the clone/copy fails for any reason: warn and continue with
//   whatever is in the tree.
//
// Env:
//   LOGOS_DEPLOY_KEY  SSH private key (ed25519) with read access to the repo
//   LOGOS_REPO        optional override, owner/name form (default below)
import { mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = process.env.LOGOS_REPO || 'c5fzs2ztdp-ui/techjob-logos';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOGOS_DIR = path.join(ROOT, 'frontend', 'public', 'logos');
const GENERATED = path.join(ROOT, 'frontend', 'src', 'generated', 'companyLogos.json');

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

let keyDir;
try {
  keyDir = mkdtempSync(path.join(tmpdir(), 'logos-key-'));
  const keyFile = path.join(keyDir, 'id_ed25519');
  writeFileSync(keyFile, key.endsWith('\n') ? key : key + '\n');
  chmodSync(keyFile, 0o600);
  const dest = path.join(keyDir, 'repo');
  execFileSync('git', ['clone', '--depth', '1', `git@github.com:${REPO}.git`, dest], {
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i ${keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`,
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  const srcLogos = path.join(dest, 'frontend', 'public', 'logos');
  const srcManifest = path.join(dest, 'frontend', 'src', 'generated', 'companyLogos.json');
  rmSync(LOGOS_DIR, { recursive: true, force: true });
  cpSync(srcLogos, LOGOS_DIR, { recursive: true });
  writeFileSync(GENERATED, await import('node:fs/promises').then((fs) => fs.readFile(srcManifest)));
  console.log(`pull_logos: installed logos from ${REPO}`);
} catch (e) {
  console.warn(`pull_logos: WARNING - could not pull logos (${e.message}); building with in-tree assets`);
} finally {
  if (keyDir) rmSync(keyDir, { recursive: true, force: true });
}
