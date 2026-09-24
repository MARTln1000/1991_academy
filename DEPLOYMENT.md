# Deploying 1991 Academy

The backend is a single FastAPI app (`app.py`) serving both the API and the
static site. Locally: `.venv/bin/python app.py`. This guide covers putting it
on a real server.

## 1. Environment

| Variable        | Default            | Meaning                                             |
|-----------------|--------------------|-----------------------------------------------------|
| `PORT`          | `8735`             | Listen port                                         |
| `ACADEMY_DB`    | `./1991_academy.db`| SQLite path — put it OUTSIDE the web root in prod   |
| `ACADEMY_DEBUG` | `1`                | `0` in production (enables asset caching, hides docs)|
| `ACADEMY_CPP`   | `1`                | **Set `0` on any public server.** The C++ runner compiles and executes learner code on the host — it is a local-development convenience, not a sandbox. |
| `ACADEMY_SECURE_COOKIES` | on unless `ACADEMY_DEBUG=1` | Marks the session cookie `Secure` (HTTPS only) and sends HSTS |
| `ACADEMY_TRUST_PROXY` | `0`       | **Set `1` when — and only when — a trusted reverse proxy sets `X-Forwarded-For`.** See the warning in §4. |

Password reset needs SMTP; with these unset the reset link is written to the
log instead of emailed (fine for local dev, useless in production):

| Variable | Meaning |
|----------|---------|
| `ACADEMY_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_FROM` | Outbound mail relay (STARTTLS) |
| `ACADEMY_BASE_URL` | Public origin used to build reset links, e.g. `https://academy.example.com` |

## 2. Server setup (Ubuntu-ish)

```bash
sudo apt install python3-venv
git/rsync the project to /opt/academy      # never copy .venv; recreate it
cd /opt/academy
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
ACADEMY_DEBUG=0 ACADEMY_CPP=0 PORT=8735 .venv/bin/python app.py   # smoke test
```

**Never expose `1991_academy.db`** — it holds credentials. The app refuses to
serve `.db`/`.py` paths, but keep the DB out of the web root anyway
(`ACADEMY_DB=/var/lib/academy/academy.db`).

## 3. systemd unit

`/etc/systemd/system/academy.service`:

```ini
[Unit]
Description=1991 Academy
After=network.target

[Service]
User=academy
WorkingDirectory=/opt/academy
Environment=PORT=8735 ACADEMY_DEBUG=0 ACADEMY_CPP=0 ACADEMY_TRUST_PROXY=1 ACADEMY_DB=/var/lib/academy/academy.db
ExecStart=/opt/academy/.venv/bin/python /opt/academy/app.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now academy
```

## 4. HTTPS reverse proxy

Cookies carry sessions — HTTPS is mandatory on the open internet.

> **Set `ACADEMY_TRUST_PROXY=1` whenever you put a proxy in front.** Without it
> the app sees every request as coming from the proxy's own address, so all
> per-IP rate limits collapse into a single shared bucket for the entire
> internet — one attacker would lock everyone out of logging in.
>
> The flag is off by default because a client can forge `X-Forwarded-For`
> directly. Only turn it on once a proxy you control is the sole way in
> (i.e. bind the app to `127.0.0.1`, or firewall its port).

**Caddy** (easiest, auto-TLS) — sets `X-Forwarded-For` automatically:

```
academy.example.com {
    reverse_proxy 127.0.0.1:8735
}
```

**nginx** (with certbot for TLS):

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

Everything that matters is one SQLite file:

```bash
sqlite3 /var/lib/academy/academy.db ".backup /backups/academy-$(date +%F).db"
```

Cron that daily. Course assets and code are static — redeployable from source.

## 6. Built-in protections (already in app.py)

- Rate limits: login 10/min·IP, register 5/10min·IP, reset 5/10min·IP, C++ runner 12/min·IP.
- 300 KB request-body cap; 60 KB code-size cap.
- scrypt password hashing, HttpOnly SameSite=Lax session cookies (30 days),
  `Secure` + HSTS whenever `ACADEMY_SECURE_COOKIES` is on.
- **Static serving is an allowlist**: only `/`, the five page files and the
  `css/ js/ tracks/ assets/` trees are reachable. Source, the database, dotfiles
  and everything else 404 regardless of how the path is spelled.
- Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` on every response.
- Expired sessions and reset tokens are swept at startup and hourly.
- Structured request + auth-event logging to stdout (journald picks it up).

## 7. Scale notes

Measured on a laptop with SQLite in WAL mode: ~620 state syncs/sec (p50 12 ms)
and ~47 concurrent scrypt logins/sec, with no lock contention. The expected
load (~100 learners ≈ 66 syncs/sec) leaves roughly 9× headroom, so a single
process and SQLite are the right fit — there is no reason to add Postgres or
a second worker at this size.

If you ever do run multiple workers, note two things that are per-process and
would need moving first: the rate-limit buckets (in-memory) and the hourly
sweep task (would run once per worker — harmless, just redundant).
