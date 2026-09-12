# Applyd

A small job application tracker, built because I'm actually job hunting
right now and was losing track of what I'd applied to, where things stood,
and what I still owed a follow-up. Not a tutorial project — this is the
tool I wanted to exist, scoped down to what one person, in one browser,
actually needs.

**Live demo:** https://gloweeyahh.github.io/Final-project/

Looking to add a feature rather than just run this? See
`CONTRIBUTING.md` for how the code is laid out, where things go, and
which parts are fragile.

## What it does

- Add an application: company, title, job URL, location, work type,
  status, date applied, deadline, follow-up date, notes.
- See everything grouped into a board by status — Saved, Applied,
  Interview, Offer, Rejected — with a count on each column.
- Move an application between statuses with a dropdown on its card (see
  "What's deliberately not implemented" for why this isn't drag-and-drop).
- Click any card to open, edit, or delete it.
- Search by company or job title, live, across the whole board.
- Four summary numbers up top: total tracked, applied this week,
  interviews in progress, and follow-ups due in the next 7 days.

## Running it locally

There's no build step, no dependencies, no server. Clone the repo and
either:

- open `index.html` directly in a browser, or
- serve the folder with anything static, e.g. `npx serve .` or the
  "Live Server" extension in VS Code.

That's it. Everything runs client-side.

## Why no framework, no backend

I write React day to day, and my first instinct was React + Vite +
Express + Postgres, because that's the "proper" stack. I cut all of it
back deliberately:

- **No framework.** This app's actual complexity — one form, one list
  grouped five ways, some dates — doesn't need one, and plain HTML/CSS/JS
  means anyone can clone this and run it with zero install step, no
  version drift, nothing to go wrong between my machine and a reviewer's.
- **No backend, no database.** Data lives in the browser's `localStorage`.
  That's a real, named limitation (below), not something I'm hiding — but
  it means there's no server to deploy, no environment variables to leak
  or forget, no CORS to debug, and no way for the whole app to be "up on
  my machine, broken on someone else's."

Both choices trade capability for reliability. For a tool that's meant to
actually finish and actually work when someone else opens it, I'd make
that trade again.

## Failure and empty states

These aren't afterthoughts — they're a good chunk of what's actually in
`app.js`.

**Empty state — no applications yet.** On a fresh load (or after
deleting your last application), the board is replaced with a plain
message and an "Add your first application" button, not a blank board
with five empty columns. Reachable immediately: just open the app for
the first time, or delete everything.

**Empty state — a search with no matches.** Distinct from the state
above: searching for something that doesn't match any application shows
"No applications match '…'", not the first-run message. Reachable by
typing anything into the search box that doesn't match your data.

**Failure — corrupted saved data.** If what's in `localStorage` can't be
parsed as valid JSON (or isn't a list), the app doesn't crash or silently
drop your view — it recovers by starting fresh and shows a banner
explaining exactly that, with the technical detail included. To see it:
open devtools, run

```js
localStorage.setItem('applyd:applications', 'not valid json{')
```

then reload the page.

**Failure — storage blocked or full.** Reading or writing `localStorage`
can throw (private/incognito modes often block it, or it can fill up).
Both are caught: a blocked read shows a banner on load saying the app
will work for this session but won't save; a blocked write shows a banner
saying the last change wasn't saved. This is harder to force reliably
from the outside since browsers differ in when they block storage — it's
handled defensively rather than demoed with a specific recipe.

**Form validation.** Company and job title are required, with an inline
message if they're missing — not a silent refusal to submit. A job URL,
if entered, is checked for a plausible `http(s)://` shape before saving.

## What's deliberately not implemented

Stated on purpose, per the brief — these are boundaries I chose, not
things I ran out of time for:

- **No accounts, no sync across devices or browsers.** Data is local to
  one browser. A real multi-device version would need a backend and
  auth; I chose not to build that for a v1 aimed at one person tracking
  their own search.
- **No drag-and-drop.** Status changes through a dropdown on each card
  instead. Accessible drag-and-drop needs real work (or a library) to
  get right for keyboard users; a `<select>` does the same job and is
  keyboard-accessible by default.
- **No CSV export, no browser extension to save a job from a listing
  page, no email reminders for follow-ups, no resume/cover-letter file
  attachments.** All reasonable next features, all cut to keep this
  finishable.
- **No authentication.** There's nothing here that needs protecting
  from other people, since nothing leaves your browser.

## Data and privacy

Everything is stored in your browser's `localStorage`, under the key
`applyd:applications`. Nothing is sent anywhere — there's no network
request in this app at all. Clearing your browser's site data for this
page deletes everything, with no server-side copy to recover it from.

## Files

- `index.html` — structure: header, stats, board, the add/edit dialog
- `styles.css` — all styling, including the board/card/dialog states
- `logic.js` — pure, DOM-free logic (validation, search matching, date
  math, stats) — see `CONTRIBUTING.md` for why this is separate
- `logic.test.js` — automated checks for `logic.js`, run with `node --test`
- `app.js` — DOM rendering, event wiring, and storage handling
- `README.md` — this file
- `CONTRIBUTING.md` — architecture, where a new feature belongs, how to
  run the checks, and the parts of this code that are fragile
