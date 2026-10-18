// Feed health check: verifies the published jobs feed on the `data` branch is
// present, parseable, fresh, and sane. Fails the workflow (non-zero exit) when
// the feed is missing, stale, shrunk, or carries known junk-title signatures.
// No dependencies; runs on the Actions runner (Node 20+).

const FEED_URL =
  process.env.FEED_URL ||
  'https://raw.githubusercontent.com/c5fzs2ztdp-ui/techjobs/data/jobs.json';

const MIN_ROWS = 5000;   // silent-shrink guard: a healthy feed is well above this
const MAX_ROWS = 9000;   // corrupt/duplicated feed guard
const MAX_AGE_HOURS = 30; // publish cadence is ~5h; 30h means publishing is broken

// Junk signatures mirrored from the techjob_map validator (keep in sync):
// bare department titles and field-glue mashups should never reach the feed.
const DEPT_TITLE_EXACT = /^(engineering|business|people|data science and research)$/i;
const GLUE_CTA_TITLE = /[a-z](?:apply(?:\s?now)?|arrow\s?right)/i;
const GLUE_DEPT_PREFIX = /^(?:engineering|business|people)[A-Z]/;

const problems = [];
const ok = (msg) => console.log(`ok - ${msg}`);
const bad = (msg) => { problems.push(msg); console.error(`FAIL - ${msg}`); };

let payload;
try {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'feed-health-check' } });
  if (!res.ok) {
    bad(`feed fetch returned HTTP ${res.status}`);
    process.exit(1);
  }
  payload = await res.json();
} catch (err) {
  bad(`feed fetch/parse failed: ${err.message}`);
  process.exit(1);
}

if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  bad('payload is not an object envelope');
} else {
  if (payload.schemaVersion !== 1) bad(`schemaVersion is ${JSON.stringify(payload.schemaVersion)}, expected 1`);
  else ok('schemaVersion is 1');

  if (!Array.isArray(payload.jobs)) {
    bad('payload.jobs is not an array');
  } else {
    const n = payload.jobs.length;
    if (n < MIN_ROWS) bad(`row count ${n} below minimum ${MIN_ROWS} (silent shrink?)`);
    else if (n > MAX_ROWS) bad(`row count ${n} above maximum ${MAX_ROWS} (corrupt feed?)`);
    else ok(`row count ${n} within [${MIN_ROWS}, ${MAX_ROWS}]`);

    const junk = payload.jobs.filter((j) => {
      const t = j && typeof j.title === 'string' ? j.title : '';
      return DEPT_TITLE_EXACT.test(t) || GLUE_CTA_TITLE.test(t) || GLUE_DEPT_PREFIX.test(t);
    });
    if (junk.length > 0) bad(`${junk.length} junk titles found, e.g. ${JSON.stringify(junk[0]?.title)}`);
    else ok('no junk-title signatures');
  }

  const updatedAt = Date.parse(payload.updatedAt || '');
  if (Number.isNaN(updatedAt)) {
    bad('updatedAt missing or unparseable');
  } else {
    const ageH = (Date.now() - updatedAt) / 3.6e6;
    if (ageH > MAX_AGE_HOURS) bad(`feed is ${ageH.toFixed(1)}h old (max ${MAX_AGE_HOURS}h) - publishing broken?`);
    else ok(`feed age ${ageH.toFixed(1)}h`);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    problems.length === 0
      ? '### Feed health: PASS\n\nAll checks green.\n'
      : `### Feed health: FAIL\n\n${problems.map((p) => `- ${p}`).join('\n')}\n`,
  );
}

if (problems.length > 0) process.exit(1);
console.log('feed health: PASS');
