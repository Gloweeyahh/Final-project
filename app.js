/**
 * Applyd — a job application tracker.
 * Vanilla JS, no build step, no framework: see README for why.
 */

const STORAGE_KEY = 'applyd:applications';

// Storage is treated as something that can fail in two different ways,
// each needing a different message:
//  - the saved data exists but can't be parsed (corrupted) → recover
//    by starting fresh, and say so.
//  - storage itself throws on read or write (blocked, full, disabled —
//    common in private/incognito modes) → keep working in-memory for
//    this session, and say so once, rather than fail silently.
let loadWarning = null;

function loadApplications() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    loadWarning = {
      type: 'error',
      message: "Your browser is blocking local storage (this is common in private/incognito mode), so nothing will be saved between visits. You can still use Applyd for this session.",
    };
    return [];
  }

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Saved data was not a list.');
    return parsed;
  } catch (err) {
    loadWarning = {
      type: 'warning',
      message: "Your saved data couldn't be read, so Applyd is starting fresh to keep working. (Technical detail: " + err.message + ")",
    };
    return [];
  }
}

function saveApplications() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    return true;
  } catch (err) {
    showBanner('error', "Couldn't save your last change — your browser's storage might be full or blocked. It'll only last for this session.");
    return false;
  }
}

let applications = loadApplications();

function uid() {
  return 'app_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const STATUSES = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
];

/* ---------------- DOM refs ---------------- */
const boardEl = document.getElementById('board');
const addBtn = document.getElementById('add-btn');
const emptyAddBtn = document.getElementById('empty-add-btn');
const emptyStateEl = document.getElementById('empty-state');
const boardWrapEl = document.getElementById('board-wrap');
const searchInput = document.getElementById('search');
const resultSummaryEl = document.getElementById('result-summary');
const noResultsEl = document.getElementById('no-results');
const noResultsTermEl = document.getElementById('no-results-term');
const bannerRegion = document.getElementById('banner-region');

function showBanner(type, message) {
  bannerRegion.innerHTML = `
    <div class="banner banner-${type}">
      <span>${escapeHtml(message)}</span>
      <button type="button" class="banner-dismiss" aria-label="Dismiss">&times;</button>
    </div>`;
  bannerRegion.querySelector('.banner-dismiss').addEventListener('click', () => {
    bannerRegion.innerHTML = '';
  });
}
const dialog = document.getElementById('app-dialog');
const form = document.getElementById('app-form');
const closeBtn = document.getElementById('dialog-close-btn');
const formError = document.getElementById('form-error');
const urlError = document.getElementById('url-error');
const dialogTitle = document.getElementById('dialog-title');
const deleteBtn = document.getElementById('delete-btn');
const saveBtn = document.getElementById('save-btn');
const idField = document.getElementById('app-id');

function looksLikeUrl(value) {
  if (!value) return true; // optional field
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ---------------- rendering ---------------- */
function statusOptionsHtml(selected) {
  return STATUSES.map(
    (s) => `<option value="${s.key}"${s.key === selected ? ' selected' : ''}>${s.label}</option>`
  ).join('');
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(iso) {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function renderCard(app) {
  const li = document.createElement('li');
  li.className = `card card-${app.status}`;

  const metaBits = [];
  if (app.location) metaBits.push(escapeHtml(app.location));
  if (app.workType) metaBits.push(escapeHtml(app.workType));
  if (app.dateApplied) metaBits.push('Applied ' + formatDate(app.dateApplied));

  let deadlineHtml = '';
  if (app.deadline) {
    const days = daysUntil(app.deadline);
    const label = days < 0 ? 'Deadline passed' : days === 0 ? 'Deadline today' : `Deadline in ${days}d`;
    const urgent = days <= 3;
    deadlineHtml = `<span class="card-flag${urgent ? ' card-flag-urgent' : ''}">${label}</span>`;
  }

  li.innerHTML = `
    <button type="button" class="card-main" data-id="${app.id}">
      <span class="card-title">${escapeHtml(app.title)}</span>
      <span class="card-company">${escapeHtml(app.company)}</span>
      ${metaBits.length ? `<span class="card-meta">${metaBits.join(' · ')}</span>` : ''}
      ${deadlineHtml}
    </button>
    <div class="card-status-row">
      <label class="visually-hidden" for="status-${app.id}">Status for ${escapeHtml(app.title)}</label>
      <select id="status-${app.id}" class="card-status" data-id="${app.id}">
        ${statusOptionsHtml(app.status)}
      </select>
    </div>`;
  return li;
}

function matchesSearch(app, term) {
  if (!term) return true;
  const haystack = `${app.company} ${app.title}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function renderBoard(searchTerm) {
  updateStats();
  const term = (searchTerm ?? '').trim();
  const visible = applications.filter((a) => matchesSearch(a, term));

  noResultsEl.hidden = !(term && visible.length === 0);
  if (term && visible.length === 0) {
    noResultsTermEl.textContent = term;
  }
  boardEl.hidden = term && visible.length === 0;

  resultSummaryEl.textContent = term
    ? `${visible.length} of ${applications.length} application${applications.length === 1 ? '' : 's'} match "${term}"`
    : `${applications.length} application${applications.length === 1 ? '' : 's'} tracked`;

  boardEl.innerHTML = '';
  for (const statusDef of STATUSES) {
    const columnApps = visible.filter((a) => a.status === statusDef.key);

    const column = document.createElement('section');
    column.className = 'column';
    column.setAttribute('aria-labelledby', `col-${statusDef.key}-heading`);

    const header = document.createElement('div');
    header.className = `column-header column-${statusDef.key}`;
    header.innerHTML = `<h2 id="col-${statusDef.key}-heading">${statusDef.label}</h2><span class="column-count">${columnApps.length}</span>`;
    column.appendChild(header);

    const ul = document.createElement('ul');
    ul.className = 'column-list';
    for (const app of columnApps) {
      ul.appendChild(renderCard(app));
    }
    column.appendChild(ul);

    boardEl.appendChild(column);
  }

  boardEl.querySelectorAll('.card-status').forEach((select) => {
    select.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const app = applications.find((a) => a.id === id);
      if (app) {
        app.status = e.target.value;
        saveApplications();
        renderBoard(searchInput.value);
      }
    });
  });
}

const statTotalEl = document.getElementById('stat-total');
const statWeekEl = document.getElementById('stat-week');
const statInterviewsEl = document.getElementById('stat-interviews');
const statFollowupsEl = document.getElementById('stat-followups');

function updateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
  const sevenDaysAhead = new Date(today); sevenDaysAhead.setDate(today.getDate() + 7);

  const total = applications.length;

  const appliedThisWeek = applications.filter((a) => {
    if (!a.dateApplied) return false;
    const d = new Date(a.dateApplied + 'T00:00:00');
    return d >= sevenDaysAgo && d <= today;
  }).length;

  const interviews = applications.filter((a) => a.status === 'interview').length;

  const followUpsDue = applications.filter((a) => {
    if (!a.followUp) return false;
    const d = new Date(a.followUp + 'T00:00:00');
    return d <= sevenDaysAhead;
  }).length;

  statTotalEl.textContent = total;
  statWeekEl.textContent = appliedThisWeek;
  statInterviewsEl.textContent = interviews;
  statFollowupsEl.textContent = followUpsDue;
}

function render() {
  const hasAny = applications.length > 0;
  emptyStateEl.hidden = hasAny;
  boardWrapEl.hidden = !hasAny;
  if (hasAny) renderBoard(searchInput.value);
  updateStats();
}

searchInput.addEventListener('input', () => renderBoard(searchInput.value));

if (loadWarning) showBanner(loadWarning.type, loadWarning.message);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ---------------- dialog open/close ---------------- */
function clearFormErrors() {
  formError.hidden = true;
  urlError.hidden = true;
}

function openAddDialog() {
  form.reset();
  idField.value = '';
  dialogTitle.textContent = 'Add application';
  saveBtn.textContent = 'Save application';
  deleteBtn.hidden = true;
  clearFormErrors();
  dialog.showModal();
}

function openEditDialog(app) {
  form.reset();
  idField.value = app.id;
  document.getElementById('company').value = app.company || '';
  document.getElementById('title').value = app.title || '';
  document.getElementById('job-url').value = app.jobUrl || '';
  document.getElementById('location').value = app.location || '';
  document.getElementById('work-type').value = app.workType || '';
  document.getElementById('status').value = app.status || 'saved';
  document.getElementById('date-applied').value = app.dateApplied || '';
  document.getElementById('deadline').value = app.deadline || '';
  document.getElementById('follow-up').value = app.followUp || '';
  document.getElementById('notes').value = app.notes || '';

  dialogTitle.textContent = 'Edit application';
  saveBtn.textContent = 'Save changes';
  deleteBtn.hidden = false;
  clearFormErrors();
  dialog.showModal();
}

// Cards get rebuilt on every render (innerHTML), so the exact button a
// person clicked won't exist anymore once a save or delete re-renders
// the board. We remember the application id instead of the element,
// and re-find it after render — falling back to "Add application" if
// the card is gone (e.g. it was just deleted).
let lastTrigger = null;
let lastTriggerAppId = null;

addBtn.addEventListener('click', (e) => { lastTrigger = e.currentTarget; lastTriggerAppId = null; openAddDialog(); });
emptyAddBtn.addEventListener('click', (e) => { lastTrigger = e.currentTarget; lastTriggerAppId = null; openAddDialog(); });
closeBtn.addEventListener('click', () => dialog.close());

dialog.addEventListener('close', () => {
  const revived = lastTriggerAppId && document.querySelector(`.card-main[data-id="${lastTriggerAppId}"]`);
  if (revived) {
    revived.focus();
  } else if (lastTrigger && document.contains(lastTrigger)) {
    lastTrigger.focus();
  } else {
    addBtn.focus();
  }
});

// Clicking the ::backdrop area (outside the dialog's own content box)
// closes it, same as Escape or the close button.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

boardEl.addEventListener('click', (event) => {
  const btn = event.target.closest('.card-main');
  if (!btn) return;
  lastTrigger = btn;
  lastTriggerAppId = btn.dataset.id;
  const app = applications.find((a) => a.id === btn.dataset.id);
  if (app) openEditDialog(app);
});

deleteBtn.addEventListener('click', () => {
  const id = idField.value;
  const app = applications.find((a) => a.id === id);
  if (!app) return;
  const ok = confirm(`Delete the application for "${app.title}" at ${app.company}? This can't be undone.`);
  if (!ok) return;
  applications = applications.filter((a) => a.id !== id);
  saveApplications();
  render();
  dialog.close();
});

/* ---------------- form submit ---------------- */
form.addEventListener('submit', (event) => {
  clearFormErrors();

  const company = document.getElementById('company').value.trim();
  const title = document.getElementById('title').value.trim();
  const jobUrl = document.getElementById('job-url').value.trim();
  const status = document.getElementById('status').value;

  let hasError = false;

  if (!company || !title) {
    formError.hidden = false;
    formError.textContent = 'Company and job title are both required.';
    hasError = true;
  }

  if (jobUrl && !looksLikeUrl(jobUrl)) {
    urlError.hidden = false;
    urlError.textContent = "That doesn't look like a full URL — include https:// at the start.";
    hasError = true;
  }

  if (hasError) {
    event.preventDefault();
    return;
  }

  const fields = {
    company,
    title,
    jobUrl,
    location: document.getElementById('location').value.trim(),
    workType: document.getElementById('work-type').value,
    status,
    dateApplied: document.getElementById('date-applied').value || null,
    deadline: document.getElementById('deadline').value || null,
    followUp: document.getElementById('follow-up').value || null,
    notes: document.getElementById('notes').value.trim(),
  };

  const editingId = idField.value;
  if (editingId) {
    const app = applications.find((a) => a.id === editingId);
    if (app) Object.assign(app, fields);
  } else {
    applications.push({ id: uid(), createdAt: new Date().toISOString(), ...fields });
  }

  saveApplications();
  render();
});

render();
