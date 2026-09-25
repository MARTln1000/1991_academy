#!/usr/bin/env python3
"""
1991 Academy backend — FastAPI.

    .venv/bin/python app.py                # http://localhost:8735
    .venv/bin/uvicorn app:app --port 8735  # equivalent (schema set up on startup)

Serves the static site and the JSON API.

Design notes that matter if you touch this file:

* **Nothing blocking runs on the event loop.** SQLite calls, scrypt hashing and
  the C++ subprocess all go through `run_in_threadpool`. A single 25-second C++
  compile used to stall every other request, including static files.
* **Static serving is an allowlist, not a blocklist.** Only `/`, the five page
  files, and the css/js/tracks/assets trees are reachable. An extension
  blocklist could be walked around by case (`/APP.PY` on macOS) and wrongly
  404'd the `.py` starter files under `assets/courses/`.
* **Schema setup + expiry sweeping live in the lifespan handler**, so they run
  under any ASGI server, not just `python app.py`.

Environment:
    PORT           listen port                      (default 8735)
    ACADEMY_HOST   bind address                     (default 0.0.0.0 — reachable on
                   your LAN; production binds 127.0.0.1 behind the proxy)
    ACADEMY_DB     SQLite path                      (default ./1991_academy.db)
    ACADEMY_DEBUG  1 = dev mode: no-store caching   (default 1)
    ACADEMY_CPP    1 = enable the C++ runner        (default 1; it executes
                   learner code on THIS machine — keep it off on public hosts)
    ACADEMY_SECURE_COOKIES  1 = Secure (HTTPS-only) session cookie
                   (default: on unless ACADEMY_DEBUG=1)
    ACADEMY_TRUST_PROXY     1 = read client IP from X-Forwarded-For
                   (set ONLY behind a trusted reverse proxy)

API:
    POST /api/register            {username, email, password}
    POST /api/login               {identifier, password}
    POST /api/logout
    GET  /api/me
    GET  /api/state               -> {"data": {...}|null, "updated": ts|null}
    PUT  /api/state               {"data": {...}}   (also snapshots XP)
    GET  /api/leaderboard[?period=week|all] -> {"top": [{username, xp}...], "you": rank|null, "period"}
    POST /api/leaderboard-optin   {"optIn": bool}
    POST /api/change-password     {currentPassword, newPassword}
    POST /api/forgot-password     {email}            (always 200; emails a reset link)
    POST /api/reset-password      {token, password}
    POST /api/delete-account      {password}
    POST /api/run-cpp             {source, harness}
    GET  /api/health

Email (password reset) env, all optional — unset ⇒ links are logged not sent:
    ACADEMY_SMTP_HOST / _PORT / _USER / _PASS / _FROM,  ACADEMY_BASE_URL
"""

import asyncio
import hashlib
import hmac
import json
import logging
import math
import os
import re
import secrets
import shutil
import smtplib
import sqlite3
import subprocess
import tempfile
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager, contextmanager
from email.message import EmailMessage
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.middleware.gzip import GZipMiddleware

# ---------------------------------------------------------------- config

VERSION = "2.3"

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", 8735))
# Only used by `python app.py`. Behind a reverse proxy this must be 127.0.0.1:
# with ACADEMY_TRUST_PROXY=1, anyone who can reach the port directly could
# forge X-Forwarded-For and walk around the per-IP rate limits.
HOST = os.environ.get("ACADEMY_HOST", "0.0.0.0")
DB_PATH = os.environ.get("ACADEMY_DB", str(ROOT / "1991_academy.db"))
DEBUG = os.environ.get("ACADEMY_DEBUG", "1") == "1"
ENABLE_CPP = os.environ.get("ACADEMY_CPP", "1") == "1"

# Mark the session cookie Secure (HTTPS-only) in production. Defaults to the
# opposite of DEBUG so local http://localhost dev still works, prod does not
# leak the cookie over plain HTTP. Override with ACADEMY_SECURE_COOKIES=0/1.
SECURE_COOKIES = os.environ.get("ACADEMY_SECURE_COOKIES", "0" if DEBUG else "1") == "1"
# Behind a reverse proxy (nginx/Caddy), request.client.host is the proxy, so
# per-IP rate limiting would collapse to one bucket. Set ACADEMY_TRUST_PROXY=1
# ONLY when a trusted proxy sets X-Forwarded-For (else a client could spoof it).
TRUST_PROXY = os.environ.get("ACADEMY_TRUST_PROXY", "0") == "1"

SESSION_TTL = 30 * 86400          # 30 days
MAX_BODY = 300_000                # bytes, hard cap for any request body
MAX_CODE_BYTES = 60_000
RESET_TTL = 3600                  # password-reset links live 1 hour
SWEEP_INTERVAL = 3600             # expired sessions / reset tokens, hourly
# Ceiling for the leaderboard XP snapshot. The whole curriculum is worth a few
# thousand XP, so anything past this is a corrupt or forged blob. Clamping also
# keeps the value inside SQLite's 8-byte INTEGER, which an unclamped one need
# not be.
MAX_XP = 10_000_000

# Outbound email (password reset). Unset SMTP → links are logged, never sent
# (fine for local dev; on a public host set these or reset emails won't arrive).
SMTP_HOST = os.environ.get("ACADEMY_SMTP_HOST")
SMTP_PORT = int(os.environ.get("ACADEMY_SMTP_PORT", 587))
SMTP_USER = os.environ.get("ACADEMY_SMTP_USER")
SMTP_PASS = os.environ.get("ACADEMY_SMTP_PASS")
SMTP_FROM = os.environ.get("ACADEMY_SMTP_FROM") or SMTP_USER or "no-reply@1991.academy"
# Absolute origin used to build reset links in emails (e.g. https://academy.example.com).
BASE_URL = os.environ.get("ACADEMY_BASE_URL", f"http://localhost:{PORT}").rstrip("/")

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

CPP_COMPILER = shutil.which("c++") or shutil.which("g++") or shutil.which("clang++")

# The git commit this release was built from. deploy/deploy.sh writes the file
# into every release; /api/health reports it so a deploy can confirm the live
# site is serving what was just shipped. Absent in a plain checkout.
try:
    REVISION = (ROOT / "REVISION").read_text().strip() or None
except OSError:
    REVISION = None

STARTED_AT = time.time()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("academy")

# ------------------------------------------------------- static allowlist

# Everything the browser may fetch, by construction. An allowlist cannot be
# defeated by case ("/APP.PY" resolves to app.py on a case-insensitive volume)
# or by an extension nobody thought to block.
PAGE_FILES = {
    "",  # "/" → index.html via StaticFiles(html=True)
    "index.html", "lab.html", "missions.html", "practice.html", "account.html",
}
# Course materials are whatever the lecturer published — PDFs, notebooks, CSVs,
# images, zips and .py starter files — so that tree can't be extension-limited.
ANY_EXTENSION = object()

# directory → permitted extensions
STATIC_TREES = {
    "css": {".css"},
    "js": {".js"},
    "tracks": {".html"},
    "assets": ANY_EXTENSION,
}


def static_allowed(path: str) -> bool:
    rel = path.lstrip("/")
    if rel in PAGE_FILES:
        return True
    segments = rel.split("/")
    # must name a known tree plus at least one segment inside it
    if len(segments) < 2 or segments[0] not in STATIC_TREES:
        return False
    # reject empty, relative and hidden segments anywhere in the path
    if any(seg in ("", ".", "..") or seg.startswith(".") for seg in segments):
        return False
    allowed_exts = STATIC_TREES[segments[0]]
    if allowed_exts is ANY_EXTENSION:
        return True
    return os.path.splitext(rel)[1].lower() in allowed_exts

# ---------------------------------------------------------------- database


@contextmanager
def db():
    """A connection that is always closed. Callers commit their own writes."""
    conn = sqlite3.connect(DB_PATH, timeout=5)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 5000")   # wait, don't fail, on a locked DB
        conn.execute("PRAGMA synchronous = NORMAL")  # safe + fast under WAL
        conn.execute("PRAGMA foreign_keys = ON")     # per-connection; off by default
        yield conn
    finally:
        conn.close()


def init_db():
    with db() as conn:
        # WAL lets readers and a writer proceed concurrently — important once
        # many users sync progress at once (a single-writer rollback journal
        # would serialize them). Persists on the DB file after being set once.
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                pass_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                created REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS state (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                data TEXT NOT NULL,
                updated REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS password_resets (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                created REAL NOT NULL,
                expires REAL NOT NULL
            );
            """
        )
        # migrate pre-leaderboard databases in place
        cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
        if "leaderboard_opt_in" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN leaderboard_opt_in INTEGER NOT NULL DEFAULT 0")
            log.info("migration: added users.leaderboard_opt_in")
        if "xp_total" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN xp_total INTEGER NOT NULL DEFAULT 0")
            conn.execute("ALTER TABLE users ADD COLUMN xp_updated REAL")
            log.info("migration: added users.xp_total / xp_updated")
        if "week_id" not in cols:
            # weekly league: xp_week_start = lifetime XP when the current week began;
            # weekly XP = xp_total - xp_week_start (see api_put_state).
            conn.execute("ALTER TABLE users ADD COLUMN xp_week_start INTEGER NOT NULL DEFAULT 0")
            conn.execute("ALTER TABLE users ADD COLUMN week_id TEXT")
            log.info("migration: added users.xp_week_start / week_id")

        # Login accepts username OR email case-insensitively, but the UNIQUE
        # constraints above are BINARY — so "Alice" and "alice" could both be
        # registered and the login lookup would then pick one arbitrarily.
        # A UNIQUE NOCASE index is the actual fix; fall back to a plain index
        # if an existing database already contains such a pair.
        for name, expr in (("username", "username COLLATE NOCASE"), ("email", "email COLLATE NOCASE")):
            try:
                conn.execute(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS idx_users_{name}_ci ON users({expr})"
                )
            except sqlite3.IntegrityError:
                log.warning(
                    "users.%s has case-duplicate values; using a non-unique index. "
                    "Resolve the duplicates to enforce case-insensitive uniqueness.", name
                )
                conn.execute(
                    f"CREATE INDEX IF NOT EXISTS idx_users_{name}_nocase ON users({expr})"
                )

        conn.executescript(
            """
            -- leaderboard: filter opted-in rows and sort by XP without a full scan.
            CREATE INDEX IF NOT EXISTS idx_users_leaderboard
                ON users(leaderboard_opt_in, xp_total DESC);
            -- "all sessions for a user" (logout-everywhere / account deletion).
            CREATE INDEX IF NOT EXISTS idx_sessions_user
                ON sessions(user_id);
            -- the hourly sweep deletes by age.
            CREATE INDEX IF NOT EXISTS idx_sessions_created
                ON sessions(created);
            -- weekly leaderboard filters on the current ISO-week id.
            CREATE INDEX IF NOT EXISTS idx_users_week
                ON users(leaderboard_opt_in, week_id);
            -- expiring reset tokens are looked up / swept by user + expiry.
            CREATE INDEX IF NOT EXISTS idx_resets_user
                ON password_resets(user_id);
            CREATE INDEX IF NOT EXISTS idx_resets_expires
                ON password_resets(expires);
            """
        )
        conn.commit()


def sweep_expired():
    """Sessions past their TTL and used/expired reset tokens are only ever
    deleted when that exact row is touched again, so they accumulate forever.
    Clear them out on startup and hourly after that."""
    now = time.time()
    with db() as conn:
        sessions = conn.execute(
            "DELETE FROM sessions WHERE created < ?", (now - SESSION_TTL,)
        ).rowcount
        resets = conn.execute(
            "DELETE FROM password_resets WHERE expires < ?", (now,)
        ).rowcount
        conn.commit()
    if sessions or resets:
        log.info("sweep: removed %d expired session(s), %d reset token(s)", sessions, resets)
    return sessions, resets


def hash_password(password: str, salt: bytes) -> str:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1).hex()


def verify_password(row, password: str) -> bool:
    """Constant-time check of a plaintext password against a user row."""
    return hmac.compare_digest(
        row["pass_hash"], hash_password(password, bytes.fromhex(row["salt"]))
    )


# Salt for the decoy hash below. Random per process; its only job is to make
# the work look identical, so it never needs to be stable or stored.
_DECOY_SALT = secrets.token_bytes(16)


def burn_password_time(password: str) -> None:
    """Hash against a throwaway salt when the account doesn't exist.

    Without this, a missing user returns in ~1 ms while a real one costs the
    ~30 ms of scrypt — a reliable oracle for enumerating who has an account."""
    hash_password(password, _DECOY_SALT)


def current_week_id(now: float | None = None) -> str:
    """ISO year-week, e.g. '2026-W28'. Weeks roll over Monday 00:00 UTC."""
    return time.strftime("%G-W%V", time.gmtime(now if now is not None else time.time()))


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plaintext email. If SMTP isn't configured, log the body instead
    (so local dev / reset links stay testable) and report False."""
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        log.warning("SMTP not configured — email to %s NOT sent. Contents:\n%s", to, body)
        return False
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        log.info("sent reset email to %s", to)
        return True
    except Exception as exc:  # noqa: BLE001 — never leak SMTP errors to the client
        log.error("SMTP send failed: %s", exc)
        return False

# ---------------------------------------------------------------- helpers


def err(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


def public_user(row) -> dict:
    return {
        "username": row["username"],
        "email": row["email"],
        "created": row["created"],
        "leaderboardOptIn": bool(row["leaderboard_opt_in"]),
        "xp": row["xp_total"],
    }


def session_token(request: Request):
    return request.cookies.get("msession")


def current_user(token, conn):
    """Resolve a session cookie to its user row. Runs inside the worker thread."""
    if not token:
        return None
    row = conn.execute(
        "SELECT u.*, s.created AS session_created FROM sessions s "
        "JOIN users u ON u.id = s.user_id WHERE s.token = ?",
        (token,),
    ).fetchone()
    if row is None:
        return None
    if time.time() - row["session_created"] > SESSION_TTL:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        return None
    return row


def new_session(conn, user_id: int) -> str:
    token = secrets.token_hex(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id, created) VALUES (?, ?, ?)",
        (token, user_id, time.time()),
    )
    conn.commit()
    return token


def set_session_cookie(response: JSONResponse, token: str):
    response.set_cookie(
        "msession", token, max_age=SESSION_TTL, httponly=True,
        samesite="lax", secure=SECURE_COOKIES, path="/",
    )


def clear_session_cookie(response: JSONResponse):
    response.delete_cookie(
        "msession", path="/", httponly=True, samesite="lax", secure=SECURE_COOKIES
    )


async def json_body(request: Request):
    try:
        body = await request.body()
        if len(body) > MAX_BODY:
            return None
        return json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None

# --------------------------------------------------------------- rate limit

_BUCKETS: dict = defaultdict(deque)
_BUCKET_CAP = 4096  # distinct ip:bucket keys before we prune idle ones


def client_ip(request: Request) -> str:
    """Best-effort client IP. Trusts X-Forwarded-For only when ACADEMY_TRUST_PROXY
    is set (a trusted proxy is in front); otherwise uses the direct peer, so a
    client cannot spoof its way out of rate limits by sending a fake header."""
    if TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "?"


def rate_limited(request: Request, bucket: str, limit: int, window_s: int) -> bool:
    """Sliding-window limiter, per client IP. True = over the limit."""
    ip = client_ip(request)
    key = f"{ip}:{bucket}"
    now = time.time()
    # The dict grew one entry per distinct IP forever; drop idle ones when it
    # gets large rather than letting a long-lived process leak them.
    if len(_BUCKETS) > _BUCKET_CAP:
        for k in [k for k, dq in _BUCKETS.items() if not dq or dq[-1] < now - 3600]:
            del _BUCKETS[k]
    dq = _BUCKETS[key]
    while dq and dq[0] < now - window_s:
        dq.popleft()
    if len(dq) >= limit:
        log.warning("rate-limit ip=%s bucket=%s", ip, bucket)
        return True
    dq.append(now)
    return False

# ---------------------------------------------------------------- app


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Runs under `python app.py` AND any external ASGI server, so a uvicorn/
    # gunicorn deployment can never come up against an un-migrated database.
    await run_in_threadpool(init_db)
    await run_in_threadpool(sweep_expired)

    async def sweeper():
        while True:
            await asyncio.sleep(SWEEP_INTERVAL)
            try:
                await run_in_threadpool(sweep_expired)
            except Exception:  # noqa: BLE001 — a failed sweep must not kill the task
                log.exception("sweep failed")

    task = asyncio.create_task(sweeper())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    lifespan=lifespan,
    docs_url="/api/docs" if DEBUG else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if DEBUG else None,
)

# Tuned to what the site actually loads: Pyodide + KaTeX from jsDelivr, Google
# Fonts, YouTube thumbnails and no-cookie embeds. 'unsafe-eval' and blob:
# workers are required — the learner's code runs through new Function() and
# Pyodide compiles WASM; 'unsafe-inline' covers the inline KaTeX bootstrap in
# tracks/math.html and the style attributes the renderers emit.
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https://i.ytimg.com",
    "frame-src 'self' https://www.youtube-nocookie.com",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
])


# The frontend is ~930 KB of uncompressed JS/CSS on the heaviest page (the
# content and the Armenian packs dominate) and there is no build step to
# shrink it. gzip takes that to ~275 KB. Doing it here rather than relying on
# the reverse proxy means it holds however the app is fronted — neither the
# nginx nor the Caddy config in DEPLOYMENT.md compresses proxied responses by
# default. Safe against BREACH: no secret is ever reflected into a response
# body (the session lives in an HttpOnly cookie).
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("unhandled error: %s %s", request.method, request.url.path)
    return JSONResponse({"error": "Something went wrong on our end."}, status_code=500)


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/") and not static_allowed(path):
        return err("not found", 404)
    # global body-size cap (cheap check via header; body() re-checks)
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY:
        return err("Request too large.", 413)

    t0 = time.time()
    response = await call_next(request)
    ms = int((time.time() - t0) * 1000)

    if DEBUG or path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=86400"
    else:
        response.headers["Cache-Control"] = "no-cache"

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = CSP
    if SECURE_COOKIES:  # only meaningful (and only sent) over HTTPS in production
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    if path.startswith("/api/"):
        log.info("%s %s %s %dms", request.method, path, response.status_code, ms)
    return response

# ---------------------------------------------------------------- auth


def _register(username: str, email: str, password: str):
    with db() as conn:
        exists = conn.execute(
            "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
            (username, email),
        ).fetchone()
        if exists:
            return None, None
        salt = secrets.token_bytes(16)
        try:
            conn.execute(
                "INSERT INTO users (username, email, pass_hash, salt, created) VALUES (?, ?, ?, ?, ?)",
                (username, email, hash_password(password, salt), salt.hex(), time.time()),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # Lost the race against a concurrent signup for the same name.
            return None, None
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
        ).fetchone()
        return row, new_session(conn, row["id"])


@app.post("/api/register")
async def api_register(request: Request):
    if rate_limited(request, "register", 5, 600):
        return err("Too many sign-up attempts — try again in a few minutes.", 429)
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    username = str(body.get("username", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))

    if not USERNAME_RE.match(username):
        return err("Username must be 3-20 characters: letters, digits, underscore.")
    if not EMAIL_RE.match(email):
        return err("That doesn't look like an email address.")
    if len(password) < 8:
        return err("Password must be at least 8 characters.")

    row, token = await run_in_threadpool(_register, username, email, password)
    if row is None:
        return err("That username or email is already taken.", 409)
    response = JSONResponse({"user": public_user(row)}, status_code=201)
    set_session_cookie(response, token)
    log.info("register user=%s", username)
    return response


def _login(identifier: str, password: str):
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
            (identifier, identifier),
        ).fetchone()
        if row is None:
            burn_password_time(password)  # same cost as a real check
            return None, None
        if not verify_password(row, password):
            return None, None
        return row, new_session(conn, row["id"])


@app.post("/api/login")
async def api_login(request: Request):
    if rate_limited(request, "login", 10, 60):
        return err("Too many login attempts — wait a minute.", 429)
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    identifier = str(body.get("identifier", "")).strip()
    password = str(body.get("password", ""))
    if not identifier or not password:
        return err("Enter your username/email and password.")

    row, token = await run_in_threadpool(_login, identifier, password)
    if row is None:
        log.info("login-failed identifier=%s", identifier)
        return err("Wrong credentials.", 401)
    response = JSONResponse({"user": public_user(row)})
    set_session_cookie(response, token)
    log.info("login user=%s", row["username"])
    return response


def _logout(token):
    if not token:
        return
    with db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


@app.post("/api/logout")
async def api_logout(request: Request):
    await run_in_threadpool(_logout, session_token(request))
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response


def _me(token):
    with db() as conn:
        user = current_user(token, conn)
        return public_user(user) if user else None


@app.get("/api/me")
async def api_me(request: Request):
    user = await run_in_threadpool(_me, session_token(request))
    if user is None:
        return err("not signed in", 401)
    return {"user": user}

# ---------------------------------------------------------------- state sync


def _get_state(token):
    with db() as conn:
        user = current_user(token, conn)
        if user is None:
            return "unauthorized"
        row = conn.execute(
            "SELECT data, updated FROM state WHERE user_id = ?", (user["id"],)
        ).fetchone()
    if row is None:
        return {"data": None, "updated": None}
    return {"data": json.loads(row["data"]), "updated": row["updated"]}


@app.get("/api/state")
async def api_get_state(request: Request):
    out = await run_in_threadpool(_get_state, session_token(request))
    if out == "unauthorized":
        return err("not signed in", 401)
    return out


def xp_snapshot(data: dict):
    """Pull the leaderboard XP total out of the client-shaped blob.

    Returns None whenever the value isn't a usable number. That matters: this
    runs inside the same transaction as the state write, so an exception here
    (a corrupt blob carrying Infinity, NaN or an oversized int) used to abort
    the write and hand the learner a 500 — their progress silently stopped
    syncing. A bad XP value must cost the leaderboard entry, nothing more."""
    try:
        raw = json.loads(data.get("martinium:xp:v1") or "{}")
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(raw, dict):
        return None
    total = raw.get("total")
    # bool is an int subclass; reject it explicitly
    if isinstance(total, bool) or not isinstance(total, (int, float)):
        return None
    if isinstance(total, float) and not math.isfinite(total):
        return None
    try:
        total = int(total)
    except (ValueError, OverflowError):
        return None
    if total < 0:
        return None
    return min(total, MAX_XP)


def _put_state(token, data: dict):
    with db() as conn:
        user = current_user(token, conn)
        if user is None:
            return False
        conn.execute(
            "INSERT INTO state (user_id, data, updated) VALUES (?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated",
            (user["id"], json.dumps(data), time.time()),
        )
        xp_total = xp_snapshot(data)
        if xp_total is not None:
            # weekly league: when the user's stored week differs from the
            # current ISO week, rebase the weekly baseline to last week's
            # ending total so this week's counter restarts near zero.
            wk = current_week_id()
            week_start = user["xp_total"] if user["week_id"] != wk else user["xp_week_start"]
            conn.execute(
                "UPDATE users SET xp_total = ?, xp_updated = ?, xp_week_start = ?, week_id = ? WHERE id = ?",
                (xp_total, time.time(), week_start, wk, user["id"]),
            )
        conn.commit()
    return True


@app.put("/api/state")
async def api_put_state(request: Request):
    body = await json_body(request)
    if body is None or not isinstance(body.get("data"), dict):
        return err("invalid request body")
    data = body["data"]
    # The blob mirrors localStorage, so every value is a string. Enforcing that
    # keeps non-round-trippable JSON (bare NaN / Infinity) out of the database —
    # stored once, it came back as something the browser's JSON.parse rejects,
    # permanently breaking that account's sync.
    if not all(isinstance(k, str) and isinstance(v, str) for k, v in data.items()):
        return err("invalid request body")
    ok = await run_in_threadpool(_put_state, session_token(request), data)
    if not ok:
        return err("not signed in", 401)
    return {"ok": True}

# ---------------------------------------------------------------- leaderboard


def _leaderboard(token, period: str):
    wk = current_week_id()
    with db() as conn:
        if period == "week":
            top = [
                {"username": r["username"], "xp": r["wxp"]}
                for r in conn.execute(
                    "SELECT username, (xp_total - xp_week_start) AS wxp FROM users "
                    "WHERE leaderboard_opt_in = 1 AND week_id = ? "
                    "AND (xp_total - xp_week_start) > 0 "
                    "ORDER BY wxp DESC, username ASC LIMIT 20",
                    (wk,),
                )
            ]
        else:
            top = [
                {"username": r["username"], "xp": r["xp_total"]}
                for r in conn.execute(
                    "SELECT username, xp_total FROM users "
                    "WHERE leaderboard_opt_in = 1 AND xp_total > 0 "
                    "ORDER BY xp_total DESC, username ASC LIMIT 20"
                )
            ]
        you = None
        user = current_user(token, conn)
        if user is not None and user["leaderboard_opt_in"]:
            if period == "week":
                my = (user["xp_total"] - user["xp_week_start"]) if user["week_id"] == wk else 0
                if my > 0:
                    higher = conn.execute(
                        "SELECT COUNT(*) FROM users WHERE leaderboard_opt_in = 1 "
                        "AND week_id = ? AND (xp_total - xp_week_start) > ?",
                        (wk, my),
                    ).fetchone()[0]
                    you = higher + 1
            else:
                higher = conn.execute(
                    "SELECT COUNT(*) FROM users WHERE leaderboard_opt_in = 1 AND xp_total > ?",
                    (user["xp_total"],),
                ).fetchone()[0]
                you = higher + 1
    return {"top": top, "you": you, "period": period}


@app.get("/api/leaderboard")
async def api_leaderboard(request: Request):
    period = "week" if request.query_params.get("period") == "week" else "all"
    return await run_in_threadpool(_leaderboard, session_token(request), period)


def _leaderboard_optin(token, opt_in: int):
    with db() as conn:
        user = current_user(token, conn)
        if user is None:
            return None
        conn.execute("UPDATE users SET leaderboard_opt_in = ? WHERE id = ?", (opt_in, user["id"]))
        conn.commit()
        return user["username"]


@app.post("/api/leaderboard-optin")
async def api_leaderboard_optin(request: Request):
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    opt_in = 1 if body.get("optIn") else 0
    username = await run_in_threadpool(_leaderboard_optin, session_token(request), opt_in)
    if username is None:
        return err("not signed in", 401)
    log.info("leaderboard-optin user=%s optIn=%s", username, bool(opt_in))
    return {"ok": True, "optIn": bool(opt_in)}

# ------------------------------------------------------ password & account mgmt


def _change_password(token, current: str, new: str):
    with db() as conn:
        user = current_user(token, conn)
        if user is None:
            return "unauthorized"
        if not verify_password(user, current):
            return "wrong-password"
        salt = secrets.token_bytes(16)
        conn.execute(
            "UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?",
            (hash_password(new, salt), salt.hex(), user["id"]),
        )
        # keep the caller signed in, drop every OTHER session (a changed password
        # should log out other devices).
        conn.execute(
            "DELETE FROM sessions WHERE user_id = ? AND token != ?", (user["id"], token)
        )
        conn.commit()
        return user["username"]


@app.post("/api/change-password")
async def api_change_password(request: Request):
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    current = str(body.get("currentPassword", ""))
    new = str(body.get("newPassword", ""))
    if len(new) < 8:
        return err("New password must be at least 8 characters.")
    out = await run_in_threadpool(_change_password, session_token(request), current, new)
    if out == "unauthorized":
        return err("not signed in", 401)
    if out == "wrong-password":
        return err("Your current password is wrong.", 403)
    log.info("change-password user=%s", out)
    return {"ok": True}


def _forgot_password(email: str):
    """Returns the reset link to send, or None when the email is unknown."""
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email,)
        ).fetchone()
        if row is None:
            return None
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        now = time.time()
        conn.execute("DELETE FROM password_resets WHERE user_id = ?", (row["id"],))
        conn.execute(
            "INSERT INTO password_resets (token_hash, user_id, created, expires) "
            "VALUES (?, ?, ?, ?)",
            (token_hash, row["id"], now, now + RESET_TTL),
        )
        conn.commit()
    return f"{BASE_URL}/account.html?reset={token}"


@app.post("/api/forgot-password")
async def api_forgot_password(request: Request):
    if rate_limited(request, "forgot", 5, 600):
        return err("Too many reset requests — try again later.", 429)
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    email = str(body.get("email", "")).strip().lower()
    # ALWAYS return the same response — never reveal whether an email is registered.
    if not EMAIL_RE.match(email):
        return JSONResponse({"ok": True})
    link = await run_in_threadpool(_forgot_password, email)
    if not link:
        return JSONResponse({"ok": True})
    # Hand the SMTP round-trip to a background task: awaiting it here would make
    # a registered address answer seconds slower than an unregistered one, which
    # is the email-enumeration leak the generic response exists to prevent.
    return JSONResponse({"ok": True}, background=BackgroundTask(
        send_email,
        email,
        "Reset your 1991 Academy password",
        "Someone asked to reset the password for your 1991 Academy account.\n\n"
        f"Set a new password (link valid for 1 hour):\n{link}\n\n"
        "If this wasn't you, ignore this email — your password is unchanged.",
    ))


def _reset_password(token: str, new: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM password_resets WHERE token_hash = ?", (token_hash,)
        ).fetchone()
        if row is None or row["expires"] < time.time():
            return None
        salt = secrets.token_bytes(16)
        conn.execute(
            "UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?",
            (hash_password(new, salt), salt.hex(), row["user_id"]),
        )
        conn.execute("DELETE FROM password_resets WHERE user_id = ?", (row["user_id"],))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["user_id"],))  # force re-login
        conn.commit()
        return row["user_id"]


@app.post("/api/reset-password")
async def api_reset_password(request: Request):
    if rate_limited(request, "reset", 10, 600):
        return err("Too many attempts — try again later.", 429)
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    token = str(body.get("token", ""))
    new = str(body.get("password", ""))
    if len(new) < 8:
        return err("Password must be at least 8 characters.")
    user_id = await run_in_threadpool(_reset_password, token, new)
    if user_id is None:
        return err("This reset link is invalid or has expired.", 400)
    log.info("reset-password user_id=%s", user_id)
    return {"ok": True}


def _delete_account(token, password: str):
    with db() as conn:
        user = current_user(token, conn)
        if user is None:
            return "unauthorized"
        if not verify_password(user, password):
            return "wrong-password"
        uid = user["id"]
        # child rows first: foreign keys are enforced on this connection.
        conn.execute("DELETE FROM state WHERE user_id = ?", (uid,))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
        conn.execute("DELETE FROM password_resets WHERE user_id = ?", (uid,))
        conn.execute("DELETE FROM users WHERE id = ?", (uid,))
        conn.commit()
        return user["username"]


@app.post("/api/delete-account")
async def api_delete_account(request: Request):
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    password = str(body.get("password", ""))
    out = await run_in_threadpool(_delete_account, session_token(request), password)
    if out == "unauthorized":
        return err("not signed in", 401)
    if out == "wrong-password":
        return err("Password is wrong.", 403)
    log.info("delete-account user=%s", out)
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response

# ---------------------------------------------------------------- C++ runner

CPP_PREAMBLE = r"""
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <cmath>
using namespace std;
static string __ts(long long v){ return to_string(v); }
static string __ts(int v){ return to_string(v); }
static string __ts(double v){ char b[32]; snprintf(b,32,"%g",v); return string(b); }
static string __ts(bool v){ return v ? "true" : "false"; }
static string __ts(const string& v){ return v; }
static string __ts(const vector<int>& v){ string r="["; for(size_t i=0;i<v.size();++i){ if(i) r+=","; r+=to_string(v[i]); } return r+"]"; }
template<class A, class B>
void __check(const string& name, const A& actual, const B& expected){
  string a=__ts(actual), e=__ts(expected);
  cout << "CHECK|" << (a==e ? "1" : "0") << "|" << name << "|" << e << "|" << a << "\n";
}
"""


def _compile_and_run_cpp(source: str, harness: str) -> dict:
    """Blocking: compile + execute. Called via run_in_threadpool — a 25-second
    compile on the event loop used to stall every other request on the server."""
    program = CPP_PREAMBLE + "\n" + source + "\n" + harness + "\n"
    try:
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "main.cpp")
            exe = os.path.join(d, "prog")
            with open(src, "w") as f:
                f.write(program)
            comp = subprocess.run(
                [CPP_COMPILER, "-std=c++17", "-O1", "-w", src, "-o", exe],
                capture_output=True, text=True, timeout=25,
            )
            if comp.returncode != 0:
                return {"error": "Compilation error:\n" + comp.stderr[-1600:], "results": []}
            run = subprocess.run([exe], capture_output=True, text=True, timeout=8)
            results = []
            for line in run.stdout.splitlines():
                if line.startswith("CHECK|"):
                    parts = line.split("|", 4)
                    if len(parts) == 5:
                        results.append(
                            {"name": parts[2], "pass": parts[1] == "1", "expected": parts[3], "actual": parts[4]}
                        )
            if not results and run.returncode != 0:
                return {
                    "error": "Runtime error (exit " + str(run.returncode) + "). " + (run.stderr[-800:] or "crash before any test ran."),
                    "results": [],
                }
            return {"results": results}
    except subprocess.TimeoutExpired:
        return {"error": "Timed out — infinite loop, or compilation took too long.", "results": []}
    except Exception as exc:  # noqa: BLE001 — surface anything to the learner
        log.exception("cpp runner failed")
        return {"error": "Runner error: " + str(exc), "results": []}


@app.post("/api/run-cpp")
async def api_run_cpp(request: Request):
    """Compile learner C++ + harness and run it. Executes code on THIS host —
    local-dev convenience, gated by ACADEMY_CPP."""
    if not ENABLE_CPP:
        return JSONResponse({"error": "The C++ runner is disabled on this server.", "results": []})
    if CPP_COMPILER is None:
        return JSONResponse({"error": "No C++ compiler found on this machine.", "results": []})
    if rate_limited(request, "cpp", 12, 60):
        return err("Too many compile requests — wait a minute.", 429)

    body = await json_body(request)
    if body is None or not isinstance(body.get("source"), str) or not isinstance(body.get("harness"), str):
        return err("invalid request body")
    source, harness = body["source"], body["harness"]
    if len(source) > MAX_CODE_BYTES or len(harness) > MAX_CODE_BYTES:
        return JSONResponse({"error": "Source too large.", "results": []})

    return JSONResponse(await run_in_threadpool(_compile_and_run_cpp, source, harness))

# ---------------------------------------------------------------- health


@app.get("/api/health")
async def api_health():
    return {
        "ok": True,
        "uptime_s": int(time.time() - STARTED_AT),
        "debug": DEBUG,
        "cpp": ENABLE_CPP and CPP_COMPILER is not None,
        "email": bool(SMTP_HOST and SMTP_USER and SMTP_PASS),
        "secure_cookies": SECURE_COOKIES,
        "trust_proxy": TRUST_PROXY,
        "week": current_week_id(),
        "version": VERSION,
        "revision": REVISION,
    }

# static site LAST so /api/* wins (the guard middleware has already restricted
# which paths can reach it)
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="site")


if __name__ == "__main__":
    cpp = "C++ ✓" if (ENABLE_CPP and CPP_COMPILER) else "C++ ✗"
    log.info("1991 Academy backend on http://localhost:%d  [%s, debug=%s, secure_cookies=%s, trust_proxy=%s, rev=%s]",
             PORT, cpp, DEBUG, SECURE_COOKIES, TRUST_PROXY, (REVISION or "dev")[:7])
    # Loud warning if a public-looking config still has the RCE runner on.
    if not DEBUG and ENABLE_CPP:
        log.warning("SECURITY: ACADEMY_CPP is ON in a non-debug run — the C++ runner "
                    "executes arbitrary code on this host. Set ACADEMY_CPP=0 on public servers.")
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")
