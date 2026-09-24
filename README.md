# 1991 Academy ⚡

A personal learning platform: seven structured tracks — **Mathematics for ML, Programming for ML, Web Development, Machine Learning, Deep Learning, Agentic AI, and Algorithms & Data Structures** — built like Duolingo-meets-freeCodeCamp:

- **XP everywhere** — lessons (+20), quiz answers (+5), exercises (+15), missions (+60), lab problems (+30–80), reviews (+5). One currency feeds the daily goal, levels (Spark → Sage), streak and achievements. First-try perfect quizzes pay a random bonus (variable reward).
- **Video lectures** embedded per-lesson — hand-picked free courses (3Blue1Brown, Karpathy, freeCodeCamp, Traversy) plus the full FAST "Mathematics for ML" lecture series — click-to-play YouTube no-cookie embeds, no API keys.
- **Interactive exercises** inside lessons — Parsons problems (reorder code), faded blanks, matching pairs.
- **Missions** — real coding challenges (in-browser editor + sandboxed tests in a Web Worker) that need ideas from *two tracks at once*, unlocked by completing their prerequisite lessons.
- **The Lab** — implement-it-yourself practice in **JavaScript, Python, or C++**: LeetCode-style DSA problems, classical ML models (k-NN, linear regression, k-means) and neural networks (perceptron, XOR MLP with backprop) written from scratch — then **visualized live by your own code**: your sort animating as bars, your BFS snaking through a maze, your k-means centroids marching, your network's decision boundary solving XOR.
  - **JavaScript** runs in-page; **Python** runs in-browser via Pyodide (WebAssembly CPython, loaded from a CDN on first use); **C++** compiles and runs on the server via the system `c++`/`g++`. The editor has syntax highlighting, line numbers, and LeetCode-style auto-closing brackets/smart indent.
- **Practice** — spaced repetition: quiz questions from completed lessons become review cards, due just before you'd forget them.
- **Achievements, streak, daily goal ring** — loss-aversion mechanics that make skipping a day feel expensive.

Plus **accounts**: register/sign in with username-or-email + password, and progress syncs to a local SQLite database — sign in on any device on your network and continue where you left off. Guests lose nothing: everything also works signed-out, stored in the browser.

No build step; the frontend is pure dependency-free HTML/CSS/JS. The backend is a single FastAPI app (`app.py`) — the one place dependencies live (`requirements.txt` + `.venv`).

## Bilingual: English / Հայերեն

The nav has a language toggle (persisted as `martinium:lang`, synced with the
account). `js/i18n.js` translates the UI: **English strings are the dictionary
keys**, so `t("Mark as complete")` returns Armenian in hy mode and the key
itself otherwise — anything untranslated gracefully falls back to English.
**Never name a local variable `t`** — it shadows the global translate function
and silently breaks Armenian in that scope. Theme objects in `lab-viz.js` are
called `th` for exactly this reason.
Content is translated per-field: add `title_hy` / `content_hy` / `tagline_hy`
/ quiz `q_hy`/`options_hy`/`explain_hy` / exercise `prompt_hy` / mission &
Lab `brief_hy`/`hints_hy` etc. next to the English fields; renderers read
through `L(obj, "field")`. Static HTML uses `data-i18n="key"` attributes,
applied only in hy mode.

**The full site is bilingual.** `js/data/i18n-hy.js` carries the UI chrome
plus every track/module title, the 24 web/dsa/agents lesson titles, and the
Lab cards; one **per-track content pack** then translates that track's lesson
bodies, takeaways and quizzes: `i18n-hy-web.js`, `-dsa.js`, `-agents.js`,
`-math.js` (also the 14 Linear-Algebra homework problems, with KaTeX kept
byte-identical), `-ml.js`, `-dl.js`, `-prog.js`, plus `i18n-hy-missions.js`
and `i18n-hy-lab.js` for the cross-track missions and Lab briefs/hints. Each
pack guards on its data file being present and must load **after** it (course
tracks: after `ml-course.js`/`dl-course.js` too). Code blocks, `<pre>`,
starter code and `__check` test names stay English by design. The Programming
track's exercise prompts use the FAST course's own Armenian wording from its
bilingual homework notebooks. `Noto Sans Armenian` is in the font stack; the
Pyodide loader's status strings route through `t()`. To translate more, add
`_hy` fields — no code changes needed.

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
.venv/bin/python app.py
# → http://localhost:8735   (accounts, sync, leaderboard, C++ runner)
```

Production setup (HTTPS, systemd, env flags): see `DEPLOYMENT.md`.

`app.py` is an ordinary ASGI app, so `.venv/bin/uvicorn app:app --port 8735`
works too — the schema and the expiry sweep are set up by its lifespan handler,
not by `__main__`.

> The old stdlib `server.py` was removed. It had drifted to implementing only
> six of the fifteen endpoints (change-password, password reset, account
> deletion, the leaderboard and `/api/health` all 404'd under it) and carried
> none of the rate limiting, body caps, security headers or path allowlist.

Or just open `index.html` / serve statically with `python3 -m http.server` — the site fully works, accounts are simply disabled (the account page explains how to enable them).

### Account management

Signed in, the account page also offers **change password**, **forgot/reset
password** (emailed link) and **delete account** (GDPR-clean cascade). Password
reset needs SMTP — set `ACADEMY_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` /
`_FROM` and `ACADEMY_BASE_URL` (the origin used to build the reset link). With
SMTP unset the reset link is **logged, not sent** (fine for local dev). The
leaderboard has **This week / All time** tabs — the weekly league resets every
ISO week (server rebases each user's weekly baseline on their first sync of a
new week).

### Tests

```bash
.venv/bin/pip install -r requirements-dev.txt   # pytest + httpx, dev only
.venv/bin/pytest -q                              # 18 API tests, temp DB, no real accounts touched
```

## Structure

```
1991 Academy/
├── app.py                FastAPI backend: auth, sync, leaderboard, C++ runner, static
├── DEPLOYMENT.md         HTTPS / systemd / env-flag production guide
├── index.html            Dashboard: goal ring, level, tracks, missions, badges
├── missions.html         Cross-track coding challenges (editor + tests)
├── lab.html              The Lab: implement + visualize problems
├── practice.html         Spaced-repetition review sessions
├── account.html          Sign in / create account / profile
├── tracks/               One shell page per track (identical except track id)
│   ├── math.html  web.html  ml.html  dl.html  agents.html  dsa.html
├── css/
│   ├── tokens.css        Design tokens: colors, fonts, radii (dark/light themes)
│   ├── base.css          Reset + typography + layout primitives
│   ├── components.css    Navbar, cards, lesson reader, quiz, toast…
│   └── game.css          XP pill, goal ring, exercises, missions, practice
└── js/
    ├── common.js         Namespace, theme toggle, queued toasts, helpers
    ├── auth.js           Session check, login/register calls, progress sync
    ├── account-page.js   Account page: forms + profile
    ├── progress.js       localStorage: lesson completion, streak
    ├── xp.js             XP ledger, levels, daily goal, achievements
    ├── review.js         Spaced-repetition card store & scheduling
    ├── exercises.js      Parsons/blanks/match/problem/code renderers
    ├── editor.js         Code editor: highlight, line numbers, auto-close brackets
    ├── runner.js         ALL sandboxed execution: JS + Python in Web Workers,
    │                     C++ via the API, plus the shared test-results renderer
    ├── main.js           Landing page rendering
    ├── track.js          Track page: sidebar, lesson reader, quiz engine, routing
    ├── missions-page.js  Mission cards, lock logic, editor, test UI
    ├── lab-page.js       Lab problem browser, editor, multi-language run, visualize
    ├── lab-viz.js        Canvas renderers driven by the learner's code
    ├── practice-page.js  Review session flow
    └── data/             All content lives here
        ├── math.js  web.js  ml.js  dl.js  agents.js  dsa.js   (tracks)
        ├── ml-course.js  dl-course.js                         (FAST course rebuilds of the ml/dl tracks)
        ├── math-exercises.js  math-exercises-2.js             (math homework problems + course materials)
        ├── missions.js                                        (cross-track missions)
        ├── lab.js                                             (Lab problems + JS + viz configs)
        ├── lab-py.js                                          (Python variants of Lab problems)
        ├── lab-cpp.js                                         (C++ variants of the pure-algorithm problems)
        ├── i18n-hy.js                                         (Armenian: UI chrome + all titles + Lab cards)
        └── i18n-hy-{web,dsa,agents,math,ml,dl,prog,missions,lab}.js  (Armenian per-track/section content packs)
```

## How it works

- **Content is data.** Each `js/data/*.js` file registers a track object (modules → lessons → exercises → quiz questions) on `window.MARTINIUM`. Pages are thin shells that render from it.
- **State is local-first.** Progress (`martinium:progress:v1`), XP/badges (`martinium:xp:v1`), review cards (`martinium:review:v1`), the language choice (`martinium:lang`) and code drafts (`martinium:draft:*`) live in localStorage. Signed in, the same keys are pushed to `/api/state` ~1.5 s after every change (coalesced into one request, and flushed on `pagehide`) and pulled back on any device you sign in on. Conflict rule: the copy with more XP wins; signing in as a *different* user on a shared device always adopts that account's server copy. The theme and per-problem editor language stay device-local on purpose.
- **State changes are announced, not reloaded.** `Progress`/`XP`/`Review` cache their parsed blob, so a render pass parses it once instead of forty times. Anything that rewrites those keys from outside — a sync pull, or another tab — calls `notifyStateChanged()` (`js/common.js`), which drops the caches and fires `martinium:state-changed`; page controllers subscribe with `onStateChanged(render)` and redraw in place. Open editors and in-progress practice sessions are deliberately left alone. Only a language change still forces a reload, because the language is baked into every rendered string.
- **If a sync fails, you are told once.** Oversized payloads shed the largest code drafts first so progress always gets through; a 401 signs you out cleanly; repeated failures toast once, not every 1.5 seconds.
- **Auth is boring on purpose.** Passwords are scrypt-hashed with per-user salts; sessions are random tokens in an HttpOnly cookie (30 days); users, sessions and state blobs live in `1991_academy.db` (SQLite). The FastAPI backend adds rate limiting (login/register/reset/C++ runner), request-size caps, structured logging, `/api/health` and env-based config — see `DEPLOYMENT.md` before exposing it to the open internet (HTTPS required; set `ACADEMY_CPP=0` publicly). Change-password and password-reset rotate the hash and invalidate sessions; reset tokens are SHA-256-hashed, single-use and expire in 1 hour; `forgot-password` always returns the same response (no email enumeration). Expired sessions and reset tokens are swept at startup and hourly.
- **Nothing blocking runs on the event loop.** SQLite, scrypt and the C++ subprocess all go through `run_in_threadpool`. This matters: a single 25-second C++ compile used to stall every other request on the server, including static files.
- **The web root is an allowlist, not a blocklist.** Only `/`, the five page files and the `css/ js/ tracks/ assets/` trees are reachable. The previous extension blocklist could be walked around by case (`/APP.PY` resolves to `app.py` on macOS and Windows volumes, which served the backend source and the credentials database) and simultaneously 404'd the legitimate `.py` starter files under `assets/courses/`.
- **The database is indexed.** `init_db()` creates `CREATE INDEX IF NOT EXISTS` entries on every start (idempotent, data-safe, and applied to existing DBs too): case-insensitive `username`/`email` for login-by-either, a composite `(leaderboard_opt_in, xp_total DESC)` so the leaderboard is an indexed search rather than a full scan, and `sessions(user_id)` for per-user session cleanup. Session-token, `state.user_id` and the UNIQUE columns are already covered by their PRIMARY KEY / UNIQUE constraints.
- **Images are lean by design.** The logo and every favicon are inline SVG; the only raster images the UI renders are YouTube thumbnails, served `loading="lazy" decoding="async"` with intrinsic dimensions inside an `aspect-ratio` box (no layout shift), and the players are click-to-play `youtube-nocookie` iframes injected only on click. The 200-odd raster files under `assets/courses/**` are FAST homework **datasets** (downloaded, not displayed) and are deliberately left byte-for-byte intact. Any future in-UI image should be WebP/AVIF, lazy-loaded, with width/height set.
- **XP is ledgered.** Every award has a key (`lesson:web-1-1`, `ex:dsa-2-1:0`, `mission:mission-maze`) paid out once — nothing can be farmed by re-doing.
- **Learner code never touches the main thread.** `js/runner.js` is the single entry point for every execution path — `Runner.javascript` / `Runner.python` / `Runner.cpp` for tests, `Runner.computeJavascript` / `Runner.computePython` for visualizations — and they all return the same `{error?, results[]}` / `{error?, data}` shape and share one results renderer. JS runs in a Web Worker (3 s for tests, 15 s for a visualization) that is terminated on timeout; Python runs in a long-lived Pyodide worker with runs serialized, so a second click can never land mid-run on the shared interpreter; C++ posts to `POST /api/run-cpp`. An accidental `while (true)` anywhere — tests *or* visualize — times out instead of freezing the tab.
- **Lab languages.** Same `__check(name, actual, expected)` protocol in all three. C++ is a **local dev convenience** (it compiles and runs on the machine hosting `app.py`) — keep it on localhost/trusted LAN, and set `ACADEMY_CPP=0` in production. Visualizations run from JS or Python only; each `LabViz.computeJS[kind]` is self-contained so its source can be shipped into the worker verbatim.
- **Dev server sends `Cache-Control: no-store`** so edits to JS/CSS show up on reload instead of a stale cached bundle.
- **Routing is the URL hash.** `tracks/dl.html#dl-2-2` deep-links to a lesson, `missions.html#mission-maze` to a mission.
- **Theming is one attribute.** `data-theme="dark|light"` on `<html>` swaps CSS custom properties; each track sets its accent via `data-track` on `<body>`.

## Add a mission

Append an object to `js/data/missions.js`: `id`, `title`, `icon`, `tracks`, `prereqs` (lesson ids that unlock it), `xp`, `blurb`, `brief` (HTML), `starter` code, `tests` (a script calling `__check(name, actual, expected)`), and `hints`. Lock logic, editor and scoring are automatic.

## Add a video to a lesson

Add a `videos: [...]` array to any lesson — rendered as click-to-play cards (plain
YouTube no-cookie embeds; no API keys or authorization involved):

```js
videos: [
  { id: "aircAruvnKk", title: "But what is a neural network?", channel: "3Blue1Brown", length: "19 min" },
],
```

## Add an exercise to a lesson

Add an `exercises: [...]` array to any lesson. Three types:

```js
{ type: "order",  title, prompt, lines: ["line 1", "line 2", ...] }          // Parsons
{ type: "blanks", title, prompt, code: "a {{0}} b", blanks: [{options, answer}] }
{ type: "match",  title, prompt, pairs: [["left", "right"], ...] }
{ type: "problem", title, prompt, source, statement, solution }              // worked math problem
{ type: "code", title, prompt, source, fnName, starter, tests }              // auto-graded Python
```

The `code` type embeds the full editor + in-browser Python grader inside a
lesson (used by the Programming for ML track — its exercises are the FAST
course's real homework, often with the course's original asserts). The page
must include `editor.js` and `pyrunner.js` (see `tracks/prog.html`). NumPy
imports auto-download the package on first run.

Course materials (slides, homework notebooks/PDFs, datasets) are local copies
under `assets/courses/` — add a `materials: [{label, href}]` array to any
lesson to render download buttons.

The `problem` type is for work-on-paper math (used by the Mathematics track's
homework problems, extracted from the FAST course problem sets): attempt →
"Show worked answer" → "I solved it ✓" (honor system, +15 XP). `statement` and
`solution` are HTML with `\( … \)` / `\[ … \]` LaTeX — author them with
`String.raw` (see `js/data/math-exercises.js` for the Linear Algebra set, and
`js/data/math-exercises-2.js` for the Calculus / Probability / Signals set) and
KaTeX renders them via the `typesetMath` hook defined in `tracks/math.html`.
**42 problems in total** — the 14 Linear-Algebra ones (Homeworks 1–4) plus 28
across modules 2–4 (Homeworks 5–11, two per lesson) — each bilingual
(`statement_hy`/`solution_hy`, KaTeX kept byte-identical) and every answer
verified numerically against numpy before shipping.

## Add a lesson

Open the track's file in `js/data/`, add an object to a module's `lessons` array:

```js
{
  id: "web-2-4",            // unique, used for progress + deep links
  title: "New Lesson",
  minutes: 10,
  content: `<p>HTML content…</p>`,
  takeaways: ["…"],
  quiz: [
    { q: "…?", options: ["A", "B", "C", "D"], answer: 1, explain: "…" }
  ]
}
```

Sidebar, progress, quiz and navigation pick it up automatically.

## Keyboard shortcuts

- `[` / `]` — previous / next lesson on a track page.
