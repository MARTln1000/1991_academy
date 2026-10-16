# Deployment

1991 Academy runs as two containers managed by Docker Compose: the application
(API and static frontend, SQLite database in a named volume) and Caddy (TLS
termination with automatic certificates). Servers deploy the `master` branch
and can update themselves from GitHub.

## Requirements

| Item | Requirement |
|------|-------------|
| Server | Linux with Docker (Ubuntu 24.04 recommended), root SSH access. 1 vCPU and 1 GB RAM are sufficient for about 100 active users. |
| Disk | 20 GB. Add 80-100 GB if lecture videos are self-hosted. |
| DNS | An `A` record for the domain pointing at the server. Add `AAAA` only if IPv6 works end to end, otherwise certificate issuance fails. With Cloudflare, use "DNS only"; a proxied record hides client IPs from the rate limiter. |
| Inbound ports | 22/tcp, 80/tcp, 443/tcp, 443/udp (HTTP/3, optional). Port 8735 must not be exposed. |
| Outbound access | github.com (code and updates), Docker Hub (base images), pypi.org (build), Let's Encrypt (certificates). |
| Software | Docker Engine with the Compose plugin, git, make. |

No database server, mail server or external service is required. The
application sends no email and needs no secrets.

## Installation

Run as root on the server.

1. Install Docker, git and make:
   ```bash
   curl -fsSL https://get.docker.com | sh
   apt-get install -y git make
   ```
2. Clone the repository:
   ```bash
   git clone https://github.com/MARTln1000/1991_academy.git && cd 1991_academy
   ```
3. Configure: `cp .env.example .env` and set `DOMAIN=<domain>` (without scheme).
   If another web server already uses ports 80/443, also set `PROXY=external`
   (see [Reverse proxy](#reverse-proxy)).
4. Start: `make up`. The first build takes a few minutes. Caddy obtains the
   certificate once DNS resolves to the server.
5. Create the first administrator:
   ```bash
   make admin NAME=<username> EMAIL=<email>
   ```
   This prints a temporary password; sign in at `https://<domain>/account.html`
   and choose a permanent one. Further accounts are created from the admin
   panel (see [administration.md](administration.md)).
6. Schedule nightly backups: `make nightly-backup`.
7. Enable the firewall:
   ```bash
   ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable
   ```
8. Enable automatic updates: `make auto-update-on`.
9. Recommended outside the server: copy `backups/` to off-site storage
   regularly, and configure an uptime monitor for `https://<domain>/`.

To migrate existing data, copy a backup to the server and run
`make restore FILE=<backup>.db.gz` after step 4.

**Verification:** `make status` should show both containers up (the app as
`healthy`) and `"debug":false,"secure_cookies":true,"trust_proxy":true`.

## Configuration

### .env

| Key | Default | Description |
|-----|---------|-------------|
| `DOMAIN` | empty | Public hostname. Empty runs the local stack on `http://localhost:8735` without Caddy. |
| `PROXY` | `caddy` | `caddy`: bundled Caddy terminates TLS. `external`: an existing web server proxies to `127.0.0.1:8735`. |
| `MEDIA_DIR` | `./media` | Directory with self-hosted lecture videos. |

`.env` is not tracked by git and is created with mode 600.

### Application environment

These are set by the Dockerfile and Compose files and should not be changed
on a production server.

| Variable | Production | Default (`python app.py`) | Description |
|----------|------------|---------------------------|-------------|
| `PORT` | `8735` | `8735` | Listen port |
| `ACADEMY_HOST` | `0.0.0.0` in the container, published on host `127.0.0.1` | `0.0.0.0` | Bind address |
| `ACADEMY_DB` | `/data/academy.db` | `./1991_academy.db` | SQLite database path |
| `ACADEMY_MEDIA` | `/media` | `./media` | Self-hosted media directory |
| `ACADEMY_DEBUG` | `0` | `1` | Debug mode: no asset caching, API docs at `/api/docs` |
| `ACADEMY_SECURE_COOKIES` | `1` | on unless debug | `Secure` session cookie and HSTS |
| `ACADEMY_TRUST_PROXY` | `1` | `0` | Read the client IP from `X-Forwarded-For` |
| `ACADEMY_BASE_URL` | `https://$DOMAIN` | `http://localhost:8735` | Public URL used in invitation links |

`ACADEMY_TRUST_PROXY=1` is safe only while the proxy is the sole route to the
application: the port is published on loopback only, and Caddy overwrites
`X-Forwarded-For`. Docker-published ports bypass ufw, so never publish 8735 on
a public interface.

## Runtime layout

```
container academy-app-1    image 1991-academy (built locally)    127.0.0.1:8735
container academy-caddy-1  caddy:2-alpine                         :80, :443 (tcp, udp)

volume academy_data          /data: academy.db (+ WAL files) and backups/
volume academy_caddy-data    TLS certificates and ACME account
volume academy_caddy-config  Caddy runtime configuration

checkout directory
├── .env                     local configuration (untracked)
└── backups/                 host copies of database backups (untracked)
```

The Compose project name is fixed (`academy`), so volume names do not depend
on the checkout directory.

**Image:** `python:3.12-slim` with the `sqlite3` CLI and dependencies pinned by
`requirements.lock`. It runs as an unprivileged user (uid 10001). The build
revision is written to `REVISION` and reported by `/api/health`.

**Container hardening:** read-only root filesystem (writable: the data volume
and an in-memory `/tmp`), all Linux capabilities dropped (Caddy keeps
`NET_BIND_SERVICE`), `no-new-privileges`, process limits, log rotation at
5 x 10 MB. Both containers restart automatically.

Never run `docker compose down -v`: it deletes the database and certificate
volumes. Use `make down`.

## Reverse proxy

**Caddy** (default) is configured by `deploy/Caddyfile`. It obtains and renews
the certificate for `$DOMAIN`, redirects HTTP to HTTPS, removes `Server`/`Via`
headers, returns 404 for `/api/health`, serves `/media` from disk after an
authentication check (`forward_auth` to `/api/auth-check`), and retries
requests for up to 20 seconds while the application restarts during deploys.

**External web server** (`PROXY=external`): only the application container is
started and the existing web server must proxy to `127.0.0.1:8735` on the same
host. Example for nginx with certbot:

```nginx
server {
    server_name academy.example.com;
    listen 443 ssl http2;
    # ssl_certificate ... (managed by certbot --nginx)
    client_max_body_size 1m;
    server_tokens off;
    location = /api/health { return 404; }
    location / {
        proxy_pass http://127.0.0.1:8735;
        proxy_set_header X-Forwarded-For $remote_addr;   # overwrite, never append
        proxy_set_header Host $host;
    }
}
```

The application compresses responses itself, so no proxy compression is needed.

## Updates

Servers track the `master` branch.

**Automatic (recommended):** `make auto-update-on` installs a cron job that runs
`deploy/auto-update.sh` every 5 minutes. When `master` has new commits it backs
up the database, fast-forwards, validates a changed Caddyfile, rebuilds and
restarts. If the build or start fails, it restores the previous commit and
skips the failed one until a newer commit arrives. It does not act when
tracked files were modified locally, when the checkout is on a detached
commit, or when history was rewritten; the reason is logged to
`backups/auto-update.log`. Every Sunday at 04:00 it also rebuilds on the latest
Caddy and Python base images (`make refresh`). `make auto-update-off` disables
both jobs.

**Manual:** `make update` (pull, rebuild, restart, prune old images).

**Rollback:** `git checkout <commit> && make up`. Return with
`git checkout master && make update`. Automatic updates pause while the
checkout is detached.

Schema migrations are additive (new columns and indexes only), so older code
runs against a newer database. A deploy causes a pause of a few seconds while
the application restarts; Caddy holds and retries requests during that time.

Old images are pruned after every update and the Docker build cache is capped
at 2 GB.

## Backups

The entire application state is one SQLite file.

| Command | Behaviour |
|---------|-----------|
| `make backup` | Consistent online snapshot (`sqlite3 .backup`), integrity check, gzip to `/data/backups/academy-<UTC>.db.gz`, copied to `backups/` on the host. Backups older than 30 days are deleted in both places. |
| `make nightly-backup` | Cron job running `make backup` daily at 03:30 (log: `backups/cron.log`). |
| `make restore FILE=...` | Stops the app, backs up the current database, restores the file, starts the app. Nothing is restored if the safety backup fails. |

Backups are also taken before every automatic update. All of them reside on
the same server; off-site copies are the operator's responsibility, e.g.
`rsync -a root@SERVER:1991_academy/backups/ ./academy-backups/`.

Code, course materials and generated notebooks are restored from git.
Self-hosted videos are not included in backups.

If backup retention or log limits change, update the retention section of
`privacy.html` (both languages).

## Operations

| Command | Purpose |
|---------|---------|
| `make status` | Container state, health, live revision, auto-update status and recent log |
| `make logs` | Follow container logs (requests, sign-ins, admin actions, certificate events) |
| `make restart` | Recreate containers after editing `.env` |
| `make shell` | Shell in the app container; `sqlite3 /data/academy.db` opens the database |
| `make admin NAME=... [EMAIL=...]`, `make admin-remove`, `make admins` | Manage administrators |
| `make password NAME=...` | Issue a temporary password (e.g. for an administrator) |
| `make disposable-list` | Refresh the disposable-email domain list (then release) |

The image is built on the host that runs it. Do not transfer images between
architectures (e.g. an arm64 image from Apple Silicon to an amd64 server).

## Troubleshooting

| Symptom | Cause and resolution |
|---------|----------------------|
| `make up` reports "this computer" on a server | `DOMAIN` is empty in `.env`. |
| Certificate errors or no response | DNS does not point at the server yet, or ports 80/443 are blocked. Check `make logs`. |
| `port is already allocated` | Another web server uses 80/443. Use `PROXY=external` or stop it. |
| `Cannot connect to the Docker daemon` | `systemctl start docker` |
| New commits are not deployed | See `backups/auto-update.log`. |
| Invitation links contain `localhost` | `DOMAIN` was not set when the stack started; the admin panel shows a warning. |
| Administrator lost their password | `make password NAME=<username>` |

## Monitoring

Docker runs a health check against `/api/health` every 30 seconds.
`/api/health` is reachable only from the host. For external monitoring, poll
`https://<domain>/` (an unauthenticated request returns a 303 redirect to the
sign-in page).

## Capacity

Measured with SQLite in WAL mode: about 620 state syncs per second (p50 12 ms)
and 47 concurrent scrypt sign-ins per second on a laptop. 100 active users
generate roughly 66 syncs per second. A single process is sufficient at this
scale. Running multiple workers would require moving the in-memory rate-limit
state to shared storage.

## Self-hosted media

Lecture videos can be served from the server instead of YouTube (see
[content.md](content.md#lecture-videos)). Allow about 0.5 GB of disk per hour
of video and comparable egress per hour watched. `make media-upload
TO=root@SERVER` transfers new files; no restart is needed.
