# Architecture

## Overview

A single FastAPI process (`app.py`) serves both the JSON API and the static
frontend. All persistent state is stored in one SQLite database. The frontend
is plain HTML, CSS and JavaScript with no build step; course content is
JavaScript data rendered client-side.

```
Browser ──HTTPS──> Caddy ──HTTP──> app.py (FastAPI) ──> SQLite (WAL)
                     │                 │
                     └── /media        └── static files (allowlisted)
```

Blocking work (SQLite queries, scrypt hashing) runs in the thread pool, never
on the event loop. Schema migrations and the expiry sweep run in the lifespan
handler, so they apply under any ASGI server.

## Request handling

Every request passes through the `guard` middleware:

1. **Gate:** static paths must match an allowlist (page files and the `css/`,
   `js/`, `tracks/`, `assets/` trees; no hidden or relative segments). API
   writes must be `application/json`. Bodies over 300 KB are rejected.
2. **Authentication:** non-API paths other than the sign-in page, its assets
   and the privacy policy require a valid session. Pages redirect to
   `/account.html?next=...`; other resources return 401. API endpoints
   authenticate individually.
3. **Response headers:** caching policy (`no-store` for the API,
   `private, max-age=86400` for course assets and media, revalidation for
   pages), CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
   `Referrer-Policy`, `X-Robots-Tag: noindex`.

Responses are gzip-compressed in the application, except `/media`.

## Data model

| Table | Purpose |
|-------|---------|
| `users` | Credentials (scrypt hash + salt), email, admin flag, leaderboard opt-in, XP snapshot (total and weekly baseline), temporary-password state |
| `sessions` | Session tokens (30-day lifetime) |
| `state` | One JSON blob per user mirroring the synced localStorage keys |
| `join_links` | Invitation links (token hash, recipient note, expiry, usage) |
| `lessons` | Admin-authored lessons and overrides of built-in lessons |
| `announcements` | Site-wide banners |
| `admin_log` | Audit trail of administrative changes |

Usernames and emails are unique case-insensitively. Migrations are additive and
idempotent (`init_db`). Expired sessions and invitation links are swept at
startup and hourly.

## Frontend

**Content as data.** Each file in `js/data/` registers a track (modules,
lessons, exercises, quizzes) on `window.ACADEMY_1991`. Pages are thin shells
that render from this data. Routing within a page uses the URL hash
(`tracks/dl.html#dl-2-2`).

**Script order** on a page: `common.js`, `i18n.js`, `auth.js`, state modules
(`progress.js`, `xp.js`, `review.js`), track data, Armenian packs,
`/api/content.js` with `custom-content.js` (admin-authored content), then the
page controller.

**State is local-first.** Progress, XP, review cards and the language setting
live in localStorage under the `1991_academy:` prefix:

| Key | Contents |
|-----|----------|
| `1991_academy:progress:v1` | Completed lessons, quiz scores, streak |
| `1991_academy:xp:v1` | XP total, award ledger, daily goal, badges |
| `1991_academy:review:v1` | Spaced-repetition cards |
| `1991_academy:lang` | UI language |

Theme and other device preferences are not synchronised.

**Sync.** When signed in, changes are pushed to `PUT /api/state` after a
1.5-second debounce and flushed on `pagehide` (fetch with `keepalive`). On
sign-in, state is reconciled: if the device holds another account's data, the
server copy is adopted; otherwise the copy with more XP wins. If the payload
exceeds the size budget, the largest code drafts are dropped first; progress
is never dropped. The server extracts an XP snapshot from the blob for the
leaderboard and rebases the weekly baseline on the first sync of each ISO week.

**State-change events.** `progress.js`, `xp.js` and `review.js` cache their
parsed blobs. External writers (sync pulls, other tabs) call
`notifyStateChanged()`, which invalidates caches and lets page controllers
re-render in place (`onStateChanged`). Only a language change forces a reload.

**XP ledger.** Each award has a stable key (`lesson:web-1-1`,
`ex:dsa-2-1:0`, `mission:mission-maze`) and is paid out at most once.

## Exercises and notebooks

In-page exercises (ordering, blanks, matching, worked math problems) are
rendered by `js/exercises.js`. Coding exercises are Python and are solved in
Google Colab: `tools/build_notebooks.py` generates one notebook per exercise
(task, starter code, test cell, hints, and for Lab problems a visualization)
into `assets/colab/<en|hy>/`. Learners download the notebook, upload it to
Colab and mark the exercise as solved. No user code runs on the server or in
the site's pages; the CSP forbids `eval` and workers.

The test suite fails when notebooks are out of date, and executes each one with
a reference solution (must pass) and with the starter code (must fail).

## Internationalization

`js/i18n.js` uses English strings as dictionary keys: `t("Mark as complete")`
returns the Armenian translation in Armenian mode and the key otherwise.
Content fields are localized with `_hy` siblings (`title_hy`, `content_hy`,
quiz `q_hy`, etc.), read through `L(obj, "field")`. Static HTML uses
`data-i18n` attributes. Track content is translated by per-track packs in
`js/data/i18n-hy-*.js`, loaded after the corresponding data file. Code,
starter code and test names are not translated.

Do not name a local variable `t`; it shadows the translation function.

## Admin-authored content

`/api/content.js` returns published lessons, active announcements and the
self-hosted media index as a script (`window.ACADEMY_CUSTOM`), so it is
available before the first render. `js/custom-content.js` merges it into the
track data: a lesson whose id matches a built-in lesson overrides its text;
other lessons are inserted at the configured position. Unauthenticated
requests receive announcements only.

## Media

Lecture videos are YouTube embeds (`youtube-nocookie.com`, loaded on click).
Self-hosted copies named `<youtube-id>.mp4` in `MEDIA_DIR` take precedence
when present. In production Caddy serves them directly after an
authentication subrequest; otherwise the application serves them with range
support.
