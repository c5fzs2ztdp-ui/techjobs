import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveJobCategory, deriveRegions } from './convert_jobs.mjs';

// Regression: Strauss screenshot cases - Hebrew titles must never default to software.
test('strauss HR recruiting manager -> hr', () => {
  assert.equal(deriveJobCategory('מנהלת צוות גיוס אזור הצפון - החלפה לחל"ד', 'משאבי אנוש'), 'hr');
});
test('strauss quality systems technician -> mechanical-manufacturing', () => {
  assert.equal(deriveJobCategory('מטמיע.ת מערכות איכות ישראל החלפה לחל"ד - כל הארץ', 'הנדסה'), 'mechanical-manufacturing');
});
test('strauss warehouse inventory -> operations-logistics', () => {
  assert.equal(deriveJobCategory('אמין.ת מלאי - אתר שוהם', 'לוגיסטיקה (אחסנה, הפצה, הובלה)'), 'operations-logistics');
});
test('strauss accounting assistant -> finance', () => {
  assert.equal(deriveJobCategory('עוזר.ת חשבת במחלקה המקצועית ודיווח כספי - פתח תקווה', 'כספים'), 'finance');
});

// Never default to software: unmatched -> other.
test('unmatched title -> other, never software', () => {
  assert.equal(deriveJobCategory('רכז/ת רישיונות', null), 'admin');
  assert.equal(deriveJobCategory('Order Management Specialist', null), 'operations-logistics');
  assert.equal(deriveJobCategory('מחסנא/ית', null), 'operations-logistics');
  assert.equal(deriveJobCategory('סוקר/ת מפעלי', null), 'other');
  assert.equal(deriveJobCategory('', null), 'other');
  assert.equal(deriveJobCategory(null, null), 'other');
});

// Substring safety: רכז must not match inside מרכז.
test('מרכז does not trigger admin via רכז', () => {
  assert.equal(deriveJobCategory('מנהל.ת מרכז תובנות ומחקר', 'שיווק יח"צ וייצוא'), 'marketing');
});

// Generic management title is refined by department.
test('management refined by department', () => {
  assert.equal(deriveJobCategory('מנהל.ת תוכן - פתח תקווה', 'שיווק יח"צ וייצוא'), 'marketing');
  assert.equal(deriveJobCategory('מנהל.ת בקרה תקציבית', 'כלכלה ובקרה'), 'finance');
  assert.equal(deriveJobCategory('Project Manager', null), 'management');
});

// Core EN + HE categories.
test('core classifications', () => {
  assert.equal(deriveJobCategory('Senior Backend Engineer', null), 'software');
  assert.equal(deriveJobCategory('מהנדס/ת תוכנה RT', null), 'software');
  assert.equal(deriveJobCategory('C++ SW Engineer', null), 'software');
  assert.equal(deriveJobCategory('Data Engineer', null), 'data-ai');
  assert.equal(deriveJobCategory('חוקר/ת AI בכיר/ה', null), 'data-ai');
  assert.equal(deriveJobCategory('QA Automation Engineer', null), 'qa');
  assert.equal(deriveJobCategory('DevOps Engineer', null), 'devops');
  assert.equal(deriveJobCategory('Security Researcher', null), 'security');
  assert.equal(deriveJobCategory('Security Officer', null), 'other'); // physical guard, not tech
  assert.equal(deriveJobCategory('Product Manager', null), 'product');
  assert.equal(deriveJobCategory('UX Designer', null), 'design');
  assert.equal(deriveJobCategory('Account Executive', null), 'sales');
  assert.equal(deriveJobCategory('מנהל.ת לקוחות יבש', 'מכירות'), 'sales');
  assert.equal(deriveJobCategory('Customer Success Manager', null), 'customer-support');
  assert.equal(deriveJobCategory('נציג/ת שירות לקוחות', null), 'customer-support');
  assert.equal(deriveJobCategory('Financial Controller', null), 'finance');
  assert.equal(deriveJobCategory('רואה חשבון', null), 'finance');
  assert.equal(deriveJobCategory('Supply Chain Manager', null), 'operations-logistics');
  assert.equal(deriveJobCategory('נהג.ת תובלה', null), 'operations-logistics');
  assert.equal(deriveJobCategory('FPGA Engineer', null), 'hardware-electronics');
  assert.equal(deriveJobCategory('טכנאי/ת אוטומציה וחשמל', 'אחזקה'), 'mechanical-manufacturing');
  assert.equal(deriveJobCategory('Mechanical Engineer', null), 'mechanical-manufacturing');
  assert.equal(deriveJobCategory('מזכיר.ת מנכל"ית', null), 'admin');
  assert.equal(deriveJobCategory('VP Engineering', null), 'management');
});

// Infrastructure technician (facilities/energy) is not DevOps.
test('HE תשתיות without computing context is not devops', () => {
  assert.equal(deriveJobCategory('טכנאי.ת תשתיות ואנרגיה', 'אחזקה'), 'mechanical-manufacturing');
  assert.equal(deriveJobCategory('מהנדס תשתיות מחשוב', null), 'devops');
});

// User feedback: טכנולוג (technologist) is not software.
test('technologist titles are not software', () => {
  assert.equal(deriveJobCategory('טכנולוג.ית פרוייקטים', 'מו"פ וטכנולוגיה'), 'mechanical-manufacturing');
  assert.equal(deriveJobCategory('טכנולוג.ית מחקר ופיתוח - יטבתה', 'מו"פ וטכנולוגיה'), 'mechanical-manufacturing');
  assert.equal(deriveJobCategory('מהנדס.ת פיתוח טכנולוגי', 'מו"פ וטכנולוגיה'), 'other');
  assert.equal(deriveJobCategory('Technologist', null), 'mechanical-manufacturing');
  // IT-context טכנולוגיות must not hit the technologist rule
  assert.notEqual(deriveJobCategory('מהנדס טכנולוגיות מידע', null), 'mechanical-manufacturing');
  // real software development in Hebrew still classifies
  assert.equal(deriveJobCategory('מהנדס פיתוח תוכנה', null), 'software');
});

// Regression: "Tel Aviv / Remote" must keep its city; only standalone "remote" is non-city.
test('remote-mentioned location keeps real city', async () => {
  const { normalizeCity } = await import('./convert_jobs.mjs');
  assert.equal(normalizeCity('Tel Aviv / Remote').city, 'Tel Aviv');
  assert.equal(normalizeCity('Remote or Haifa').city, 'Haifa');
  assert.equal(normalizeCity('Remote').city, null);
});

// Regions derive from every canonical city - a multi-city job appears under
// every matching region filter (Nati round-2 finding).
test('regions derive from all canonical cities', () => {
  assert.deepEqual(
    deriveRegions(['Tel Aviv', 'Haifa'], ['tel-aviv-gush-dan'], 'tel-aviv-gush-dan'),
    ['tel-aviv-gush-dan', 'haifa-krayot'],
  );
});

// Rows without upstream annotations still get a region from a known city.
test('city-only row still lands in a region filter', () => {
  assert.deepEqual(deriveRegions(['Herzliya'], null, null), ['sharon']);
});

// Unsupported annotations are dropped, not passed through.
test('unsupported region annotations are dropped', () => {
  assert.deepEqual(deriveRegions(['Haifa'], ['narnia'], 'middle-earth'), ['haifa-krayot']);
  assert.deepEqual(deriveRegions([], ['narnia'], null), []);
});

// closedAt passes through so the site can mark/hide closed tombstones.
test('closedAt passes through the converter', async () => {
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-closed-'));
  try {
    const input = path.join(tmp, 'in.json');
    const output = path.join(tmp, 'out.json');
    fs.writeFileSync(input, JSON.stringify([
      { company: 'A', title: 'Engineer', url: 'https://x/1', city: 'Tel Aviv', refreshState: 'closed', closedAt: '2026-10-17T00:00:00Z' },
      { company: 'A', title: 'Designer', url: 'https://x/2', city: 'Haifa', refreshState: 'fresh' },
    ]));
    execFileSync(process.execPath, ['scripts/convert_jobs.mjs', input, output]);
    const payload = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(payload.jobs[0].closedAt, '2026-10-17T00:00:00Z');
    assert.equal(payload.jobs[0].refreshState, 'closed');
    assert.equal(payload.jobs[1].closedAt, null);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// The general account-manager sales rule must not shadow the specific
// Technical Account Manager support rule (Nati round-3 finding).
test('Technical Account Manager -> customer-support, not sales', () => {
  assert.equal(deriveJobCategory('Technical Account Manager', null), 'customer-support');
  assert.equal(deriveJobCategory('Team Lead, Technical Account Manager', null), 'customer-support');
  assert.equal(deriveJobCategory('Account Manager', null), 'sales'); // general rule still works
});
