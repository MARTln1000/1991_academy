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
| `ACADEMY_CPP` | `1` | `0` | **Must be `0` on any public server.** The C++ runner compiles and executes learner code on the host. It is a local-development convenience, not a sandbox. (The image has no compiler, so it couldn't run anyway) |
| `ACADEMY_SECURE_COOKIES` | on unless `ACADEMY_DEBUG=1` | on | Marks the session cookie `Secure` (HTTPS only) and sends HSTS |
| `ACADEMY_TRUST_PROXY` | `0` | `1` | **`1` when, and only when, a trusted reverse proxy sets `X-Forwarded-For`.** See §3 |
| `ACADEMY_BASE_URL` | `http://localhost:8735` | `https://$DOMAIN` | Public origin used to build password-reset links |

Where each one is set:

- **`Dockerfile`**: `ACADEMY_HOST`, `PORT`, `ACADEMY_DB`, `ACADEMY_DEBUG`, `ACADEMY_CPP`.
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
unprivileged user `academy` (uid 10001).

**The app container** has a read-only filesystem. Its only writable places
are the `academy_data` volume and a `/tmp` in memory. It holds no Linux
capabilities and can't gain privileges. A compromised app therefore can't
modify its own code. Logs are capped at 5 × 10 MB per container.
`restart: unless-stopped` means Docker starts both containers again after a
reboot.

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
are a cron line (README.md → Publishing on a server, step 7). Both copies are
on the same server as the database, so copy `backups/` somewhere else now and
then.

`make restore FILE=…` stops the app, snapshots the current database first (if
that fails, nothing is restored and the app is started again), replaces the
database with the backup, and starts the app.

Course assets and code are static and can always be rebuilt from git.

## 5. Built-in protections

In `app.py`:

- Rate limits: login 10/min·IP, register 5/10min·IP, reset 5/10min·IP, C++ runner 12/min·IP.
- 300 KB request-body cap; 60 KB code-size cap.
- scrypt password hashing, HttpOnly SameSite=Lax session cookies (30 days),
  `Secure` + HSTS whenever `ACADEMY_SECURE_COOKIES` is on.
- **Static serving is an allowlist**: only `/`, the five page files and the
  `css/ js/ tracks/ assets/` trees are reachable. Source, the database,
  `deploy/`, `REVISION`, dotfiles and everything else 404, however the path is
  spelled.
- Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` on every response.
- Expired sessions and reset tokens are swept at startup and hourly.
- Structured request + auth-event logging to stdout (`make logs`).

In the Docker setup:

- The app's port is published on `127.0.0.1` only; the proxy is the only way in (§3).
- The container sandbox (§2): read-only code, no capabilities, non-root.
- Secrets live in `.env` on the server. They are never in git and never in
  the image.

## 6. Scale notes

Measured on a laptop with SQLite in WAL mode: ~620 state syncs/sec (p50 12 ms)
and ~47 concurrent scrypt logins/sec, with no lock contention. The expected
load (~100 learners ≈ 66 syncs/sec) leaves roughly 9× headroom, so a single
process and SQLite are the right fit. There is no reason to add Postgres or
a second worker at this size.

If you ever do run multiple workers, note two things that are per-process and
would need moving first: the rate-limit buckets (in-memory) and the hourly
sweep task (would run once per worker; harmless, just redundant).
