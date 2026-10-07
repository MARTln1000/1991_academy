# 1991 Academy ⚡

Run by **1991 Unit** (1991 Ստորաբաժանում). Support: [ai.1991@mil.am](mailto:ai.1991@mil.am), also in the main page's footer, next to the [privacy policy](privacy.html).

A personal learning platform: seven structured tracks — **Mathematics for ML, Programming for ML, Web Development, Machine Learning, Deep Learning, Agentic AI, and Algorithms & Data Structures** — built like Duolingo-meets-freeCodeCamp:

- **XP everywhere** — lessons (+20), quiz answers (+5), exercises (+15), missions (+60), lab problems (+30–80), reviews (+5). One currency feeds the daily goal, levels (Spark → Sage), streak and achievements. First-try perfect quizzes pay a random bonus (variable reward).
- **Video lectures** embedded per-lesson — hand-picked free courses (3Blue1Brown, Karpathy, freeCodeCamp, Traversy) plus the full FAST "Mathematics for ML" lecture series — click-to-play YouTube no-cookie embeds, no API keys.
- **Interactive exercises** inside lessons — Parsons problems (reorder code), faded blanks, matching pairs.
- **Missions** — real coding challenges in **Python** that need ideas from *two tracks at once*, unlocked by completing their prerequisite lessons.
- **The Lab** — implement-it-yourself practice in **Python**: LeetCode-style DSA problems, classical ML models (k-NN, linear regression, k-means) and neural networks (perceptron, XOR MLP with backprop) written from scratch — then **plotted from your own code**: your sort step by step, your BFS path through a maze, your k-NN's decision regions, your network solving XOR.
  - **Every coding exercise is solved in Google Colab** (lesson exercises, Lab problems, missions): the learner downloads the exercise's notebook from the site (the task, the starter code, a test cell and the hints) and uploads it to Colab with *File → Upload notebook*, which keeps it in their own Google Drive. When the tests pass, **I solved it ✓** on the site awards the XP (honor system). Nothing runs learners' code on the server or in the site's pages, and nothing depends on GitHub.
- **Practice** — spaced repetition: quiz questions from completed lessons become review cards, due just before you'd forget them.
- **Achievements, streak, daily goal ring** — loss-aversion mechanics that make skipping a day feel expensive.

It is **a closed school**: only the students 1991 Unit invites can sign in. Admins invite them in the admin panel, and each student gets a link to choose a password. Without signing in, only the sign-in page and the privacy policy open; lessons, course files and videos all need an account. Progress syncs to the account (SQLite), so a student can continue on any device.

No build step; the frontend is pure dependency-free HTML/CSS/JS. The backend is a single FastAPI app (`app.py`) — the one place dependencies live (`requirements.txt` + `.venv`).

## Bilingual: English / Հայերեն

The nav has a language toggle (persisted as `1991_academy:lang`, synced with the
account). `js/i18n.js` translates the UI: **English strings are the dictionary
keys**, so `t("Mark as complete")` returns Armenian in hy mode and the key
itself otherwise — anything untranslated gracefully falls back to English.
**Never name a local variable `t`** — it shadows the global translate function
and silently breaks Armenian in that scope.
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
bilingual homework notebooks. `Noto Sans Armenian` is in the font stack. The
Colab notebooks come in both languages too (`assets/colab/en|hy/`), built from
the same `_hy` fields. To translate more, add `_hy` fields — no code changes
needed (then `make notebooks`).

## Run it

There is one program to run. `app.py` serves the API **and** the frontend
(the HTML/CSS/JS files next to it). The database is a SQLite file
(`1991_academy.db`) that it creates on first start. There is no separate
frontend server, build step or database server.

```bash
make install   # once: creates .venv with the pinned dependencies
make dev       # → http://localhost:8735   (accounts, sync, leaderboard)
```

`make` on its own lists every command. Without make, that's
`python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -c requirements.lock`,
then `.venv/bin/python app.py`.

Running it as a server, on your Mac or on the internet with HTTPS: see
[Run with Docker](#run-with-docker).

`app.py` is an ordinary ASGI app, so `.venv/bin/uvicorn app:app --port 8735`
works too — the schema and the expiry sweep are set up by its lifespan handler,
not by `__main__`.

> The old stdlib `server.py` was removed. It had drifted to implementing only
> six of the fifteen endpoints (change-password, password reset, account
> deletion, the leaderboard and `/api/health` all 404'd under it) and carried
> none of the rate limiting, body caps, security headers or path allowlist.

Or just open `index.html` / serve statically with `python3 -m http.server` — the site fully works, accounts are simply disabled (the account page explains how to enable them).

### Account management

There is no sign-up: admins invite students (see "Admin panel"). Signed in,
the account page offers **change password**, **forgot/reset password**
(emailed link) and **delete account** (GDPR-clean cascade).

**Email** (invitations and password resets) is sent through the mail server
in `.env`. The recommended setup has **no password anywhere**: the mail
administrator allows the site's server (its IP address) to send as
`ai.1991@mil.am` (an "SMTP relay"), and `.env` names only the server and the
sender: `ACADEMY_SMTP_HOST=mail.mil.am`, `ACADEMY_SMTP_PORT=25`,
`ACADEMY_SMTP_FROM="1991 Academy <ai.1991@mil.am>"`. Only if the mail server
insists on a login, add `ACADEMY_SMTP_USER` / `_PASS` for a mailbox made just
for the site (port 587), never the support inbox's own password. Either
way the connection is encrypted and the mail server's certificate is
checked, so nothing can be intercepted. After `make restart`, `make email-test TO=you@example.com` sends
one test email and says exactly what failed, if anything (and warns if links
would point to `localhost`: set `DOMAIN`). Invitations are sent while you
wait, and the panel lists who got an email and who didn't, and why; a
failed one is sent again with "Resend the invitation". The emails are in
English and Armenian, plain text plus HTML. Without these settings nothing is
emailed: the admin panel shows invitation and reset links to hand out, and a
"forgot password" request sends nothing (the panel's "Send a password-reset
link" gives the link instead). Links never go to the production log. The
leaderboard has **This week / All time** tabs — the weekly league resets every
ISO week (server rebases each user's weekly baseline on their first sync of a
new week).

### Tests

```bash
make test    # API tests against a temp DB; no real accounts touched
```

(That is `.venv/bin/pip install -r requirements-dev.txt -c requirements.lock`
once, then `.venv/bin/pytest -q`.)

### Updating dependencies

`requirements.txt` says what the app needs. `requirements.lock` pins the exact
versions that CI tests and the Docker image installs. After changing
`requirements.txt`, or to take newer versions, regenerate the lock and re-run
the tests:

```bash
rm -rf /tmp/lockenv && .venv/bin/python -m venv /tmp/lockenv
/tmp/lockenv/bin/pip install -r requirements.txt -c requirements.lock   # drop "-c requirements.lock" to upgrade everything
{ grep '^#' requirements.lock; /tmp/lockenv/bin/pip freeze; } > /tmp/requirements.lock && mv /tmp/requirements.lock requirements.lock
.venv/bin/pip install -r requirements-dev.txt -c requirements.lock && .venv/bin/pytest -q
```

## Run with Docker

Two containers, defined in `docker-compose.yml`:

- **app**: the image built from the `Dockerfile`. It holds `app.py` and the
  whole frontend. The database is `/data/academy.db` in the `academy_data`
  volume, so it survives restarts, rebuilds and updates.
- **caddy** (servers only): serves `https://your-domain`, gets and renews the
  certificate itself, and forwards to the app.

One setting in `.env` decides where it runs, and every `make` command works
the same way in both places:

| `DOMAIN` in `.env` | `make up` runs | Open |
|--------------------|----------------|------|
| empty (the default) | the app alone, on this computer | http://localhost:8735 |
| `academy.example.com` | the app + Caddy, on a server | https://academy.example.com |

### On your Mac: a test server

Needs Docker Desktop running. Works on Apple Silicon (M1 and later) and Intel.

```bash
make up        # first time: creates .env, builds the image (a few minutes), starts the site
```

Open http://localhost:8735. The site keeps running in the background, even
after you close the terminal, until `make down`. When Docker Desktop starts,
it starts the site again.

- **After changing code**, run `make up` again. It rebuilds and restarts.
- **Its database is separate** from the `1991_academy.db` that `make dev`
  uses, and starts empty. To test with your existing accounts, first run
  `sqlite3 1991_academy.db ".backup academy-export.db" && gzip academy-export.db`,
  then `make restore FILE=academy-export.db.gz`.
- `make up` and `make dev` both use port 8735. Stop one (`make down`, or
  Ctrl-C) before starting the other.
- Everything in the table under "Day to day" below works here too.

### Publishing on a server

This part is for whoever puts the site on the internet.

**Before you start, you need:**

- A server running **Ubuntu 24.04** (any Linux that runs Docker works) that
  you can SSH into as root. 1 vCPU and 1 GB of RAM is plenty.
- A domain, and access to its DNS settings.
- Disk: 20 GB for the site; add 80–100 GB if the lesson videos are hosted
  here (see "Lesson videos").
- Optional, from the site owner: SMTP credentials for password-reset emails,
  and a database export (`academy-export.db.gz`, see step 6) if existing
  accounts should move over.

**Steps:**

1. **DNS.** Point an `A` record for the domain at the server's IP address. It
   can take a few minutes to take effect.
   - Add an `AAAA` record only if the server really has a working IPv6
     address. A wrong one makes the certificate request fail.
   - If the DNS is on Cloudflare, set the record to **DNS only** (grey cloud),
     not Proxied. Through Cloudflare's proxy every visitor would appear to
     come from Cloudflare's addresses, which breaks the per-visitor sign-in
     rate limits.
2. **Docker, git and make**, as root on the server:
   ```bash
   curl -fsSL https://get.docker.com | sh
   apt-get install -y git make
   ```
3. **The code.**
   ```bash
   git clone https://github.com/MARTln1000/1991_academy.git && cd 1991_academy
   ```
4. **Settings.** Run `cp .env.example .env`, then in `.env` set
   `DOMAIN=your-domain` (no `https://`). Fill in the `ACADEMY_SMTP_*` lines
   if you have them.

   If the server already runs a web server for other sites (nginx, Apache;
   check with `ss -tlnp | grep -E ':(80|443) '`), also set `PROXY=external`,
   and configure that web server to forward the domain to `127.0.0.1:8735`
   (`DEPLOYMENT.md` §3 has the nginx config). Otherwise leave `PROXY=caddy`.
5. **Start it.** Run `make up`. The first build takes a few minutes. It should
   end with `running on server: https://your-domain`. Open that address; the
   padlock should show a valid certificate. Then make your own admin account
   (there is no sign-up): `make admin NAME=<your username> EMAIL=<your email>`.
   It prints a link: open it, choose your password, and you're signed in.
   Invite everyone else from the admin panel.
6. **Existing accounts** (optional). Copy the export to the server with
   `scp academy-export.db.gz root@SERVER:1991_academy/`, then on the server,
   in `1991_academy`, run `make restore FILE=academy-export.db.gz`.
7. **Nightly backups.** Run `make nightly-backup`. It adds a cron job that runs
   `make backup` every night at 03:30, logging to `backups/cron.log`.
   `crontab -l` shows it.
8. **Firewall** (recommended):
   `ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable`.
   The app's own port 8735 is published on `127.0.0.1` only, so it isn't
   reachable from outside either way.
9. **Automatic updates** (recommended). Run `make auto-update-on`. From then
   on the server checks GitHub every 5 minutes and installs whatever is
   pushed to `master` by itself, so the site's developers can keep changing
   the site without logging in to this server. Each update makes a database
   backup first; if the new version fails to build or start, the server goes
   back to the version that was running and logs why in
   `backups/auto-update.log`. Every Sunday at 04:00 it also installs security
   updates for Caddy and Python (`make refresh`). `make auto-update-off` stops
   both; `make update` still updates by hand.
10. **Two things to set up outside the server** (recommended):
    - *Off-site backups.* Backups stay on this server (`backups/`, 30 days).
      Copy them somewhere else now and then, or have a job pull them, e.g.
      `rsync -a root@SERVER:1991_academy/backups/ ./academy-backups/`. If the
      server is lost, those copies are all that's left.
    - *Uptime alerts.* A free monitor (UptimeRobot, Better Stack...) that
      opens `https://your-domain/` every few minutes and emails you when it
      fails. (`/api/health` answers only on the server itself.)

**Checking it works:** `make status` should show the app `Up (healthy)` (and
`caddy` `Up`, unless `PROXY=external`), and `"debug":false,"secure_cookies":true,"trust_proxy":true`.
Then sign in with the admin account from step 5.

### Changing the site after it's deployed

Servers run the `master` branch. With automatic updates on (step 9 above),
anything that reaches `master` on GitHub is live within about 5 minutes, and
nobody needs to log in to the server.

| Branch | What it is |
|--------|------------|
| your own (e.g. `martin`) | Where you work and commit |
| `dev` | Everything released so far; the same as `master` after each release |
| `master` | What the servers run |

To publish your work:

```bash
git add -A && git commit -m "What changed"   # on your branch
make release
```

`make release` runs the tests, then pushes your branch to GitHub and moves
`dev` and `master` to it, all three at once. It changes nothing (and says
why) if something isn't committed, if `dev` or `master` has commits your
branch doesn't (then `git merge origin/master` first), or if a test fails.

Lessons and announcements don't need any of this: the admin panel changes
them on the live site directly.

### Day to day

| Command | What it does |
|---------|--------------|
| `make update` | On a server: `git pull`, rebuild, restart. Not needed with automatic updates on |
| `make auto-update-on` / `-off` | On a server: install every new commit on `master` by itself, within 5 minutes (backup first, rollback if it fails), and security updates weekly. Log: `backups/auto-update.log` |
| `make refresh` | Security updates now: the newest Caddy and Python base images, rebuilt and restarted |
| `make video SRC=… ID=…` / `make media-upload TO=…` | Prepare a lecture video / copy `media/` to a server (see "Lesson videos") |
| `git checkout <commit> && make up` | Roll back to an earlier version (`git log --oneline` lists them). `git checkout master && make update` returns to the latest |
| `make logs` | Requests, sign-ins, errors, certificate renewals (Ctrl-C stops watching) |
| `make status` | Containers, health, `revision` (the commit that is live; `-dirty` = built with uncommitted changes), and whether automatic updates are on |
| `make restart` | After editing `.env` |
| `make backup` | Snapshot into `backups/academy-<UTC time>.db.gz`. Integrity-checked, safe while running. On a server, copy these somewhere else now and then |
| `make restore FILE=…` | Snapshots the current database first, then puts the backup back |
| `make shell` | A shell in the app container; `sqlite3 /data/academy.db` opens the database |
| `make admin NAME=…` | Make an account an admin (`make admin-remove NAME=…` undoes it, `make admins` lists them) |
| `make down` | Stops the site. The database is kept |

Never run `docker compose down -v`: `-v` deletes the volumes, and with them
the database and the HTTPS certificates.

The image is always built on the machine that runs it. Don't copy an image
built on an M1 Mac to a server: it is ARM (`linux/arm64`), most servers are
Intel/AMD (`amd64`), and it would fail there with `exec format error`.

On a server the app runs with production settings (`DEPLOYMENT.md` explains
each one): no debug mode, secure cookies, trusting Caddy's
`X-Forwarded-For`. It runs as a non-root user on a read-only
filesystem, where the database volume is the only writable path. Learners'
code never runs on the server: they solve the exercises in Google Colab. CI
builds the image on every push and smoke-tests it, including a backup.

| Symptom | Cause, and fix |
|---------|----------------|
| On a server, `make up` says `running on this computer` | `DOMAIN` in `.env` is empty. Set it and run `make up` again |
| `port is already allocated` / `address already in use` | On a server (80 or 443): another web server (nginx, Apache) already uses them. If it serves other sites, keep it and set `PROXY=external` (step 4). If not, stop it: `systemctl disable --now nginx`. On a Mac (8735): `make dev` is still running |
| Certificate errors, or the site doesn't load | DNS doesn't point at the server yet, or the provider's firewall blocks ports 80/443. `make logs` shows Caddy's attempts |
| `Cannot connect to the Docker daemon` | On a Mac: start Docker Desktop. On a server: `systemctl start docker` |
| Reset emails never arrive | Set `ACADEMY_SMTP_*` in `.env`, then `make restart`. `make status` shows `"email":true` once they're in place |

## Structure

```
1991 Academy/
├── app.py                FastAPI backend: auth, sync, leaderboard, admin API, static
├── requirements.txt      Runtime dependencies; requirements.lock pins their exact versions
├── Makefile              Every common command: `make` lists them
├── Dockerfile            The app image (API + frontend in one)
├── docker-compose.yml    app + Caddy (HTTPS); settings from .env (template: .env.example)
├── docker-compose.local.yml  Mac/local overrides, used when DOMAIN in .env is empty
├── DEPLOYMENT.md         Production reference: every setting, the server layout, why
├── .github/workflows/
│   └── ci.yml            CI: API tests + Docker image smoke test on every push
├── deploy/               Caddyfile (HTTPS proxy), backup.sh (make backup), auto-update.sh (make auto-update-on)
├── assets/colab/         The Colab notebooks, en/ and hy/ (generated: `make notebooks`)
├── tools/                build_notebooks.py (`make notebooks`) + site_data.js: the Colab notebooks; release.sh (`make release`);
│                         encode-video.sh (`make video`)
├── media/                Lesson videos hosted here, <YouTube id>.mp4 + .jpg (not in git; see "Lesson videos")
├── tests/                API tests; test_notebooks.py runs every Colab notebook, with the
│                         reference solutions in content/solutions/ and with its starter code
├── index.html            Dashboard: goal ring, level, tracks, missions, badges
├── missions.html         Cross-track coding challenges (solved in Colab)
├── lab.html              The Lab: implement-it-yourself problems (solved in Colab)
├── practice.html         Spaced-repetition review sessions
├── account.html          Sign in / create account / profile
├── admin.html            The admin panel (admin accounts only; see "Admin panel")
├── privacy.html          Privacy policy, English + Armenian (keep it true to what the site does)
├── tracks/               One shell page per track (identical except track id)
│   ├── math.html  web.html  ml.html  dl.html  agents.html  dsa.html
├── css/
│   ├── tokens.css        Design tokens: colors, fonts, radii (dark/light themes)
│   ├── base.css          Reset + typography + layout primitives
│   ├── components.css    Navbar, cards, lesson reader, quiz, toast…
│   ├── game.css          XP pill, goal ring, exercises, missions, practice
│   └── admin.css         The admin panel
└── js/
    ├── common.js         Namespace, theme toggle, queued toasts, helpers
    ├── auth.js           Session check, sign-in calls, progress sync
    ├── account-page.js   Account page: forms + profile
    ├── admin-page.js     The admin panel: overview, learners, lesson editor, announcements, log
    ├── i18n-admin.js     The admin panel's Armenian strings
    ├── custom-content.js Applies api/content.js: lessons and announcements from the admin panel
    ├── progress.js       localStorage: lesson completion, streak
    ├── xp.js             XP ledger, levels, daily goal, achievements
    ├── review.js         Spaced-repetition card store & scheduling
    ├── exercises.js      Parsons/blanks/match/problem/code renderers
    ├── colab.js          Every coding exercise's steps: download the notebook, upload it to Colab, "I solved it"
    ├── main.js           Landing page rendering
    ├── track.js          Track page: sidebar, lesson reader, quiz engine, routing
    ├── missions-page.js  Mission cards, lock logic, Colab links, hints
    ├── lab-page.js       Lab problem browser, Colab links, hints
    ├── practice-page.js  Review session flow
    └── data/             All content lives here
        ├── math.js  web.js  ml.js  dl.js  agents.js  dsa.js   (tracks)
        ├── ml-course.js  dl-course.js                         (FAST course rebuilds of the ml/dl tracks)
        ├── math-exercises.js  math-exercises-2.js             (math homework problems + course materials)
        ├── missions.js                                        (cross-track missions, with their Python code)
        ├── lab.js                                             (Lab problems, their Python code + plot configs)
        ├── i18n-hy.js                                         (Armenian: UI chrome + all titles + Lab cards)
        └── i18n-hy-{web,dsa,agents,math,ml,dl,prog,missions,lab}.js  (Armenian per-track/section content packs)
```

## How it works

- **Content is data.** Each `js/data/*.js` file registers a track object (modules → lessons → exercises → quiz questions) on `window.ACADEMY_1991`. Pages are thin shells that render from it.
- **State is local-first.** Progress (`1991_academy:progress:v1`), XP/badges (`1991_academy:xp:v1`), review cards (`1991_academy:review:v1`), and the language choice (`1991_academy:lang`) live in localStorage (so do code drafts, `1991_academy:draft:*`, from before exercises moved to Colab). Signed in, the same keys are pushed to `/api/state` ~1.5 s after every change (coalesced into one request, and flushed on `pagehide`) and pulled back on any device you sign in on. Conflict rule: the copy with more XP wins; signing in as a *different* user on a shared device always adopts that account's server copy. The theme and per-problem editor language stay device-local on purpose. (The prefix was `martinium:` before the project was renamed. `js/common.js` moves a returning visitor's old keys over once on page load, and the server renames old keys in stored and incoming blobs.)
- **State changes are announced, not reloaded.** `Progress`/`XP`/`Review` cache their parsed blob, so a render pass parses it once instead of forty times. Anything that rewrites those keys from outside — a sync pull, or another tab — calls `notifyStateChanged()` (`js/common.js`), which drops the caches and fires `1991_academy:state-changed`; page controllers subscribe with `onStateChanged(render)` and redraw in place. Open editors and in-progress practice sessions are deliberately left alone. Only a language change still forces a reload, because the language is baked into every rendered string.
- **If a sync fails, you are told once.** Oversized payloads shed the largest code drafts first so progress always gets through; a 401 signs you out cleanly; repeated failures toast once, not every 1.5 seconds.
- **Auth is boring on purpose.** Passwords are scrypt-hashed with per-user salts; sessions are random tokens in an HttpOnly cookie (30 days); users, sessions and state blobs live in `1991_academy.db` (SQLite). Accounts exist only by invitation, and every page except sign-in needs a session. The FastAPI backend adds rate limiting (login/reset), request-size caps, structured logging, `/api/health` and env-based config — see `DEPLOYMENT.md` before exposing it to the open internet (HTTPS required). Change-password and password-reset rotate the hash and invalidate sessions; reset tokens are SHA-256-hashed, single-use and expire in 1 hour; `forgot-password` always returns the same response (no email enumeration). Expired sessions and reset tokens are swept at startup and hourly.
- **Nothing blocking runs on the event loop.** SQLite and scrypt go through `run_in_threadpool`, so a slow login hash never stalls other requests or static files.
- **The web root is an allowlist, not a blocklist.** Only `/`, the seven page files, `robots.txt` and the `css/ js/ tracks/ assets/` trees are reachable. The previous extension blocklist could be walked around by case (`/APP.PY` resolves to `app.py` on macOS and Windows volumes, which served the backend source and the credentials database) and simultaneously 404'd the legitimate `.py` starter files under `assets/courses/`.
- **The database is indexed.** `init_db()` creates `CREATE INDEX IF NOT EXISTS` entries on every start (idempotent, data-safe, and applied to existing DBs too): case-insensitive `username`/`email` for login-by-either, a composite `(leaderboard_opt_in, xp_total DESC)` so the leaderboard is an indexed search rather than a full scan, and `sessions(user_id)` for per-user session cleanup. Session-token, `state.user_id` and the UNIQUE columns are already covered by their PRIMARY KEY / UNIQUE constraints.
- **Images are lean by design.** The logo and every favicon are inline SVG; the only raster images the UI renders are YouTube thumbnails, served `loading="lazy" decoding="async"` with intrinsic dimensions inside an `aspect-ratio` box (no layout shift), and the players are click-to-play `youtube-nocookie` iframes injected only on click. The 200-odd raster files under `assets/courses/**` are FAST homework **datasets** (downloaded, not displayed) and are deliberately left byte-for-byte intact. Any future in-UI image should be WebP/AVIF, lazy-loaded, with width/height set.
- **XP is ledgered.** Every award has a key (`lesson:web-1-1`, `ex:dsa-2-1:0`, `mission:mission-maze`) paid out once — nothing can be farmed by re-doing.
- **Learners' code runs in Google Colab, never here.** Every coding exercise is Python. `tools/build_notebooks.py` turns each one in `js/data/` into a notebook (`assets/colab/en|hy/<id>.ipynb`): the task, a starter cell, a form cell that runs the tests and prints ✓/✗ per test, the hints, and for the Lab problems a matplotlib plot of the learner's own code. The site serves them like any other file; `js/colab.js` shows each exercise's three steps (download the notebook, open Colab and upload it, then *I solved it*). So **a changed exercise reaches learners with `make notebooks` and the next deploy**. `make test` fails if the notebooks are out of date, and runs each one with a reference solution (must pass) and with its starter code (must not).
- **Lab problems and missions** keep their Python code next to their text: `fnName`, `starter` and `tests` (a script calling `__check(name, actual, expected)`) in `lab.js` / `missions.js`.
- **Dev server sends `Cache-Control: no-store`** so edits to JS/CSS show up on reload instead of a stale cached bundle.
- **Routing is the URL hash.** `tracks/dl.html#dl-2-2` deep-links to a lesson, `missions.html#mission-maze` to a mission.
- **Theming is one attribute.** `data-theme="dark|light"` on `<html>` swaps CSS custom properties; each track sets its accent via `data-track` on `<body>`.

## Add a mission

Append an object to `js/data/missions.js`: `id`, `title`, `icon`, `tracks`, `prereqs` (lesson ids that unlock it), `xp`, `blurb`, `brief` (HTML), its Python `fnName`, `starter` code and `tests` (a script calling `__check(name, actual, expected)`), and `hints`; add a reference solution to `tests/content/solutions/<id>.py`. Then `make notebooks` writes its Colab notebook, and `make test` checks that the solution passes and the starter doesn't. Lock logic, the Colab steps and scoring are automatic.

## Lesson videos

The lessons' videos are FAST Foundation's lectures on YouTube. A copy of a
lecture can be kept on the site's own server instead: the lesson then plays
that copy, and keeps working if the video is ever removed from YouTube.
Lectures without a copy still play from YouTube, so this can be done one
lecture at a time.

1. **Prepare** the lecture file (needs ffmpeg: `brew install ffmpeg`):
   ```bash
   make video SRC="Lecture 05 - CNNs.mp4" ID=ehvWj3Ir7yA
   ```
   `ID` is the lecture's YouTube id, the 11 characters after `watch?v=`
   (the admin panel lists them: Lessons → Lesson videos). This writes
   `media/<ID>.mp4` (at most 720p, about 400–700 MB per hour) and a poster,
   `media/<ID>.jpg`.
2. **Upload** to the server: `make media-upload TO=root@SERVER`. It sends only
   new files and resumes after a dropped connection. Nothing needs a
   restart: pages use a new file at once.
3. **Check** in the admin panel: Lessons → Lesson videos shows which lectures
   are hosted and which still come from YouTube.

Short on disk space? Keep them on a USB drive: put
`MEDIA_DIR=/Volumes/<drive name>/1991-media` in `.env`, and `make video`
writes there and `make media-upload` sends from there (the originals can stay
on the drive too). On the server the videos are in `media/` next to the code,
or wherever `MEDIA_DIR` in `.env` points (e.g. a bigger disk). They are never in git, in
the Docker image or in `make backup` (the database only): keep the original
files somewhere else as well. Caddy serves them straight from disk.

**Size it:** about 100 hours of lectures take about 50 GB, so give the server
80–100 GB of disk, and enough traffic for about 0.5 GB per hour watched.

**Only FAST Foundation's own lectures, with their permission.** Ask FAST for
the original files (better quality than a download from YouTube, which
YouTube's terms don't allow). Videos by other channels stay YouTube links.

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
{ type: "code", title, prompt, source, fnName, starter, tests }              // Python, in Colab
```

The `code` type is solved in Google Colab: the lesson shows a download button
for its notebook, `<lesson id>-ex<n>.ipynb`, how to upload it to Colab, and
"I solved it ✓"
(used by the Programming for ML track — its exercises are the FAST course's
real homework, often with the course's original asserts). Run `make
notebooks` after adding or changing one; the page must include `colab.js`
(see `tracks/prog.html`).

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

## Admin panel

`/admin.html` (an **Admin** link appears in the navigation bar for admins):

- **Overview:** learners, sign-ups and lessons completed over the last 30
  days, progress per track, the most and least completed lessons, Lab
  problems and missions solved.
- **Learners:** **invite students** (one email per line, optionally with a
  username; each gets a link, valid 7 days, to choose a password: by email
  when SMTP is set up, otherwise the panel lists the links for you to hand
  out). Search and sort every account, open one to see its progress lesson
  by lesson, resend an invitation or send a password-reset link, sign it
  out on every device, or delete it.
- **Lessons:** edit any lesson, or add new ones to a module, in English and
  Armenian: text, takeaways, quiz, videos. Saved lessons go live at once
  (no rebuild) when "Visible to learners" is ticked, otherwise they stay
  drafts. Editing a built-in lesson replaces its text; "Undo my changes"
  brings the original back.
- **Announcements:** a banner at the top of every page (English + Armenian).
- **Activity log:** every change made by an admin.

Admin rights are given on the server only, never from the web:

```bash
make admin NAME=martin EMAIL=martin@example.com   # EMAIL creates the account if there isn't one (prints its link)
make admins                   # who is an admin
make admin-remove NAME=martin
```

(Without Docker: `.venv/bin/python app.py admin add martin [EMAIL]`.)

Lessons and announcements written in the panel live in the database (tables
`lessons` and `announcements`), so `make backup` covers them. Lesson HTML is
sanitized when saved: scripts, styles, event handlers, images and frames are
removed.

## Add a lesson

The quickest way is the admin panel (above). To ship a lesson with the code
instead, open the track's file in `js/data/` and add an object to a module's
`lessons` array:

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
