# Contributing to Applyd

This is the guide I wish existed before I touched this code again after a
few weeks away from it. It's written for whoever adds the next feature —
which is probably future me, but is written as if it's someone else,
because right now I'm the only person who knows where the sharp edges
are.

If you just want to run the app, see `README.md`. This file is about
changing it safely.

## Code layout, and why it's split this way

```
index.html       structure: header, stats, the board, the add/edit dialog
styles.css       all styling
logic.js         pure functions — no DOM, no `document`, no `window`
logic.test.js    checks for logic.js, run with plain Node
app.js           DOM wiring: rendering, events, storage, focus management
```

The split that matters most is **logic.js vs. app.js**. Everything in
`logic.js` is a pure function: given the same input, it always returns
the same output, and it never touches the page. `app.js` is the opposite
— it's almost entirely DOM manipulation, event listeners, and
`localStorage` calls.

That split exists for one reason: **pure functions are the only part of
this app that can be checked automatically without a browser or a
testing framework installed.** `daysUntil`, `matchesSearch`,
`looksLikeUrl`, `computeStats` — these are exactly the functions that
had subtle bugs during development (a timezone-parsing bug in the date
math is the reason `parseLocalDate` exists at all — see "Fragile parts"
below). Pulling them out where they can be tested in isolation is what
caught the second version of that same bug, in the test file itself,
before it shipped. See "How to run the checks."

Everything else — building DOM nodes, wiring up the dialog, deciding
when to show the empty state — stays in `app.js`. It's not tested
automatically, because doing so would mean pulling in a browser
automation tool (Playwright, jsdom, etc.), which conflicts with the
project's actual constraint: no dependencies, no install step, nothing
that can go stale or fail to install on someone else's machine. That's a
real trade-off, not an oversight — see "What this doesn't cover" at the
end.

There's no framework and no build step anywhere in this stack, on
purpose — see `README.md`'s "Why no framework, no backend" for the
reasoning; it applies here too.

## Where a new feature goes

Ask two questions, in this order:

**1. Does it need to touch the DOM, storage, or an event?**
If no — it's a pure calculation or a validation rule — it goes in
`logic.js`, with a corresponding test in `logic.test.js`. Example: a
"days since applied" indicator would be a new function next to
`daysUntil`, tested the same way `daysUntil` is tested.

**2. If yes, which part of `app.js`?**
`app.js` is organized top to bottom in the order things happen, not
alphabetically:

1. Storage (`loadApplications`, `saveApplications`) — near the top
2. DOM element references (the `const ... = document.getElementById(...)`
   block)
3. Rendering (`renderCard`, `renderBoard`, `updateStats`, `render`)
4. Dialog open/close and focus management
5. The form submit handler
6. Wiring (the event listeners at the bottom, and the initial `render()`
   call)

A genuinely new *feature* — say, tagging applications with a resume
version used — touches several of these in order: add the field to the
form in `index.html`, read/write it in the submit handler and
`openEditDialog` (step 5/4), display it in `renderCard` (step 3), and if
it's something worth summarizing, extend `computeStats` in `logic.js`
with a test for it.

A new **status** (e.g. "Withdrawn") is a special case — see the second
fragile part below before you add one.

A new **top-level view** (anything that isn't a variation on the
board/dialog pattern) doesn't have an established place yet. That's a
sign the current structure has reached its limit, not a sign you're
doing it wrong — at that point, this file's guidance about "where things
go" should be treated as due for a rewrite, not stretched to fit.

## How to run the checks

No install step:

```
node --test
```

That's it — `node:test` and `node:assert` ship with Node itself (18+;
this was built and tested on Node 22). There is no `package.json` and
nothing to `npm install`, on purpose: the checks are as dependency-free
as the app itself, so they can't go stale or fail to install for someone
who clones this a year from now.

A passing run ends with:

```
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`# fail 0` is the number that matters. If you change anything in
`logic.js`, run this before committing. If you add a new pure function,
add a test for it in the same commit — `logic.test.js` is small enough
right now that there's no excuse for it to fall behind.

There is no automated check for `app.js` (see "What this doesn't cover"
below) — changes there are verified by hand: open `index.html`, and walk
through the scenarios in `README.md`'s "Failure and empty states"
section, since those are the behaviors most likely to silently break.

## Fragile parts

Every project has parts that work but would break in a way that isn't
obvious from reading the change that broke them. These are Applyd's.

### 1. Every render is a full rebuild — event listeners don't survive it

`renderBoard()` does `boardEl.innerHTML = ''` and rebuilds every card
from scratch, every time anything changes. This is simple and was the
right call for a board this size, but it has a consequence that isn't
obvious: **any event listener attached to something inside a card only
lives until the next render.** The `.card-status` `<select>` listeners
are re-attached at the end of every `renderBoard()` call for exactly
this reason — search for `querySelectorAll('.card-status')` and you'll
see it happening again, identically, every time.

If you add a new interactive element inside a card (a quick-delete
button, a checkbox, anything), and you attach its listener only once,
outside of `renderBoard()`, **it will work exactly once** — the first
render — and then silently stop doing anything after the first save,
status change, or search, because the element it was attached to no
longer exists. This is the single most likely way a future feature
breaks quietly. Either re-attach inside `renderBoard()` like
`.card-status` does, or switch to event delegation on `boardEl` (the way
opening a card for editing already works — see the `boardEl.addEventListener('click', ...)`
block).

### 2. A status is defined in three places that don't check each other

Adding or renaming a status (`saved`, `applied`, `interview`, `offer`,
`rejected`) means updating **all** of:

- `STATUSES` in `logic.js` (drives the columns and the dropdown options
  on each card)
- the hard-coded `<option>` list inside the `<select id="status">` in
  `index.html`'s dialog (drives what you can pick when adding/editing —
  this one is not generated from `STATUSES`, and nothing warns you if it
  drifts)
- the `.column-<status>` and `.card-<status>` color rules in `styles.css`

Nothing enforces these staying in sync. Add a status to `STATUSES` alone,
and applications can be *assigned* that status internally but can't be
*picked* from the form, and will render with no color accent — no error,
just a card that looks unfinished. If you add a status, change all three
in the same commit, and consider whether it's worth generating the
dialog's `<option>` list from `STATUSES` at that point rather than
leaving it hand-written twice.

### 3. Every date is a string, and the "T00:00:00" isn't optional

Dates come out of `<input type="date">` as plain `"YYYY-MM-DD"` strings.
`parseLocalDate` in `logic.js` turns one into a `Date` by appending
`'T00:00:00'` before calling `new Date(...)`. That's not a stylistic
choice — a bare `"YYYY-MM-DD"` is parsed as **UTC midnight** by the spec,
which silently becomes "yesterday, in the evening" in any timezone west
of UTC. This exact bug shipped once, in the "applied this week" stat,
before being caught and fixed (see the git history — it's its own
commit).

Anywhere you handle a date string, go through `parseLocalDate` (or
`daysUntil`/`formatDate`, which already do). Don't call `new Date(iso)`
directly on a date-only string — it will work correctly for exactly the
timezone the developer testing it happens to be in, and be wrong for
everyone else.

### 4. `localStorage` has no schema version, and no migration path

The array saved under `applyd:applications` is just whatever shape the
current code writes — there's no version field, and no migration
function. This means: if you rename a field (`jobUrl` → `url`, say) or
change what a field contains, **everyone's existing saved data silently
stops matching what the new code expects.** It won't crash — the
corrupted-data recovery banner (see `README.md`) only fires on invalid
JSON, not on valid JSON with the wrong shape — it'll just quietly show
blank or wrong values for the renamed field, for every application
someone already saved.

If you change the shape of an application object, write a small
migration in `loadApplications()` that detects the old shape and
converts it, the same way you'd version an API response. There's no
example of this in the code yet, because it hasn't been needed — this is
a "when you get there" warning, not a pattern to copy.

## What this doesn't cover

Deliberately: `app.js` itself has no automated tests. Testing DOM
rendering and event wiring without a framework means either hand-rolling
a fake DOM or pulling in a real one (jsdom, Playwright, etc.) — both are
real solutions, but both reintroduce the dependency/install-step problem
this whole project has avoided everywhere else. For a board this size,
manual verification against the "Failure and empty states" checklist in
`README.md` was the trade-off made instead. If `app.js` grows
significantly, that trade-off is worth revisiting — but changing it
means accepting a first real dependency, which should be a deliberate
decision, not something that happens by accident because one test
needed it.
