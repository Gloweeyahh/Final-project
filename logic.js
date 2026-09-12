/**
 * Applyd — pure logic.
 *
 * Everything in this file is deliberately free of `document`, `window`,
 * or any browser API. That's the whole point of it existing as a
 * separate file: it can run — and be tested — under plain Node, with
 * no browser, no test framework, and no npm install. See
 * CONTRIBUTING.md, "Where a new feature goes," for the rule this
 * enforces: logic that doesn't touch the DOM belongs here, not in
 * app.js.
 *
 * Loaded as a plain <script> before app.js (see index.html), so these
 * functions are just global — no import/export needed in the browser.
 * The `module.exports` guard at the bottom only fires under Node,
 * for the test file.
 */

const STATUSES = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
];

function uid() {
  return 'app_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function looksLikeUrl(value) {
  if (!value) return true; // optional field — empty is valid
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function matchesSearch(app, term) {
  if (!term) return true;
  const haystack = `${app.company} ${app.title}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

// Dates are stored as plain "YYYY-MM-DD" strings straight out of
// <input type="date">. Appending 'T00:00:00' (no "Z", no offset) before
// parsing is deliberate, not decoration: a bare "YYYY-MM-DD" is parsed
// as UTC midnight per spec, which silently becomes "yesterday" in any
// timezone west of UTC. Appending a local time-of-day forces local-time
// parsing instead. Every function below that touches a date string
// relies on this. See CONTRIBUTING.md's fragile-parts section.
function parseLocalDate(iso) {
  return new Date(iso + 'T00:00:00');
}

function formatDate(iso) {
  if (!iso) return null;
  return parseLocalDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(iso) {
  const d = parseLocalDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function computeStats(applications) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
  const sevenDaysAhead = new Date(today); sevenDaysAhead.setDate(today.getDate() + 7);

  const total = applications.length;

  const appliedThisWeek = applications.filter((a) => {
    if (!a.dateApplied) return false;
    const d = parseLocalDate(a.dateApplied);
    return d >= sevenDaysAgo && d <= today;
  }).length;

  const interviews = applications.filter((a) => a.status === 'interview').length;

  const followUpsDue = applications.filter((a) => {
    if (!a.followUp) return false;
    return parseLocalDate(a.followUp) <= sevenDaysAhead;
  }).length;

  return { total, appliedThisWeek, interviews, followUpsDue };
}

if (typeof module !== 'undefined') {
  module.exports = {
    STATUSES,
    uid,
    looksLikeUrl,
    matchesSearch,
    parseLocalDate,
    formatDate,
    daysUntil,
    computeStats,
  };
}
