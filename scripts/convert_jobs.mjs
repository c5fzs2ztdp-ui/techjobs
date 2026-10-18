#!/usr/bin/env node
// Converts techjob_map data/jobs.json (fixed 21-field schema) into the site payload.
// Usage: node scripts/convert_jobs.mjs <input jobs.json> <output jobs.json>
import fs from 'node:fs';
import path from 'node:path';

const isMain = !!process.argv[1] && process.argv[1].endsWith('convert_jobs.mjs');
const [,, inputPath, outputPath] = process.argv;
if (isMain && (!inputPath || !outputPath)) {
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
  ['Kiryat Bialik', 'קריית ביאליק', ['kiryat bialik', 'קריית ביאליק', 'קרית ביאליק']],
  ['Kiryat Ono', 'קריית אונו', ['kiryat ono', 'קריית אונו', 'קרית אונו']],
  ["Yizre'el", 'יזרעאל', ["yizre'el", 'yizreel', 'יזרעאל']],
  ['Central District', 'מרכז', ['מרכז']],
  ['Northern District', 'צפון', ['צפון']],
  ['Southern District', 'דרום', ['דרום']],
  ['Dalton', 'דלתון', ['dalton', 'דלתון']],
  ['Kfar Netter', 'כפר נטר', ['kfar netter', 'kfar-netter', 'כפר נטר']],
  ['Magal', 'מגל', ['kibbutz magal', 'מגל']],
];

// Canonical city -> region slug. One location registry: regions are DERIVED
// from the canonical cities below, never assembled independently, so the
// city and region filters can never disagree about a job.
const CITY_REGION = {
  'Tel Aviv': 'tel-aviv-gush-dan', 'Ramat Gan': 'tel-aviv-gush-dan', 'Givatayim': 'tel-aviv-gush-dan',
  'Bnei Brak': 'tel-aviv-gush-dan', 'Holon': 'tel-aviv-gush-dan', 'Bat Yam': 'tel-aviv-gush-dan',
  'Or Yehuda': 'tel-aviv-gush-dan', 'Kiryat Ono': 'tel-aviv-gush-dan',
  'Herzliya': 'sharon', 'Ramat HaSharon': 'sharon', "Ra'anana": 'sharon', 'Kfar Saba': 'sharon',
  'Hod HaSharon': 'sharon', 'Netanya': 'sharon', 'Kfar Netter': 'sharon', 'Shefayim': 'sharon',
  'Caesarea': 'sharon', 'Magal': 'sharon',
  'Petah Tikva': 'center', 'Rosh HaAyin': 'center', 'Yehud': 'center', "Modi'in": 'center',
  'Ben Gurion Airport': 'center', 'Rishon LeZion': 'center', 'Central District': 'center',
  'Rehovot': 'shfela', 'Ness Ziona': 'shfela', 'Yavne': 'shfela', 'Ramla': 'shfela', 'Lod': 'shfela',
  'Beer Yaakov': 'shfela', 'Shfela': 'shfela',
  'Jerusalem': 'jerusalem', 'Beit Shemesh': 'jerusalem',
  'Haifa': 'haifa-krayot', 'Kiryat Bialik': 'haifa-krayot', 'Yokneam': 'haifa-krayot',
  'Karmiel': 'north', 'Nazareth': 'north', 'Afula': 'north', 'Acre': 'north', 'Zefat': 'north',
  'Kiryat Shmona': 'north', 'Tiberias': 'north', 'Katzrin': 'north', "Yizre'el": 'north',
  'Migdal HaEmek': 'north', 'Ramat HaGolan': 'north', 'Dalton': 'north', "Sha'ar HaGolan": 'north',
  'Beit HaEmek': 'north', 'Northern District': 'north',
  'Ashdod': 'south', 'Ashkelon': 'south', 'Sderot': 'south', 'Kiryat Gat': 'south',
  'Southern District': 'south',
  'Beer Sheva': 'negev', 'Dimona': 'negev', 'Eilat': 'negev',
  'Ariel': 'judea-samaria',
};
const REGION_SET = new Set([
  'tel-aviv-gush-dan', 'sharon', 'center', 'shfela', 'jerusalem',
  'haifa-krayot', 'north', 'south', 'negev', 'judea-samaria',
]);

// All regions matching the canonical cities, merged with any supported
// explicit upstream annotations. This is the single location registry - the
// city and region filters can never disagree about a job.
export function deriveRegions(cities, regionsAnnotations, regionAnnotation) {
  return [...new Set([
    ...(Array.isArray(cities) ? cities : []).map(c => CITY_REGION[c]).filter(Boolean),
    ...[...(Array.isArray(regionsAnnotations) ? regionsAnnotations : []), regionAnnotation]
      .filter(r => REGION_SET.has(r)),
  ])];
}
// Pre-compile matchers. The canonical name and plain ASCII aliases match on
// word boundaries ("Lodging" is not Lod, "holonistic" is not Holon); Hebrew
// aliases stay substring because JS \b does not see non-ASCII letters as
// word chars. Longest name wins, regex or not - keep PORT in sync with
// techjob_map lib/cities.mjs.
const escapeRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CITY_MATCHERS = [];
for (const [en, he, variants] of CITIES) {
  CITY_MATCHERS.push({ en, he, len: en.length, test: new RegExp(`\\b${escapeRe(en)}\\b`, 'i'), needle: null });
  for (const v of variants) {
    const isRegex = v.includes('\\b');
    const asciiPlain = !isRegex && /^[\x20-\x7E]+$/.test(v);
    CITY_MATCHERS.push({
      en, he,
      len: v.replace(/\\b/g, '').length,
      test: isRegex ? new RegExp(v, 'i') : asciiPlain ? new RegExp(`\\b${escapeRe(v)}\\b`, 'i') : null,
      needle: isRegex || asciiPlain ? null : v.toLowerCase(),
    });
  }
}
CITY_MATCHERS.sort((a, b) => b.len - a.len);

const NON_CITY = /^\s*(il(,\s*il)?|home( office)?|israel(,\s*il)?|\d+ locations?|various locations.*|multiple locations|remote|israel wide|all israel|hybrid)\s*$/i;
const JUNK_CITY = /https?:\/\/|www\.|\.co(m)?\b|careers/i;

// District labels are fallback evidence, not cities: a concrete city anywhere
// in the location beats a district ("Eilat, Southern District, Israel" is
// Eilat, region negev - not Southern District/south). Districts match only
// when no concrete city matched.
const DISTRICT_ENS = new Set(['Central District', 'Northern District', 'Southern District']);

export function normalizeCity(raw) {
  if (typeof raw !== 'string' || !raw) return { city: null, cityHe: null };
  const trimmed = raw.trim();
  if (NON_CITY.test(trimmed) || JUNK_CITY.test(trimmed)) return { city: null, cityHe: null };
  const lower = trimmed.toLowerCase();
  for (const allowDistricts of [false, true]) {
    for (const m of CITY_MATCHERS) {
      if (!allowDistricts && DISTRICT_ENS.has(m.en)) continue;
      if (m.test ? m.test.test(lower) : lower.includes(m.needle)) {
        return { city: m.en, cityHe: m.he };
      }
    }
  }
  // Never pass through an unmapped raw string: city is canonical-only-or-null
  // (raw location stays available in the location field for display).
  return { city: null, cityHe: null };
}

// --- Job category derivation (title first, then department; EN + HE) ---
// Taxonomy (18 slugs): software, data-ai, qa, devops, security, product,
// design, sales, marketing, hr, finance, operations-logistics,
// customer-support, hardware-electronics, mechanical-manufacturing,
// management, admin, other. Unmatched is ALWAYS 'other', never software.
const TITLE_RULES = [
  // specific professions first (order matters, first match wins)
  ['hr', /\bhr\b|\bhrbp\b|human resources|recruit|talent (acquisition|sourc|partner)|people (operations|partner)|משאבי אנוש|כוח אדם|גיוס|מגייס/],
  ['product', /product (manager|owner|lead|management|analyst)|group product|\bcpo\b|מנהל\/?\.?ת? מוצר|אחראי\/?\.?ת? מוצר/],
  // Explicit manufacturing/hardware automation contexts come before the
  // generic automation QA match (and before the \bai\b data-ai match).
  ['mechanical-manufacturing', /manufacturing automation|industrial automation/],
  ['hardware-electronics', /\b(vlsi|asic|fpga|silicon|cad|chip)\b[^,]*automation|automation[^,]*\b(vlsi|asic|fpga|silicon|cad|chip)\b/],
  ['qa', /\bqa\b|quality assurance|\bsdet\b|test automation|automation (test|testing)|\btest(s|ing)? engineer|בדיקות תוכנה|בודק\/?\.?ת? תוכנה/],
  // Explicit occupations (design, sales, marketing) outrank the broad
  // technology qualifiers below: "AI Sales Specialist" is a sales role,
  // "Senior Product Designer - Harmony AI" is a design role, and
  // "Enterprise Account Executive (Cyber)" is a sales role.
  // Engineering "designers" (PCB/Logic/Mechanical/Antenna/RFIC/Physical) are
  // hardware-mechanical roles, not design: the lookbehind blocks them so they
  // fall through to the hardware/mechanical rules below.
  ['design', /(?<!(pcb|layout|logic|mechanical|antenna|rfic|physical|electrical|hardware|asic|chip|silicon)\s)designer|\bux\b|\bui\b|graphic|motion design|מעצב|חוויית? משתמש|גרפיק/],
  // Specific support roles must match before the general account-manager
  // sales rule below - first match wins.
  ['customer-support', /technical account manager|\btam\b/],
  ['sales', /sales|account executive|account manager|business development|\bbdr\b|\bsdr\b|pre-?sales|מכירות|פיתוח עסקי|מנהל\/?\.?ת? לקוחות|יועץ\/?\.?ת? מכירות/],
  ['customer-support', /customer (support|success|service|experience)|technical support|help ?desk|support (engineer|specialist|representative)|\btam\b|technical account manager|client services?|professional services|שירות לקוחות|נציג\/?\.?ת?( שירות| |$)|תמיכה|מוקד|הצלחת לקוח/],
  ['marketing', /marketing|growth (manager|marketing)|\bseo\b|content (writer|manager)|brand|demand generation|campaign|copywriter|social media|שיווק|משווק|מותג|קמפיין|דיגיטל/],
  ['security', /cyber|infosec|appsec|devsecops|product security|security (engineer|research(er)?|architect|analyst|consultant|expert|advisor)|\bsoc analyst|penetration test|malware|vulnerabilit|threat (prevention|intelligence|hunt)|incident response|endpoint (security|protection|research)|סייבר|אבטחת מידע|אבטחת מערכות/],
  ['devops', /devops|\bsre\b|site reliability|platform engineer|infrastructure engineer|finops|cloud (engineer|architect)|systems? administrator|\bsysadmin|network engineer|\bit (engineer|manager|specialist)|דבאופס|תשתיות (מחשוב|מידע|טכנולוג)|מנהל\/?\.?ת? מערכת|סיסטם/],
  ['data-ai', /data scien|data engineer|data analy|machine learning|deep learning|artificial intelligence|\bmlops\b|\bml (engineer|researcher|research|performance|systems|hw)|\bai\b|data platform|algorithm|research scien|computer vision|\bnlp\b|big data|business intelligence|\bbi (developer|analyst|engineer)|דאטה|נתונים|למידת מכונה|בינה מלאכותית|אלגוריתמ/],
  // SoC = silicon only when adjacent to chip terms; bare "SOC" is usually a
  // security operations center ("SOC Analyst", "Autonomous SOC", "מנהל/ת SOC").
  ['hardware-electronics', /\bsoc\b[^,]*(design|verification|verif|power|clock|rtl|physical|silicon|chip|dft|ip|subsystem|architect|test|product|quality|reliability)|\b(design|verification|power|clock|rtl|physical|silicon|chip|dft|ip|test)[^,]*\bsoc\b/],
  ['hardware-electronics', /hardware|fpga|asic|vlsi|embedded|firmware|\bsilicon\b|electronics|\bpcb\b|\brfic\b|antenna|physical design|\brf\b|board design|validation engineer|verification engineer|\bdft\b|\bmems\b|חומרה|אלקטרוניקה|מהנדס\/?\.?ת? מערכ|אינטגרציה|שילובים|תקשורת|ניווט/],
  ['mechanical-manufacturing', /mechanical|mechatronics|manufacturing|production (engineer|manager|operator|worker|line)|machinist|technician|maintenance|\bcnc\b|welder|electrician|industrial engineer|process engineer|quality (engineer|technician|inspector|systems|manager)|מכונות|מכאנ|מכונאי|טכנאי|תכן|מכני|מתקין|יצור|טכנולוג(\.?ית)?(?![א-ת])|technologist|אחזקה|ייצור|תעשייה וניהול|מהנדס\/?\.?ת? תעשייה|חשמלאי|רתך|מסגר|איכות|הנדסאי|מכטרוניקה|בקרת הינע/],
  ['finance', /financ|controller|accountant|accounting|bookkeep|payroll|\bcfo\b|fp&a|auditor|treasury|\beconomist\b|כספים|הנהלת חשבונות|הנה"ח|רואה חשבון|רו"ח|חשב\/?\.?ת?|כלכלה|כלכלן|פיננס/],
  ['operations-logistics', /operations|supply chain|logistics|warehouse|procurement|inventory|shipping|fleet|facilities|\bdriver\b|order management|לוגיסטיק|רכש|קניין|מחסנא|מחסן|אחסנה|הפצה|הובלה|שרשרת אספקה|תפעול|מלאי|מלגז|נהג/],
  ['admin', /administra|office manager|executive assistant|personal assistant|receptionist|secretary|clerical|אדמיניסטר|מזכיר|משרדי|פקיד|(^|[^א-ת])רכז(?=[\/ ]|$)/],
  ['software', /software|full.?stack|back.?end|front.?end|web (developer|engineer)|mobile (developer|engineer)|android (developer|engineer)|\bios (developer|engineer)|application (developer|engineer)|\bsw (engineer|developer)|c\+\+|\bjava\b|\bpython\b|\bgolang\b|\brust\b|\bkotlin\b|\bscala\b|\bphp\b|\bruby on rails\b|dotnet|\.net (developer|engineer)|\bc#|linux kernel|macos|\bsap\b|מתכנת|תוכנה|פיתוח תוכנה|מפתח\/?\.?ת?|פולסטאק/],
  ['management', /vice president|\bvp\b|general manager|managing director|\bdirector\b|\bchief\b|\bteam lead\b|\btech(nical)? lead\b|\bgroup lead\b|ראש צוות|head of|group manager|department manager|ראש\/?\.?ת? מחלק|project manager|program manager|\bpmo\b|delivery manager|scrum master|engineering manager|\bmanager\b|מנהל|ראש מחלקה|ראש תחום|סמנכ"ל|מנכ"ל|סגן נשיא/],
];
// Department is a strong signal when the title alone did not classify (EN + HE).
const DEPT_RULES = [
  ['software', /r&d|research|engineering|development|software|\bit\b|information technology/],
  ['sales', /מכירות|sales/],
  ['marketing', /שיווק|יח"צ|ייצוא|marketing/],
  ['hr', /משאבי אנוש|כוח אדם|hr|human resources/],
  ['finance', /כספים|כלכלה|בקרה|הנהלת חשבונות|finance|accounting/],
  ['operations-logistics', /לוגיסטיק|אחסנה|הפצה|הובלה|תפעול|operations|logistics|supply chain/],
  ['mechanical-manufacturing', /איכות|אחזקה|הנדסה|ייצור|quality|maintenance|manufacturing|production/],
  ['customer-support', /שירות|תמיכה|support|customer/],
  ['admin', /פקידות|מזכירות|אדמיניסטר|admin/],
];
export function deriveJobCategory(title, department) {
  const t = (typeof title === 'string' ? title : '').toLowerCase();
  let titleCat = null;
  for (const [cat, re] of TITLE_RULES) if (re.test(t)) { titleCat = cat; break; }
  // A specific title match wins. A generic 'management' match is refined by
  // the department when one is known (e.g. "content manager" + שיווק -> marketing).
  if (titleCat && titleCat !== 'management') return titleCat;
  const d = (typeof department === 'string' ? department : '').toLowerCase();
  if (d) for (const [cat, re] of DEPT_RULES) if (re.test(d)) return cat;
  return titleCat || 'other';
}

// --- Convert ---
if (isMain) {

let raw;
try {
  raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (e) {
  console.error(`Input is not valid JSON: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(raw)) { console.error('Input is not a JSON array'); process.exit(1); }

// A malformed row must never kill the whole publish: non-object records are
// dropped (and counted) instead of crashing the conversion.
const sourceRows = raw.filter(j => j !== null && typeof j === 'object' && !Array.isArray(j));
const droppedRows = raw.length - sourceRows.length;
if (droppedRows > 0) console.warn(`convert_jobs: dropped ${droppedRows} malformed row(s)`);
const jobs = sourceRows.map(j => {
  const { city, cityHe } = normalizeCity(
    (typeof j.city === 'string' && j.city) || (typeof j.location === 'string' && j.location) || null,
  );
  const cities = [...new Set([...(Array.isArray(j.cities) ? j.cities : []), city].filter(Boolean))];
  // Regions derive from every canonical city; explicit upstream annotations
  // are merged only when they are supported region slugs.
  const regions = deriveRegions(cities, j.regions, j.region);
  // Non-string scalars are coerced to null: the renderer's parseJobsPayload
  // drops rows missing required string fields, so a corrupted row degrades
  // instead of breaking the payload contract. Bidi control characters are
  // stripped here too (the renderer strips them again at its boundary): they
  // never belong in job data and can visually spoof rendered text.
  const BIDI = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
  const strOrNull = (v) => (typeof v === 'string' ? v.replace(BIDI, '') : null);
  return {
    // renderer-facing fields from the 21-field techjob_map schema
    company: strOrNull(j.company),
    title: strOrNull(j.title),
    location: strOrNull(j.location),
    // Only http(s) urls: anything else renders as a dangerous href.
    url: typeof j.url === 'string' && /^https?:\/\//i.test(j.url) ? j.url.replace(BIDI, '') : null,
    city,
    department: strOrNull(j.department),
    description: strOrNull(j.description),
    employmentType: strOrNull(j.employmentType),
    workModel: strOrNull(j.workModel),
    seniority: strOrNull(j.seniority),
    technologies: Array.isArray(j.technologies) ? j.technologies.filter(t => typeof t === 'string').map(t => t.replace(BIDI, '')) : [],
    postedAt: strOrNull(j.postedAt),
    // Ops/provenance fields (jobId, jobCode, source, verification, verifiedAt,
    // lastRefreshAttemptAt, lastRefreshError, locationSource) stay in the
    // source dataset - the site never renders them and they cost ~30% of the
    // payload over the wire.
    firstSeenAt: strOrNull(j.firstSeenAt),
    refreshState: strOrNull(j.refreshState),
    closedAt: strOrNull(j.closedAt),
    region: strOrNull(j.region),
    cities,
    regions,
    // site-specific derived fields
    cityHe,
    job_category: deriveJobCategory(j.title, j.department),
    updated: strOrNull(j.postedAt) || strOrNull(j.verifiedAt) || strOrNull(j.firstSeenAt),
  };
});

const payload = {
  // Versioned data contract with the frontend (jobsData.ts validates it).
  schemaVersion: 1,
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

}
