# Deploying 1991 Academy: reference

**README.md → Run with Docker** is the walkthrough: running it on your own
computer, publishing it on a server, and the day-to-day commands. This file is
the reference behind it: every setting, what runs where, and why.

The backend is a single FastAPI app (`app.py`) serving both the API and the
static site. The database is one SQLite file. Without Docker, for
development: `make dev` (or `.venv/bin/python app.py`).

## 1. Settings

| Variable | `python app.py` default | Docker on a server | Meaning |
|----------|-------------------------|--------------------|---------|
| `PORT` | `8735` | `8735` | Listen port |
| `ACADEMY_HOST` | `0.0.0.0` | `0.0.0.0` inside the container, published on the host's `127.0.0.1` only | Bind address. Nothing but the proxy may reach the app; see §3 |
| `ACADEMY_DB` | `./1991_academy.db` | `/data/academy.db`, in the `academy_data` volume | SQLite path |
| `ACADEMY_DEBUG` | `1` | `0` | `0` enables asset caching and hides the API docs |
| `ACADEMY_SECURE_COOKIES` | on unless `ACADEMY_DEBUG=1` | on | Marks the session cookie `Secure` (HTTPS only) and sends HSTS |
| `ACADEMY_TRUST_PROXY` | `0` | `1` | **`1` when, and only when, a trusted reverse proxy sets `X-Forwarded-For`.** See §3 |
| `ACADEMY_BASE_URL` | `http://localhost:8735` | `https://$DOMAIN` | Public origin used to build password-reset links |

Where each one is set:

- **`Dockerfile`**: `ACADEMY_HOST`, `PORT`, `ACADEMY_DB`, `ACADEMY_DEBUG`.
- **`docker-compose.yml`**: `ACADEMY_TRUST_PROXY`, `ACADEMY_BASE_URL`.
- **`docker-compose.local.yml`**: used instead when `DOMAIN` is empty (your own
  computer, plain http). It turns `ACADEMY_SECURE_COOKIES` and
  `ACADEMY_TRUST_PROXY` off, and sets `ACADEMY_BASE_URL=http://localhost:8735`.
- **`.env`** (from `.env.example`, never committed): `DOMAIN`, `PROXY` and the
  SMTP settings. Values set by the compose files take precedence over `.env`,
  so a stray line there can't switch a production setting off.

Password reset needs SMTP. With these unset, the reset link is written to the
log (`make logs`) instead of emailed:

| Variable | Meaning |
|----------|---------|
| `ACADEMY_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_FROM` | Outbound mail relay (STARTTLS). `_PORT` defaults to 587 |

## 2. What runs where

```
container academy-app-1    image 1991-academy, built from this folder   127.0.0.1:8735
container academy-caddy-1  caddy:2-alpine                               :80, :443 (tcp + udp)

volume academy_data           /data in the app: academy.db (+ -wal, -shm) and backups/
volume academy_caddy-data     the HTTPS certificates and Caddy's ACME account
volume academy_caddy-config   Caddy's saved config

this folder (the git clone)
├── .env                      DOMAIN, PROXY, SMTP. Gitignored
└── backups/                  copies made by `make backup`. Gitignored
```

The Compose project is always named `academy`, whatever the folder is called,
so the volumes keep their names if the folder is renamed or cloned again.

**The image** is `python:3.12-slim`, plus the `sqlite3` CLI (for backups), the
dependencies pinned by `requirements.lock`, and the site's files.
`.dockerignore` keeps out the local database, `.env`, `.venv`, tests and docs.
A `REVISION` file records the commit it was built from (with `-dirty` if there
were uncommitted changes), and `/api/health` reports it. The app runs as the
unprivileged user `academy` (uid and gid 10001).

**The app container** has a read-only filesystem. Its only writable places
are the `academy_data` volume and a `/tmp` in memory. It holds no Linux
capabilities and can't gain privileges. A compromised app therefore can't
modify its own code. Logs are capped at 5 × 10 MB per container.
`restart: unless-stopped` means Docker starts the containers again after a
reboot.

**Coding exercises run in Google Colab, not here.** Every coding exercise
has a notebook in `assets/colab/` (task, starter code, tests, hints; built by
`make notebooks` from the exercises in `js/data/`). The site serves them like
its other files: the learner downloads one, uploads it to Colab in their own
browser (*File → Upload notebook*), and Colab keeps it in their own Google
Drive. Nothing depends on GitHub or on any account of yours. So:

- A changed exercise reaches learners once its notebooks are rebuilt
  (`make notebooks`, then commit) and the site is updated (`make update`).
  CI fails if the notebooks are out of date. Browsers recheck
  `/assets/colab/` on every download, so nobody gets an old copy.
- Learners need a Google account for Colab. The same notebooks also open in
  Jupyter, for anyone who prefers it.

**Updating** (`make update`) runs `git pull`, rebuilds the image and recreates
the app container. The site is unavailable for a few seconds while the app
restarts. Afterwards the old, now unused images are deleted. The database is
untouched: `init_db()` migrations only ever add columns and indexes, so older
code also runs on a newer database.

**Rolling back** to an earlier version: `git log --oneline` to find it,
`git checkout <commit>`, then `make up`. To return to the latest version:
`git checkout master && make update`.

## 3. HTTPS and the reverse proxy

Cookies carry sessions, so HTTPS is mandatory on the open internet.

> **`ACADEMY_TRUST_PROXY=1` is required behind a proxy.** Without it the app
> sees every request as coming from the proxy's own address, so all per-IP
> rate limits collapse into a single shared bucket for the entire internet:
> one attacker would lock everyone out of logging in.
>
> It is safe only while the proxy is the sole way in, because a client can
> forge `X-Forwarded-For`. That's why the app's port is published on
> `127.0.0.1` and never on a public address. Note that Docker's published ports
> bypass ufw, so the firewall alone would not protect a public one.

**Caddy** (the default, `PROXY=caddy` or unset) runs in the `caddy`
container, configured by `deploy/Caddyfile`. It obtains and renews the
certificate for `$DOMAIN` automatically, as soon as the domain's DNS points
at the server and ports 80 and 443 are reachable. It redirects HTTP to HTTPS
and sets `X-Forwarded-For` to the real client address, dropping whatever value
the client sent.

**An existing web server** (`PROXY=external` in `.env`): if the server already
runs nginx or Apache on ports 80/443 for other sites, the `caddy` container
can't start there. With `PROXY=external`, `make up` starts only the app, and
the existing web server handles HTTPS and forwards to it. It must run on the
same machine, because the app listens on `127.0.0.1:8735` only. For nginx,
with certbot for the certificate:

```nginx
server {
    server_name academy.example.com;
    listen 443 ssl http2;
    # ssl_certificate ... (certbot --nginx fills these in)
    client_max_body_size 1m;
    server_tokens off;            # no nginx version in headers and error pages
    # (the app serves the lesson videos at /media too; to let nginx serve them
    # itself: location /media/ { alias /path/to/MEDIA_DIR/; })
    # the deployed commit and config flags: `make status` asks the app directly
    location = /api/health { return 404; }
    location / {
        proxy_pass http://127.0.0.1:8735;
        # overwrite, don't append: a forged header from the client must not survive
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Host $host;
    }
}
```

Put the site behind Cloudflare's proxy only if you also teach the proxy in
front of the app to trust Cloudflare's addresses. Otherwise every visitor
appears to come from Cloudflare. The README therefore says to use "DNS only".

## 4. Backups

Everything that matters is one SQLite file. `make backup` runs
`deploy/backup.sh` inside the app container, which:

- takes a consistent online snapshot with sqlite's `.backup`, since a plain
  `cp` of a WAL-mode database can capture a torn state;
- checks it with `PRAGMA integrity_check`;
- writes it as `/data/backups/academy-<UTC time>.db.gz`, inside the volume;
- deletes snapshots there older than 30 days (`ACADEMY_BACKUP_KEEP_DAYS`).

`make backup` then copies them to `backups/` in this folder. Nightly backups
are a cron job that `make nightly-backup` installs (README.md → Publishing on
a server, step 7). Both copies are
on the same server as the database, so copy `backups/` somewhere else now and
then.

`make restore FILE=…` stops the app, snapshots the current database first (if
that fails, nothing is restored and the app is started again), replaces the
database with the backup, and starts the app.

Course assets and code are static and can always be rebuilt from git.

The privacy policy (`privacy.html`) tells users that backups are deleted after
30 days and that logs have a fixed maximum size. If you change either (for
example `ACADEMY_BACKUP_KEEP_DAYS`, or the log limits in docker-compose.yml),
or anything else about what the site stores, update the policy in both
languages and its date.

## 5. Built-in protections

In `app.py`:

- **A closed school:** no sign-up; admins invite students (week-long links
  to choose a password, stored hashed). Without a session only the sign-in
  page, its scripts and styles, and the privacy policy are served: pages
  redirect to sign-in, lessons (`js/data/`), course files, videos and the
  leaderboard answer 401, and Caddy checks the session (`/api/auth-check`)
  before serving a video. Course files and videos are cached privately.
- Limits that count **failures only**, so a classroom behind one address
  is never locked out: 10 wrong passwords a minute per address; 20 wrong
  passwords in 15 minutes per account (from any address: pauses that
  account's sign-in for 15 minutes); 20 invalid or expired links per 10
  minutes per address. Reset emails: 3 an hour per address, 10 requests per
  10 minutes per address.
- Admin endpoints check the admin's rights before they read the request,
  so others learn nothing about what they would accept.
- 300 KB request-body cap.
- scrypt password hashing, HttpOnly SameSite=Lax session cookies (30 days),
  `Secure` + HSTS whenever `ACADEMY_SECURE_COOKIES` is on.
- **SQL injection:** every query passes user input as a `?` parameter, never
  by building SQL text, so input is only ever data. Usernames are limited to
  letters, digits and `_`; email addresses can't contain `< > " ' ;` etc.
- **XSS:** everything a user or the URL supplies is escaped (`esc()`) before it
  reaches the page. The Content-Security-Policy runs no inline scripts at all
  (so injected markup would stay inert), only this site's files and the one
  pinned KaTeX release, which `tracks/math.html` also checks by `integrity`
  hash.
- **Admin panel** (`/admin.html`): only accounts with the admin flag, which
  only the server's command line sets (`make admin NAME=…`); every admin
  request re-checks it, and every change is written to `admin_log`. Lesson
  HTML from the panel is sanitized with an allowlist (`nh3`) before it is
  stored, and admins can't delete admin accounts or see a reset link when
  email is set up.
- **Cross-site request forgery:** every API write must be sent as JSON (else
  415), which a form on another site can't do; there is no CORS.
- **Static serving is an allowlist**: only `/`, the seven page files,
  `robots.txt` and the `css/ js/ tracks/ assets/` trees are reachable. Source,
  the database, `.git`, `.env`, `deploy/`, `REVISION`, dotfiles and everything
  else 404, however the path is spelled. No directory listings, and the API
  docs are off in production.
- **Search engines** (Google dorking): `X-Robots-Tag: noindex` on every
  response and `Disallow: /` in robots.txt; nothing of a closed school belongs
  in search results. No `server:` banner.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` on every
  response.
- Expired sessions and reset tokens are swept at startup and hourly.
- Structured request + auth-event logging to stdout (`make logs`).

In the Docker setup:

- The app's port is published on `127.0.0.1` only; the proxy is the only way in (§3).
- Updates: `make auto-update-on` adds a cron job that runs
  `deploy/auto-update.sh` every 5 minutes. It only acts when the checked-out
  branch (normally `master`) moved on GitHub; then it backs up the database
  and runs the steps of `make update`. If the new version doesn't build or
  start, it resets to the commit that was running, rebuilds that, and skips
  the bad commit until a newer one arrives. It never discards changes made on
  the server and never follows a rewritten history: both are logged to
  `backups/auto-update.log` for a person to sort out.
  Every Sunday at 04:00 it runs `make refresh` (with a backup first): the
  newest `caddy:2-alpine` and `python:3.12-slim` images, so security fixes
  arrive even when no code changes.
- A changed Caddyfile is validated (`make check-caddy`) before Caddy restarts
  with it; an invalid one makes the update roll back instead of taking the
  site down. While the app restarts during an update, Caddy holds requests
  and retries (`lb_try_duration`), so a normal update causes no errors, only
  a pause of a second or two.
- Disk: every update deletes old images and caps Docker's build cache at
  2 GB (`make prune-images`); backups are kept 30 days, in the volume and in
  `backups/`. Container logs are capped at 5 × 10 MB.
- The caddy container is locked down like the app: read-only filesystem,
  all Linux capabilities dropped except binding ports 80/443, no new
  privileges. Both have a process limit.
- Lesson videos (`media/`, or `MEDIA_DIR` in `.env`) are mounted read-only
  into both containers. Caddy serves `/media/<name>.mp4|webm|jpg|vtt`
  straight from disk, with byte ranges for seeking, and nothing else from
  that folder (no listings, no hidden files). The app serves the same paths
  when there is no Caddy, never gzipped. `/api/content.js` lists the hosted
  videos, so pages play them instead of YouTube's.
- Caddy answers `/api/health` with 404 from the internet (`make status` and
  the healthcheck reach the app directly) and sends no `Server`/`Via` header.
- The container sandbox (§2): read-only code, no capabilities, non-root.
- Learners' code never runs on the server, nor in the site's pages: they solve
  the exercises in Google Colab (§2), and the Content-Security-Policy forbids
  `eval` and workers outright.
- Secrets live in `.env` on the server. They are never in git and never in
  the image.
- Course notebooks are published without Colab's `executionInfo` (the Google
  account that ran each cell). Strip it from any notebook you add:
  `tests/test_api.py` fails while one has it.

## 6. Scale notes

Measured on a laptop with SQLite in WAL mode: ~620 state syncs/sec (p50 12 ms)
and ~47 concurrent scrypt logins/sec, with no lock contention. The expected
load (~100 learners ≈ 66 syncs/sec) leaves roughly 9× headroom, so a single
process and SQLite are the right fit. There is no reason to add Postgres or
a second worker at this size.

If you ever do run multiple workers, note two things that are per-process and
would need moving first: the rate-limit buckets (in-memory) and the hourly
sweep task (would run once per worker; harmless, just redundant).
