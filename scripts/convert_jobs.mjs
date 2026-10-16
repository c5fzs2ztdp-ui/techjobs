#!/usr/bin/env node
// Converts techjob_map data/jobs.json (fixed 21-field schema) into the site payload.
// Usage: node scripts/convert_jobs.mjs <input jobs.json> <output jobs.json>
import fs from 'node:fs';
import path from 'node:path';

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert_jobs.mjs <input jobs.json> <output jobs.json>');
  process.exit(1);
}

// --- City normalization: canonical English name + Hebrew display name ---
// Variants are matched lowercase, longest first, as substring of the raw city.
const CITIES = [
  ['Tel Aviv', 'תל אביב-יפו', ['israel: tel aviv', 'tel aviv-yafo', 'tel aviv yafo', 'tel-aviv', 'tel aviv', '\\btlv\\b', 'ת"א', 'תל אביב']],
  ['Jerusalem', 'ירושלים', ['jerusalem', 'ירושלים']],
  ['Haifa', 'חיפה', ['haifa', 'חיפה']],
  ['Herzliya', 'הרצליה', ['herzliya', 'herzeliya', 'hertzelia', 'הרצליה']],
  ["Ra'anana", 'רעננה', ["ra'anana", 'raanana', 'רעננה']],
  ['Petah Tikva', 'פתח תקווה', ['petah tikva', 'petah-tikva', 'petach tikva', 'petah tiqwa', 'פתח תקווה']],
  ['Ramat Gan', 'רמת גן', ['ramat gan', 'ramat-gan', 'רמת גן']],
  ['Ramat HaSharon', 'רמת השרון', ['ramat hasharon', 'ramat hasharon', 'רמת השרון']],
  ['Hod HaSharon', 'הוד השרון', ['hod hasharon', 'hod hasharon', 'הוד השרון']],
  ['Netanya', 'נתניה', ['netanya', 'נתניה']],
  ['Rehovot', 'רחובות', ['rehovot', 'רחובות']],
  ['Beer Sheva', 'באר שבע', ["be'er sheva", 'beer sheva', 'beersheba', 'באר שבע']],
  ['Beer Yaakov', 'באר יעקב', ['beer yaakov', "be'er yaakov", 'באר יעקב']],
  ['Kfar Saba', 'כפר סבא', ['kfar saba', 'kfar-saba', 'kefar sava', 'כפר סבא']],
  ['Rosh HaAyin', 'ראש העין', ["rosh haayin", "rosh ha'ayin", 'rosh haayin', 'ראש העין']],
  ['Yokneam', 'יקנעם', ['yokneam', 'yoqneam', 'יקנעם']],
  ['Migdal HaEmek', 'מגדל העמק', ["migdal ha'emek", 'migdal haemek', 'migdal ha-emek', 'מגדל העמק']],
  ['Karmiel', 'כרמיאל', ['karmiel', 'כרמיאל']],
  ['Holon', 'חולון', ['holon', 'חולון']],
  ['Bat Yam', 'בת ים', ['bat yam', 'בת ים']],
  ['Yavne', 'יבנה', ['yavne', 'יבנה']],
  ["Modi'in", 'מודיעין', ["modi'in", 'modiin', 'מודיעין']],
  ['Ashdod', 'אשדוד', ['ashdod', 'אשדוד']],
  ['Ashkelon', 'אשקלון', ['ashkelon', 'אשקלון']],
  ['Lod', 'לוד', ['\blod\b', 'לוד']],
  ['Ramla', 'רמלה', ['ramla', 'רמלה']],
  ['Rishon LeZion', 'ראשון לציון', ['rishon lezion', 'rishon le-zion', 'rishon le zion', 'ראשון לציון']],
  ['Bnei Brak', 'בני ברק', ['bnei brak', 'בני ברק']],
  ['Givatayim', 'גבעתיים', ['givatayim', "giv'atayim", 'גבעתיים']],
  ['Ness Ziona', 'נס ציונה', ['ness ziona', 'nes ziona', 'נס ציונה']],
  ['Caesarea', 'קיסריה', ['caesarea', 'קיסריה']],
  ['Nazareth', 'נצרת', ['nazareth', 'נצרת']],
  ['Eilat', 'אילת', ['eilat', 'אילת']],
  ['Beit Shemesh', 'בית שמש', ['beit shemesh', 'bet shemesh', 'בית שמש']],
  ['Or Yehuda', 'אור יהודה', ['or yehuda', 'אור יהודה']],
  ['Yehud', 'יהוד', ['yehud', 'יהוד']],
  ['Kiryat Gat', 'קריית גת', ['kiryat-gat', 'kiryat gat', 'qiryat gat', 'קרית גת', 'קריית גת']],
  ['Kiryat Shmona', 'קריית שמונה', ['kiryat shmona', 'קרית שמונה', 'קריית שמונה']],
  ['Tiberias', 'טבריה', ['tiberias', 'טבריה']],
  ['Afula', 'עפולה', ['afula', 'עפולה']],
  ['Acre', 'עכו', ['\bacre\b', 'akko', 'עכו']],
  ['Zefat', 'צפת', ['zefat', 'safed', 'צפת']],
  ['Ariel', 'אריאל', ['\bariel\b', 'אריאל']],
  ['Katzrin', 'קצרין', ['katzrin', 'qatzrin', 'קצרין']],
  ['Ben Gurion Airport', 'נתב"ג', ['ben gurion airport', 'נמל תעופה בן-גוריון', 'נתב"ג', 'נתב״ג']],
  ['Shefayim', 'שפיים', ['shefayim', 'שפיים']],
  ['Dimona', 'דימונה', ['dimona', 'דימונה']],
  ["Sha'ar HaGolan", 'שער הגולן', ["sha'ar hagolan", 'שער הגולן']],
  ['Sderot', 'שדרות', ['sderot', 'שדרות']],
  ['Beit HaEmek', 'בית העמק', ['beit haemek', 'בית העמק']],
  ['Shfela', 'שפלה', ['שפלה']],
  ['Ramat HaGolan', 'רמת הגולן', ['ramat hagolan', 'רמת הגולן']],
  ["Yizre'el", 'יזרעאל', ["yizre'el", 'yizreel', 'יזרעאל']],
  ['Central District', 'מרכז', ['מרכז']],
  ['Northern District', 'צפון', ['צפון']],
  ['Southern District', 'דרום', ['דרום']],
];
// Pre-compile matchers: plain substring or \bregex\b
const CITY_MATCHERS = [];
for (const [en, he, variants] of CITIES) {
  for (const v of [en.toLowerCase(), ...variants]) {
    const isRegex = v.includes('\\b');
    CITY_MATCHERS.push({
      en, he,
      test: isRegex ? new RegExp(v, 'i') : null,
      needle: isRegex ? null : v.toLowerCase(),
    });
  }
}
CITY_MATCHERS.sort((a, b) => (b.needle?.length ?? 8) - (a.needle?.length ?? 8));

const NON_CITY = /^\s*(il(,\s*il)?|.*remote.*|home( office)?|israel(,\s*il)?|\d+ locations?|various locations.*|multiple locations|remote|israel wide|all israel|hybrid)\s*$/i;
const JUNK_CITY = /https?:\/\/|www\.|\.co(m)?\b|careers/i;

function normalizeCity(raw) {
  if (!raw) return { city: null, cityHe: null };
  const trimmed = raw.trim();
  if (NON_CITY.test(trimmed) || JUNK_CITY.test(trimmed)) return { city: null, cityHe: null };
  const lower = trimmed.toLowerCase();
  for (const m of CITY_MATCHERS) {
    if (m.test ? m.test.test(lower) : lower.includes(m.needle)) {
      return { city: m.en, cityHe: m.he };
    }
  }
  return { city: raw.trim(), cityHe: null };
}

// --- Job category derivation from title (ordered, first match wins) ---
const CATEGORY_RULES = [
  ['qa', /\bqa\b|quality assurance|test automation|automation engineer|\bsdet\b|\btest(s|ing)? engineer/],
  ['security', /security|cyber|\bsoc\b|penetration|appsec|product security/],
  ['devops', /devops|\bsre\b|site reliability|platform engineer|infrastructure engineer|cloud (engineer|architect)|system administrator|\bsysadmin/],
  ['data-science', /data scien|machine learning|\bml\b|\bai\b|artificial intelligence|data engineer|data analy|\banalyst|big data|algorithm|research scien|deep learning|\bnlp\b|computer vision|bi develop|\bdata\b/],
  ['hardware', /hardware|fpga|asic|vlsi|embedded|firmware|chip|silicon|electronics|\bpcb\b|\brf\b|validation engineer|board design/],
  ['design', /designer|\bux\b|\bui\b|graphic|motion design/],
  ['product', /product (manager|owner|lead|management)|group product/],
  ['project-management', /project manager|program manager|\bpmo\b|delivery manager|scrum master/],
  ['frontend', /front.?end|react (developer|engineer)/],
  ['marketing', /marketing|growth|seo|content (writer|manager|marketing)|brand|demand generation|campaign/],
  ['sales', /sales|account executive|account manager|business development|\bbdr\b|\bsdr\b|customer account/],
  ['hr', /\bhr\b|human resources|recruit|talent (acquisition|sourc)|people (operations|partner)/],
  ['finance', /financ|controller|accountant|bookkeep|payroll|\bcfo\b|\bfp&a\b/],
  ['legal', /legal|counsel|attorney|lawyer|compliance/],
  ['support', /(customer|technical|client|it) (support|success|service)|customer success|help ?desk|support engineer|\btam\b/],
  ['business', /business (development|analyst)|strateg/],
  ['procurement-operations', /procurement|operations|supply chain|logistics|warehouse/],
  ['admin', /administra|office manager|executive assistant|personal assistant|receptionist/],
];
function deriveJobCategory(title) {
  const t = (title || '').toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) if (re.test(t)) return cat;
  return 'software';
}

// --- Convert ---
const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(raw)) { console.error('Input is not a JSON array'); process.exit(1); }

const jobs = raw.map(j => {
  const { city, cityHe } = normalizeCity(j.city || j.location);
  return {
    // full 21-field techjob_map schema, preserved
    company: j.company ?? null,
    title: j.title ?? null,
    location: j.location ?? null,
    url: j.url ?? null,
    city,
    department: j.department ?? null,
    description: j.description ?? null,
    employmentType: j.employmentType ?? null,
    workModel: j.workModel ?? null,
    seniority: j.seniority ?? null,
    technologies: Array.isArray(j.technologies) ? j.technologies : [],
    postedAt: j.postedAt ?? null,
    jobId: j.jobId ?? null,
    jobCode: j.jobCode ?? null,
    source: j.source ?? null,
    verification: j.verification ?? null,
    verifiedAt: j.verifiedAt ?? null,
    firstSeenAt: j.firstSeenAt ?? null,
    lastRefreshAttemptAt: j.lastRefreshAttemptAt ?? null,
    lastRefreshError: j.lastRefreshError ?? null,
    refreshState: j.refreshState ?? null,
    region: j.region ?? null,
    locationSource: j.locationSource ?? null,
    cities: Array.isArray(j.cities) ? j.cities : (j.city ? [j.city] : []),
    regions: Array.isArray(j.regions) ? j.regions : (j.region ? [j.region] : []),
    // site-specific derived fields
    cityHe,
    job_category: deriveJobCategory(j.title),
    updated: j.postedAt || j.verifiedAt || j.firstSeenAt || null,
  };
});

const payload = {
  updatedAt: new Date().toISOString(),
  count: jobs.length,
  // canonical city -> display label (Hebrew where known) for the city facet
  cityLabels: Object.fromEntries(CITIES.map(([en, he]) => [en, he])),
  jobs,
};
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload));

// stats
const stat = f => jobs.filter(j => j[f] !== null && j[f] !== undefined && j[f] !== '').length;
console.log(JSON.stringify({
  jobs: jobs.length,
  cityNormalized: jobs.filter(j => j.cityHe !== null).length,
  cityRaw: jobs.filter(j => j.city !== null && j.cityHe === null).length,
  noCity: jobs.filter(j => j.city === null).length,
  employmentType: stat('employmentType'),
  workModel: stat('workModel'),
  seniority: stat('seniority'),
  technologies: jobs.filter(j => j.technologies.length > 0).length,
  postedAt: stat('postedAt'),
  categories: Object.fromEntries([...new Set(jobs.map(j => j.job_category))].map(c => [c, jobs.filter(j => j.job_category === c).length]).sort((a, b) => b[1] - a[1])),
}, null, 1));
