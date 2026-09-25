# Deploying 1991 Academy

**README.md → Deploy** is the workflow. You prepare a server once with
`deploy/setup-server.sh`; after that, every push to `master` that passes the
tests is deployed by GitHub Actions (`.github/workflows/deploy.yml` runs
`deploy/deploy.sh`, which runs `deploy/activate.sh` on the server). This file
is the reference behind it: every setting, what the scripts build on the
server, and why.

The backend is a single FastAPI app (`app.py`) serving both the API and the
static site. Locally: `make dev` (or `.venv/bin/python app.py`).

**With Docker instead** (README.md → Run with Docker): `docker-compose.yml`
runs the same app with the same production values as the table in §1. The
`Dockerfile` sets most of them and the compose file sets the proxy trust. The
database is `/data/academy.db` in the `academy_data` volume, and
`deploy/Caddyfile.docker` does the job of §4. §2, §3 and the scripts they
describe apply only to the systemd setup.

## 1. Environment

| Variable | `python app.py` default | Production (`academy.service`) | Meaning |
|----------|-------------------------|--------------------------------|---------|
| `PORT` | `8735` | `8735` | Listen port. Caddy and the deploy health check expect 8735 |
| `ACADEMY_HOST` | `0.0.0.0` | `127.0.0.1` | Bind address. Behind a proxy it **must** be loopback; see §4 |
| `ACADEMY_DB` | `./1991_academy.db` | `/var/lib/academy/academy.db` | SQLite path. Outside the code, so no release can touch it |
| `ACADEMY_DEBUG` | `1` | `0` | `0` enables asset caching and hides the API docs |
| `ACADEMY_CPP` | `1` | `0` | **Must be `0` on any public server.** The C++ runner compiles and executes learner code on the host. It is a local-development convenience, not a sandbox |
| `ACADEMY_SECURE_COOKIES` | on unless `ACADEMY_DEBUG=1` | on | Marks the session cookie `Secure` (HTTPS only) and sends HSTS |
| `ACADEMY_TRUST_PROXY` | `0` | `1` | **Set `1` when, and only when, a trusted reverse proxy sets `X-Forwarded-For`.** See the warning in §4 |

The production column is set by `deploy/academy.service`. The service then
reads `/etc/academy/academy.env`, which holds the site-specific values and
secrets; anything set there overrides the unit. `deploy/activate.sh` prints a
warning after every deploy if `/api/health` reports debug mode or the C++
runner switched on.

Password reset needs SMTP. With these unset, the reset link is written to the
log instead of emailed (fine for local dev, useless in production):

| Variable | Meaning |
|----------|---------|
| `ACADEMY_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_FROM` | Outbound mail relay (STARTTLS) |
| `ACADEMY_BASE_URL` | Public origin used to build reset links, e.g. `https://academy.example.com`. `setup-server.sh` fills it in |

## 2. What the server looks like

```
/opt/academy/                                  owned by deploy
├── releases/
│   ├── 20260923-181502-ad3ab77/               one per deploy: the commit's files + its own .venv
│   └── 20260924-101500-3fb8571/               files unchanged since the previous release are hard links
├── current -> releases/20260924-101500-3fb8571   what systemd runs
└── .deploy.lock                               one activation at a time
/etc/academy/academy.env                       root:academy 0640: domain, SMTP credentials
/var/lib/academy/academy.db                    academy, dir 0700: the database
/var/backups/academy/                          academy, dir 0700: nightly + pre-deploy snapshots
/etc/caddy/Caddyfile                           https://your-domain → 127.0.0.1:8735
/etc/sudoers.d/academy-deploy                  the deploy user's five sudo commands
```

Two users, each with only what it needs:

- **`academy`** runs the app. It owns the database and the backups and can't
  write the code it runs.
- **`deploy`** is who GitHub Actions logs in as, with a key marked `restrict`
  (no forwarding, no terminal) and no password. It owns `/opt/academy`. Through
  sudo it may stop and start `academy.service`, start a backup, and read the
  last lines of those two logs, nothing else. It can read neither
  `academy.env` nor the database.

A release is exactly the files of one commit (`git archive`, so never
untracked files like a local database or `.env`), plus a `REVISION` file that
`/api/health` reports. Each release builds its own virtualenv from
`requirements.lock`, so rolling back restores the code and its exact
dependencies together. The five newest releases are kept.

## 3. The service

`deploy/academy.service` runs `/opt/academy/current/.venv/bin/python app.py`
as `academy`.

- **Switching releases.** `activate.sh` stops the service *before* repointing
  `current` and starts it after. The whole switch is atomic from the service's
  point of view, and a running process never has the symlink change under it
  (a lazy import would otherwise load the new release's code into the old
  process).
- **Sandbox.** The filesystem is read-only apart from `/var/lib/academy`.
  There are no capabilities, a private `/tmp` and `/dev`, and no namespaces,
  SUID or realtime scheduling. `systemd-analyze security academy.service`
  rates it 3.5 "OK"; an unhardened unit scores about 9.6.
- **Restarts.** `Restart=on-failure` with no start-rate limit. Whether a
  release is good is decided by the deploy's health check, and a tripped
  limit would make the automatic rollback's `systemctl start` fail. During a
  deploy the health check treats the first automatic restart as a failed
  release and rolls back at once, instead of waiting out its 30-second timeout.

## 4. HTTPS reverse proxy

Cookies carry sessions, so HTTPS is mandatory on the open internet.

> **Set `ACADEMY_TRUST_PROXY=1` whenever you put a proxy in front.** Without it
> the app sees every request as coming from the proxy's own address, so all
> per-IP rate limits collapse into a single shared bucket for the entire
> internet: one attacker would lock everyone out of logging in.
>
> The flag is off by default because a client can forge `X-Forwarded-For`
> directly. Only turn it on once a proxy you control is the sole way in. The
> production setup does both: the app binds `127.0.0.1` (`ACADEMY_HOST`), and
> ufw admits only SSH, HTTP and HTTPS.

**Caddy** is what `setup-server.sh` installs, from Caddy's official apt
repository, configured from `deploy/Caddyfile`. It obtains and renews the
certificate automatically and redirects HTTP to HTTPS. It sets
`X-Forwarded-For` to the real client address and drops whatever value the
client sent:

```
academy.example.com {
	reverse_proxy 127.0.0.1:8735
}
```

**nginx** instead (with certbot for TLS): run `systemctl disable --now caddy`
after `setup-server.sh`, and use:

```nginx
server {
    server_name academy.example.com;
    listen 443 ssl http2;
    # ssl_certificate ... (certbot)
    client_max_body_size 1m;
    location / {
        proxy_pass http://127.0.0.1:8735;
        # overwrite, don't append: a forged header from the client must not survive
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Host $host;
    }
}
```

## 5. Backups

Everything that matters is one SQLite file. `academy-backup.service` runs
`deploy/backup.sh` (installed as `/usr/local/sbin/academy-backup`), which:

- takes a consistent online snapshot with sqlite's `.backup`, since a plain
  `cp` of a WAL-mode database can capture a torn state;
- checks it with `PRAGMA integrity_check`;
- writes it as `/var/backups/academy/academy-<UTC time>.db.gz`;
- deletes snapshots older than 30 days (`ACADEMY_BACKUP_KEEP_DAYS`).

It runs nightly (`academy-backup.timer`, around 03:30 UTC; a run missed while
the server was off is caught up at boot) and before every deploy. If that
pre-deploy backup fails, nothing is deployed. Copy the backups somewhere off
the server too. Restoring is in README.md → Deploy → Backups. Course assets
and code are static and redeployable from git.

## 6. Built-in protections

In `app.py`:

- Rate limits: login 10/min·IP, register 5/10min·IP, reset 5/10min·IP, C++ runner 12/min·IP.
- 300 KB request-body cap; 60 KB code-size cap.
- scrypt password hashing, HttpOnly SameSite=Lax session cookies (30 days),
  `Secure` + HSTS whenever `ACADEMY_SECURE_COOKIES` is on.
- **Static serving is an allowlist**: only `/`, the five page files and the
  `css/ js/ tracks/ assets/` trees are reachable. Source, the database, the
  `deploy/` scripts, `REVISION`, dotfiles and everything else 404, however the
  path is spelled.
- Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` on every response.
- Expired sessions and reset tokens are swept at startup and hourly.
- Structured request + auth-event logging to stdout (journald picks it up).

In the deployment:

- The app listens on loopback only; the firewall admits SSH, HTTP and HTTPS.
- The service sandbox (§3): a compromised app can't modify its own code or
  anything outside its database directory.
- The deploy key can upload releases and restart the app, and nothing else (§2).
- CI pins the server's SSH host key (`DEPLOY_KNOWN_HOSTS`), so a deploy can't
  be redirected to an impostor.

## 7. Scale notes

Measured on a laptop with SQLite in WAL mode: ~620 state syncs/sec (p50 12 ms)
and ~47 concurrent scrypt logins/sec, with no lock contention. The expected
load (~100 learners ≈ 66 syncs/sec) leaves roughly 9× headroom, so a single
process and SQLite are the right fit. There is no reason to add Postgres or
a second worker at this size.

If you ever do run multiple workers, note two things that are per-process and
would need moving first: the rate-limit buckets (in-memory) and the hourly
sweep task (would run once per worker; harmless, just redundant).
