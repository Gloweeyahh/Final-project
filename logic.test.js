/**
 * Checks for the pure logic in logic.js.
 *
 * Run with: node --test
 * No install, no framework — `node:test` and `node:assert` ship with
 * Node itself (18+). See CONTRIBUTING.md for what a passing run looks
 * like and why only logic.js (not app.js) is covered this way.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  looksLikeUrl,
  matchesSearch,
  daysUntil,
  formatDate,
  computeStats,
  uid,
} = require('./logic.js');

// Builds a "YYYY-MM-DD" string from a Date's LOCAL components, not
// toISOString() (which converts to UTC first and can land on the wrong
// day near midnight, depending on timezone). Using toISOString() here
// would make these tests exhibit the exact bug logic.js's date handling
// is written to avoid — see CONTRIBUTING.md.
function toLocalIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test('looksLikeUrl accepts a proper http(s) URL', () => {
  assert.equal(looksLikeUrl('https://example.com/jobs/42'), true);
  assert.equal(looksLikeUrl('http://example.com'), true);
});

test('looksLikeUrl treats an empty value as valid (the field is optional)', () => {
  assert.equal(looksLikeUrl(''), true);
});

test('looksLikeUrl rejects text that is not a URL', () => {
  assert.equal(looksLikeUrl('not a url'), false);
  assert.equal(looksLikeUrl('www.example.com'), false); // missing scheme, on purpose — see CONTRIBUTING.md
});

test('looksLikeUrl rejects non-http(s) schemes', () => {
  assert.equal(looksLikeUrl('javascript:alert(1)'), false);
  assert.equal(looksLikeUrl('ftp://example.com'), false);
});

test('matchesSearch matches on company or title, case-insensitively', () => {
  const app = { company: 'Acme Corp', title: 'Frontend Engineer' };
  assert.equal(matchesSearch(app, 'acme'), true);
  assert.equal(matchesSearch(app, 'FRONTEND'), true);
  assert.equal(matchesSearch(app, 'engineer'), true);
});

test('matchesSearch returns false for a non-matching term', () => {
  const app = { company: 'Acme Corp', title: 'Frontend Engineer' };
  assert.equal(matchesSearch(app, 'backend'), false);
});

test('matchesSearch treats an empty term as matching everything', () => {
  const app = { company: 'Acme Corp', title: 'Frontend Engineer' };
  assert.equal(matchesSearch(app, ''), true);
});

test('daysUntil returns 0 for today, positive for the future, negative for the past', () => {
  const today = new Date();
  const iso = toLocalIso;

  assert.equal(daysUntil(iso(today)), 0);

  const future = new Date(today); future.setDate(today.getDate() + 5);
  assert.equal(daysUntil(iso(future)), 5);

  const past = new Date(today); past.setDate(today.getDate() - 3);
  assert.equal(daysUntil(iso(past)), -3);
});

test('formatDate returns null for an empty input rather than throwing', () => {
  assert.equal(formatDate(null), null);
  assert.equal(formatDate(''), null);
});

test('computeStats counts interviews by status', () => {
  const apps = [
    { status: 'interview' },
    { status: 'interview' },
    { status: 'applied' },
  ];
  assert.equal(computeStats(apps).interviews, 2);
});

test('computeStats counts "applied this week" only within the last 7 days, inclusive of today', () => {
  const iso = toLocalIso;
  const today = new Date();
  const eightDaysAgo = new Date(today); eightDaysAgo.setDate(today.getDate() - 8);

  const apps = [
    { status: 'applied', dateApplied: iso(today) },
    { status: 'applied', dateApplied: iso(eightDaysAgo) }, // outside the window
    { status: 'saved', dateApplied: null },                 // never applied
  ];
  assert.equal(computeStats(apps).appliedThisWeek, 1);
});

test('computeStats counts a follow-up due today as due, not just future ones', () => {
  const iso = toLocalIso;
  const apps = [{ status: 'applied', followUp: iso(new Date()) }];
  assert.equal(computeStats(apps).followUpsDue, 1);
});

test('uid produces different ids on repeated calls', () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(uid());
  assert.equal(ids.size, 100);
});
