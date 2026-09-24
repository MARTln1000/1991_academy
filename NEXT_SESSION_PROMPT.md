# Prompt for the next session (written by Fable 5 for Opus 4.8)

Copy everything below the line into a new Claude Code session.

---

You are continuing work on **1991 Academy**, my personal learning platform at
`/Users/martin/Desktop/1991_academy`. Work ONLY inside that folder. Read
`README.md` first — it documents the architecture accurately. Previous
sessions (Claude Fable 5) built everything so far; your job is to match those
standards exactly. They are non-negotiable:

1. **Verify before you ship.** Every quiz answer, exercise test and worked
   solution in this project was machine-verified against a reference
   implementation before publishing (reference solution + the site's
   `__check(name, actual, expected)` protocol, run in node/python3 — numpy
   is installed, sympy is NOT). Never publish a test or answer you have not
   verified this way. Never invent YouTube video IDs — verify via oEmbed
   (`youtube.com/oembed?url=...`) or playlist HTML first.
2. **Verify in the browser.** Use the preview tools (launch config name
   `academy`, autoPort, runs the FastAPI `app.py` via `.venv/bin/python`) and drive the real UI: click, run
   graded exercises, screenshot both success and failure paths. The dev
   server sends `Cache-Control: no-store`; if you still see stale JS,
   re-fetch the scripts with `cache: 'reload'` and reload. Clean up any test
   XP/progress you create (localStorage keys prefixed `martinium:`) before
   ending your turn.
3. **Never break user data.** Keep working: the `window.MARTINIUM` JS
   namespace, `martinium:*` localStorage keys, XP award-ledger keys, the
   SQLite file `1991_academy.db` (real accounts), and these
   mission-prerequisite lesson ids — `web-2-1`, `web-2-2`, `dsa-1-2`,
   `dsa-1-3`, `dsa-2-1`, `dsa-2-2`, `ml-1-2`, `ml-2-1`, `agents-2-1`.
   Guest mode (static serving, no account) must keep working after every
   change. Track data files use augmentation modules (`ml-course.js`,
   `dl-course.js`, `math-exercises.js`, `lab-py.js`, `lab-cpp.js`) — follow
   that pattern rather than rewriting base data files.
4. **Report honestly.** Failed test → say so, with output. Lead summaries
   with what happened, in plain sentences, not hype.

## Current state (so you don't rediscover it)
Seven tracks, 85 lessons. Math, Programming, ML and DL tracks are built
directly from the FAST Foundation courses — one lesson per lecture, each
with slide PDFs / homework / datasets served from `assets/courses/{math,
prog,ml,dl}` as download buttons, plus verified YouTube lecture videos for
math and ML (DL has none yet — Martin will provide the playlist; do not
hunt for one yourself). The Lab runs graded JS/Python/C++ problems with
canvas visualizations; lessons embed graded Python exercises (Pyodide),
worked math problems (KaTeX), Parsons/blanks/match interactions; there's
XP/levels/streaks/achievements, spaced-repetition practice, cross-track
missions, accounts with progress sync, and an opt-in XP leaderboard
(FastAPI backend in `app.py`; the legacy stdlib `server.py` has been removed).

## The task: take 1991 Academy from local project to real product

### A. Finish the Armenian translation (infrastructure is DONE — content remains)
The bilingual system already works: `js/i18n.js` (nav toggle, `t(key)` with
English-strings-as-keys and graceful English fallback, `L(obj, "field")`
reading `_hy` content fields, `[data-i18n]` for static HTML) and
`js/data/i18n-hy.js` (the Armenian content pack: all track/module titles,
prog lesson titles, all 21 programming problems in FAST's own Armenian, Lab
cards). All renderers already route through `t()`/`L()`. What remains is
pure translation — add `_hy` fields, no code changes:
- Lesson bodies (`content_hy`), `takeaways_hy` and quizzes
  (`q_hy`/`options_hy`/`explain_hy`) for all 85 lessons — grow
  `i18n-hy.js` or add per-track packs. Translate prose only; keep code
  blocks/`<pre>` in English inside content.
- The 14 math problems' `statement_hy`/`solution_hy` — KaTeX markup must
  survive byte-identical, translate only the prose around it.
- Mission and Lab `brief_hy` + `hints_hy`; exercise test NAMES (the
  `__check` labels) may stay English.
- The Pyodide loading status strings in `js/pyrunner.js` (route its
  onStatus messages through `t()`).
- Add `Noto Sans Armenian` to the font stack as a fallback.
- CAUTION: local variables named `t` shadow the global `t()` — this bug was
  hit twice already; rename locals when you touch a function.
- Verify: toggle live, screenshot both languages, confirm a math lesson
  (KaTeX intact), a graded exercise (still passes), practice in Armenian.

### B. Backend hardening (the FastAPI backend EXISTS — app.py; polish it)
The backend was rewritten as FastAPI (2026-07-08): same /api/* contracts,
in-place DB migration, rate limiting, body caps, structured logging,
/api/health, env config (PORT, ACADEMY_DB, ACADEMY_DEBUG, ACADEMY_CPP) and
an opt-in XP leaderboard (server snapshots XP from the state blob on every
sync; landing panel + account checkbox are live). See DEPLOYMENT.md.
Remaining backend work, in order:
- Password reset / change-password flow (needs an email story or a
  recovery-code scheme — discuss trade-offs with Martin first).
- Account deletion endpoint + button (GDPR-shaped hygiene).
- Leaderboard periods (weekly league resets — the real Duolingo mechanic):
  store weekly XP deltas, not just lifetime totals.
- A tiny pytest suite for the API (register/login/state/leaderboard/rate
  limits) run against a temp DB — the project has no automated API tests.
- Actually deploy it: walk DEPLOYMENT.md on a real host with HTTPS.

### C. Content polish (as time allows, in this order)
1. Math track: extract homework problems 5–11
   (`assets/courses/math/Homeworks/Homework {5..11}.pdf`) into
   `type:"problem"` exercises for the Calculus / Probability / Signals
   lessons — 2 per lesson, every answer numerically verified before
   publishing (same recipe as the 14 live Linear Algebra problems in
   `js/data/math-exercises.js`).
2. Pandas graded exercises for `prog-2-3` — pandas runs in Pyodide
   (`loadPackagesFromImports` is already wired) but verify the tests
   in-browser via the preview before shipping; there is no local pandas.
3. DL homework text extraction: the six DL homework PDFs in
   `assets/courses/dl/Homeworks/Problems/` are short and task-based; where
   a task is checkable (e.g. HW1's "approximate √(1+x) with a linear
   model"), consider a graded Lab-style exercise — verified end-to-end
   like everything else.

## Ground rules recap
- Zero frontend build steps; vanilla JS stays vanilla. Allowed dependency
  surface: the Python backend (B) and the CDN runtime assets already in
  use (KaTeX, Pyodide, Google Fonts, YouTube embeds).
- Update `README.md` for everything you change; keep the auto-memory notes
  current (the project memory lives under the Ditaket project's memory
  directory — see the existing "1991 Academy site" note).
- No git repo exists; never expose or copy `1991_academy.db`.
- Finish each phase with an end-to-end preview verification and
  screenshots before starting the next.

Start with A (bilingual), demo it to me, then B, then C.
