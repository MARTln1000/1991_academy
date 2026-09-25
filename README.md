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

There is one program to run. `app.py` serves the API **and** the frontend
(the HTML/CSS/JS files next to it). The database is a SQLite file
(`1991_academy.db`) that it creates on first start. There is no separate
frontend server, build step or database server.

```bash
make install   # once: creates .venv with the pinned dependencies
make dev       # → http://localhost:8735   (accounts, sync, leaderboard, C++ runner)
```

`make` on its own lists every command. Without make, that's
`python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -c requirements.lock`,
then `.venv/bin/python app.py`.

Putting it on a real server with HTTPS: [Run with Docker](#run-with-docker) is
the simplest way. [Deploy](#deploy) is the alternative without Docker, with
automatic deploys from GitHub.

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
make test    # API tests against a temp DB; no real accounts touched
```

(That is `.venv/bin/pip install -r requirements-dev.txt -c requirements.lock`
once, then `.venv/bin/pytest -q`.)

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
- Optional, from the site owner: SMTP credentials for password-reset emails,
  and a database export (`academy-export.db.gz`, see step 6) if existing
  accounts should move over.

**Steps:**

1. **DNS.** Point an `A` record (plus `AAAA` for IPv6) for the domain at the
   server's IP address. It can take a few minutes to take effect.
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
5. **Start it.** Run `make up`. The first build takes a few minutes. It should
   end with `running on server: https://your-domain`. Open that address; the
   padlock should show a valid certificate.
6. **Existing accounts** (optional). Copy the export to the server with
   `scp academy-export.db.gz root@SERVER:1991_academy/`, then on the server,
   in `1991_academy`, run `make restore FILE=academy-export.db.gz`.
7. **Nightly backups.** Run `crontab -e` and add this line (adjust the path):
   ```
   30 3 * * * cd /root/1991_academy && make backup >> backups/cron.log 2>&1
   ```
8. **Firewall** (recommended):
   `ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable`.
   The app's own port 8735 is published on `127.0.0.1` only, so it isn't
   reachable from outside either way.

**Checking it works:** `make status` should show both containers `Up`, the app
`(healthy)`, and `"debug":false,"cpp":false,"secure_cookies":true,"trust_proxy":true`.
Then create an account on the site and sign in.

### Day to day

| Command | What it does |
|---------|--------------|
| `make update` | On a server: `git pull`, rebuild, restart. This is how new code goes live |
| `make logs` | Requests, sign-ins, errors, certificate renewals (Ctrl-C stops watching) |
| `make status` | Containers, health, and `revision`: the commit that is live (`-dirty` = built with uncommitted changes) |
| `make restart` | After editing `.env` |
| `make backup` | Snapshot into `backups/academy-<UTC time>.db.gz`. Integrity-checked, safe while running. On a server, copy these somewhere else now and then |
| `make restore FILE=…` | Snapshots the current database first, then puts the backup back |
| `make shell` | A shell in the app container; `sqlite3 /data/academy.db` opens the database |
| `make down` | Stops the site. The database is kept |

Never run `docker compose down -v`: `-v` deletes the volumes, and with them
the database and the HTTPS certificates.

The image is always built on the machine that runs it. Don't copy an image
built on an M1 Mac to a server: it is ARM (`linux/arm64`), most servers are
Intel/AMD (`amd64`), and it would fail there with `exec format error`.

On a server the app runs with the same production settings as the systemd
setup (`DEPLOYMENT.md` §1): no debug mode, C++ runner off, secure cookies,
trusting Caddy's `X-Forwarded-For`. It runs as a non-root user on a read-only
filesystem, where the database volume is the only writable path. CI builds the
image on every push and smoke-tests it, including a backup.

| Symptom | Cause, and fix |
|---------|----------------|
| On a server, `make up` says `running on this computer` | `DOMAIN` in `.env` is empty. Set it and run `make up` again |
| `port is already allocated` / `address already in use` | On a server (80 or 443): something else serves the web there, e.g. nginx, Apache or Caddy. Stop it, e.g. `systemctl disable --now nginx`. On a Mac (8735): `make dev` is still running |
| Certificate errors, or the site doesn't load | DNS doesn't point at the server yet, or the provider's firewall blocks ports 80/443. `make logs` shows Caddy's attempts |
| `Cannot connect to the Docker daemon` | On a Mac: start Docker Desktop. On a server: `systemctl start docker` |
| Reset emails never arrive | Set `ACADEMY_SMTP_*` in `.env`, then `make restart`. `make status` shows `"email":true` once they're in place |

## Deploy

This is the setup **without Docker**: the app runs under systemd and GitHub
Actions deploys every push to `master`. On a server, use this or
[Run with Docker](#run-with-docker), not both. The GitHub deploy job only runs
once `DEPLOY_HOST` is set, so with Docker simply leave it unset.


Production is one small Linux server. **Caddy** serves HTTPS (it gets and
renews the certificate itself) and proxies to the FastAPI app, which
**systemd** runs from `/opt/academy/current`. The database lives apart from
the code in `/var/lib/academy`. **GitHub Actions** runs the tests on every
push and deploys every push to `master` that passes them:

```
git push ──► GitHub Actions: pytest on Python 3.12 (the server's) and 3.14
                │  master only, tests green
                ▼
            deploy/deploy.sh ── rsync ──► /opt/academy/releases/20260924-101500-3fb8571/
                │                         only changed files are sent; the rest are
                │                         hard links to the live release
                └── ssh ──► deploy/activate.sh, on the server:
                              1. build the release's .venv from requirements.lock; must import
                              2. back up the database
                              3. stop the app, point `current` at the release, start the app
                              4. /api/health must report the new commit, or roll back
                              5. keep the 5 newest releases
```

A broken release never stays live. One that doesn't import is rejected before
the site is touched. One that crashes on startup or fails its health check is
replaced by the previous release within seconds, automatically. Either way the
run goes red with the traceback or the service log in it. A normal deploy
makes the site unavailable for about half a second while the app restarts.

| File | Role |
|------|------|
| `.github/workflows/deploy.yml` | The **Test & Deploy** workflow |
| `deploy/setup-server.sh` | One-time server bootstrap. Safe to re-run |
| `deploy/deploy.sh` | Ships a commit and activates it. CI runs it, and so can you |
| `deploy/activate.sh` | The server half of a deploy; also `--rollback` |
| `deploy/academy.service` | systemd unit: production settings and a sandbox |
| `deploy/academy-backup.{service,timer}`, `deploy/backup.sh` | Nightly and pre-deploy database backups |
| `deploy/Caddyfile` | HTTPS reverse proxy |
| `deploy/academy.env.example` | Template for `/etc/academy/academy.env`: your domain, SMTP secrets |
| `requirements.lock` | Exact dependency versions for CI and production |

`DEPLOYMENT.md` explains every setting and what the scripts build on the server.

### One-time setup

You need a server running **Ubuntu 24.04 LTS** (Debian 12+ works too) that you
can SSH into as root, and a domain. 1 vCPU and 1 GB of RAM is plenty
(`DEPLOYMENT.md` §7).

1. **DNS.** Point an `A` record (plus `AAAA` for IPv6) for your domain at the server.
2. **Deploy key.** GitHub Actions gets an SSH key of its own:
   ```bash
   ssh-keygen -t ed25519 -N "" -C "1991-academy deploy" -f ~/.ssh/academy_deploy
   ```
3. **Server.** From the repo root:
   ```bash
   scp -r deploy ~/.ssh/academy_deploy.pub root@SERVER:
   ssh root@SERVER bash deploy/setup-server.sh academy.example.com academy_deploy.pub
   ```
   If you log in as a sudo user rather than root, run `sudo bash deploy/setup-server.sh …`.
   It takes about a minute and ends by printing what's left, including the
   server's SSH host-key fingerprints.
4. **Email** (optional). Fill in the `ACADEMY_SMTP_*` lines of
   `/etc/academy/academy.env` on the server, then `sudo systemctl restart academy`.
   Until you do, password-reset links go to the log instead of the learner.
5. **GitHub.** In the repository, open **Settings → Secrets and variables → Actions**:

   | Tab | Name | Value |
   |-----|------|-------|
   | Variables | `DEPLOY_HOST` | The server's hostname or IP |
   | Variables | `ACADEMY_URL` | `https://academy.example.com` |
   | Secrets | `DEPLOY_SSH_KEY` | The private key, all of it: `pbcopy < ~/.ssh/academy_deploy` |
   | Secrets | `DEPLOY_KNOWN_HOSTS` | The output of `ssh-keyscan <DEPLOY_HOST>`. Compare its keys with the fingerprints from step 3 |

   Create them at **repository** level, not environment level: the workflow
   checks `DEPLOY_HOST` before an environment is loaded. Two optional
   variables: `DEPLOY_USER` (default `deploy`) and `DEPLOY_PORT` (default `22`).
   While `DEPLOY_HOST` is unset the deploy job is skipped, so pushing the
   workflow before the server exists is harmless.
6. **First deploy.** Push to `master`, or go to **Actions → Test & Deploy → Run
   workflow**. The first upload carries the ~90 MB of course assets; later
   deploys send only what changed.

**Bringing over existing accounts** (optional, do it before step 6). The local
`1991_academy.db` can become the production database:

```bash
sqlite3 1991_academy.db ".backup /tmp/academy-export.db"    # consistent copy, even while app.py runs
scp /tmp/academy-export.db root@SERVER:/tmp/
ssh root@SERVER 'install -o academy -g academy -m 600 /tmp/academy-export.db /var/lib/academy/academy.db && rm /tmp/academy-export.db'
```

### Deploying

- **Push to `master`.** That's the whole routine. The run page shows each step
  and links the site. Pushes to other branches only run the tests.
- **From your own machine**, with the same script and the same safety checks.
  Add this to `~/.ssh/config`:
  ```
  Host academy
    HostName academy.example.com
    User deploy
    IdentityFile ~/.ssh/academy_deploy
  ```
  Then:
  ```bash
  deploy/deploy.sh academy            # deploys HEAD: committed files only, never the local DB or .venv
  deploy/deploy.sh academy 3fb8571    # or any commit or tag
  ```
  Prefix `ACADEMY_URL=https://academy.example.com` to also check the public site.

### Rolling back

- **Automatic** for releases that don't start (see above).
- **Instantly, to the previous release.** It is already built, so this takes
  about a second:
  ```bash
  ssh academy bash /opt/academy/current/deploy/activate.sh --rollback
  ```
  Run it again to go back further. The next push to `master` deploys forward again.
- **To any commit:** **Actions → Test & Deploy → Run workflow** with `ref` set
  to that commit, or `deploy/deploy.sh academy <commit>`.

The database is not rolled back. That's fine: `init_db()` migrations only ever
add columns and indexes, so older code runs on a newer database.

### Running the server

```bash
systemctl status academy                    # running? since when?
journalctl -u academy -f                    # live log: API calls, sign-ins, errors
curl -s localhost:8735/api/health           # settings, plus the commit that is live
sudoedit /etc/academy/academy.env && sudo systemctl restart academy   # change a setting
ls -l /opt/academy                          # current -> the live release
```

### Backups

The database is snapshotted nightly (around 03:30 UTC) and before every deploy
into `/var/backups/academy/academy-<UTC time>.db.gz`. Each snapshot is
integrity-checked, and they are kept for 30 days. They sit on the same disk as
the database, so copy them off the server now and then, e.g.
`scp 'root@SERVER:/var/backups/academy/*.gz' .`

Take one right now with `sudo systemctl start academy-backup`. To restore one:

```bash
sudo systemctl start academy-backup    # snapshot the current state first, just in case
sudo systemctl stop academy
sudo -u academy sh -c 'rm -f /var/lib/academy/academy.db-wal /var/lib/academy/academy.db-shm &&
  gunzip -c /var/backups/academy/academy-20260924-033012.db.gz > /var/lib/academy/academy.db'
sudo systemctl start academy
```

### Updating dependencies

`requirements.txt` says what the app needs. `requirements.lock` pins the exact
versions that CI tests and production installs. After changing
`requirements.txt`, or to take newer versions, regenerate the lock and re-run
the tests:

```bash
rm -rf /tmp/lockenv && .venv/bin/python -m venv /tmp/lockenv
/tmp/lockenv/bin/pip install -r requirements.txt -c requirements.lock   # drop "-c requirements.lock" to upgrade everything
{ grep '^#' requirements.lock; /tmp/lockenv/bin/pip freeze; } > /tmp/requirements.lock && mv /tmp/requirements.lock requirements.lock
.venv/bin/pip install -r requirements-dev.txt -c requirements.lock && .venv/bin/pytest -q
```

### When something goes wrong

| Symptom | Cause, and fix |
|---------|----------------|
| The deploy job is skipped | `DEPLOY_HOST` isn't set as a *repository* variable |
| `Deploy settings missing: …` | Add the secret or variable it names (setup step 5) |
| `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` doesn't match. Re-run `ssh-keyscan` with exactly the `DEPLOY_HOST` value |
| `Permission denied (publickey)` | `DEPLOY_SSH_KEY` isn't the private half of the key given to `setup-server.sh` |
| `… has no /opt/academy/releases` | `setup-server.sh` hasn't been run on that server |
| `the release fails to import` | The traceback above it says why. The live site was not touched |
| `crashed on startup` or `did not pass the health check` | The service log follows it. The previous release is live again |
| `the database backup failed` | Nothing was deployed. On the server: `journalctl -u academy-backup` (disk full?) |
| Site unreachable, or certificate errors | DNS doesn't point at the server yet, or the provider's firewall blocks ports 80/443. See `journalctl -u caddy` |
| Reset emails never arrive | Set `ACADEMY_SMTP_*`. `/api/health` shows `"email": true` once they're in place |

## Structure

```
1991 Academy/
├── app.py                FastAPI backend: auth, sync, leaderboard, C++ runner, static
├── requirements.txt      Runtime dependencies; requirements.lock pins their exact versions
├── Makefile              Every common command: `make` lists them
├── Dockerfile            The app image (API + frontend in one)
├── docker-compose.yml    app + Caddy (HTTPS); settings from .env (template: .env.example)
├── docker-compose.local.yml  Mac/local overrides, used when DOMAIN in .env is empty
├── DEPLOYMENT.md         Production reference: every setting, the server layout, why
├── .github/workflows/
│   └── deploy.yml        CI/CD: tests + Docker image check on every push, deploys master
├── deploy/               Server bootstrap, deploy + rollback scripts, systemd/Caddy config
│                         (see Deploy above; Caddyfile.docker is the Docker one)
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
