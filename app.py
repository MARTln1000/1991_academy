#!/usr/bin/env python3
"""
1991 Academy backend — FastAPI.

    .venv/bin/python app.py                # http://localhost:8735
    .venv/bin/uvicorn app:app --port 8735  # equivalent (schema set up on startup)

Serves the static site and the JSON API.

Design notes that matter if you touch this file:

* **Nothing blocking runs on the event loop.** SQLite calls and scrypt hashing
  go through `run_in_threadpool`.
* **Static serving is an allowlist, not a blocklist.** Only `/`, the seven page
  files, robots.txt, and the css/js/tracks/assets trees are reachable. An extension
  blocklist could be walked around by case (`/APP.PY` on macOS) and wrongly
  404'd the `.py` starter files under `assets/courses/`.
* **Schema setup + expiry sweeping live in the lifespan handler**, so they run
  under any ASGI server, not just `python app.py`.

Environment:
    PORT           listen port                      (default 8735)
    ACADEMY_HOST   bind address                     (default 0.0.0.0 — reachable on
                   your LAN; in Docker, compose publishes it on 127.0.0.1 only)
    ACADEMY_DB     SQLite path                      (default ./1991_academy.db)
    ACADEMY_MEDIA  folder of hosted lesson videos   (default ./media)
    ACADEMY_DEBUG  1 = dev mode: no-store caching   (default 1)
    ACADEMY_SECURE_COOKIES  1 = Secure (HTTPS-only) session cookie
                   (default: on unless ACADEMY_DEBUG=1)
    ACADEMY_TRUST_PROXY     1 = read client IP from X-Forwarded-For
                   (set ONLY behind a trusted reverse proxy)

API:
    POST /api/login               {identifier, password}
    POST /api/welcome             {token} -> {username}  (an invitation link's account)
    POST /api/logout
    GET  /api/me
    GET  /api/state               -> {"data": {...}|null, "updated": ts|null}
    PUT  /api/state               {"data": {...}}   (also snapshots XP)
    GET  /api/leaderboard[?period=week|all] -> {"top": [{username, xp}...], "you": rank|null, "period"}
    POST /api/leaderboard-optin   {"optIn": bool}
    POST /api/change-password     {currentPassword, newPassword}
    POST /api/forgot-password     {email}            (always 200; emails a reset link)
    POST /api/reset-password      {token, password}  (also: an invited student's first password)
    POST /api/delete-account      {password}
    GET  /api/health
    GET  /api/auth-check          204 when signed in, else 401 (Caddy asks it before serving videos)
    GET  /api/content.js          lessons and announcements added in the admin panel,
                                  and the lesson videos hosted here (ACADEMY_MEDIA)

Accounts are by invitation only: there is no sign-up. Admins invite students;
the first admin is made on the server (`python app.py admin add NAME EMAIL`).

Admin (accounts with users.is_admin; `python app.py admin add NAME` grants it):
    GET  /api/admin/overview      site statistics
    POST /api/admin/invites       {students: [{email, username?}]} -> accounts + welcome links
    GET  /api/admin/users[?q=&sort=created|active|xp|name&offset=]
    GET  /api/admin/users/NAME    one learner, with their progress
    POST /api/admin/users/NAME/reset-link | sign-out | delete
    GET  /api/admin/lessons       PUT|DELETE /api/admin/lessons/ID   POST .../ID/preview
    GET  /api/admin/announcements POST /api/admin/announcements  PUT|DELETE .../ID
    GET  /api/admin/log           what admins changed
    GET  /api/admin/media         which lesson videos are hosted here

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
import smtplib
import sqlite3
import ssl
import sys
import time
from collections import Counter, defaultdict, deque
from contextlib import asynccontextmanager, contextmanager
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import quote

import nh3
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.middleware.gzip import GZipMiddleware

# ---------------------------------------------------------------- config

VERSION = "2.3"

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", 8735))
# Only used by `python app.py`. Behind a reverse proxy, nothing but the proxy
# may reach this port: with ACADEMY_TRUST_PROXY=1, anyone who can reach it
# directly could forge X-Forwarded-For and walk around the per-IP rate limits.
# In Docker the container binds 0.0.0.0 and docker-compose.yml publishes the
# port on 127.0.0.1 only, so just Caddy and the host itself can reach it.
HOST = os.environ.get("ACADEMY_HOST", "0.0.0.0")
DB_PATH = os.environ.get("ACADEMY_DB", str(ROOT / "1991_academy.db"))
# The lesson videos hosted here instead of streamed from YouTube, named after
# the lecture's YouTube id: <id>.mp4 (or .webm), with an optional <id>.jpg
# poster. Not in git or the image; docker-compose.yml mounts MEDIA_DIR here.
# README.md → "Lesson videos".
MEDIA_DIR = Path(os.environ.get("ACADEMY_MEDIA", str(ROOT / "media")))
DEBUG = os.environ.get("ACADEMY_DEBUG", "1") == "1"

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
RESET_TTL = 3600                  # password-reset links live 1 hour
INVITE_TTL = 7 * 86400            # invitations (welcome links) live a week
# pass_hash of an invited account whose student hasn't chosen a password yet:
# no password matches it, so nobody can sign in to it until they do.
INVITED = "!"
SWEEP_INTERVAL = 3600             # expired sessions / reset tokens, hourly
# Ceiling for the leaderboard XP snapshot. The whole curriculum is worth a few
# thousand XP, so anything past this is a corrupt or forged blob. Clamping also
# keeps the value inside SQLite's 8-byte INTEGER, which an unclamped one need
# not be.
MAX_XP = 10_000_000

# The browser keeps a learner's progress in localStorage under this prefix, and
# the synced state blob mirrors those keys. Until the project was renamed the
# prefix was "martinium:". Old keys are renamed wherever they turn up: stored
# blobs once at startup (init_db), and blobs sent by a page that was loaded
# before the rename.
STORE_PREFIX = "1991_academy:"
LEGACY_STORE_PREFIX = "martinium:"
XP_KEY = STORE_PREFIX + "xp:v1"

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
# No whitespace, control characters, or characters that mean something in HTML
# or in a mail header: an address can never carry markup onto a page.
_EMAIL_CHAR = r"[^@\s\x00-\x1f\x7f<>\"'`()\[\]\\,;:]"
EMAIL_RE = re.compile(rf"^{_EMAIL_CHAR}+@{_EMAIL_CHAR}+\.{_EMAIL_CHAR}+$")
MAX_EMAIL = 254                   # the longest address SMTP allows

# The git commit this image was built from ("-dirty" = with uncommitted
# changes). The Dockerfile writes the file from the REVISION build argument the
# Makefile passes; /api/health reports it, so `make status` shows which
# version is live. Absent in a plain checkout.
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
    "index.html", "lab.html", "missions.html", "practice.html", "account.html", "privacy.html",
    "admin.html", "robots.txt",
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


# /media/<name>.<ext>: one flat folder of videos, posters and subtitles.
MEDIA_PATH_RE = re.compile(r"^/media/[A-Za-z0-9_-]{1,64}\.(?:mp4|webm|jpg|vtt)$")
YOUTUBE_FILE_RE = re.compile(r"^([A-Za-z0-9_-]{11})\.(mp4|webm|jpg)$")


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
            -- Lessons written in the admin panel. An id that matches a built-in
            -- lesson (js/data/) replaces its text; any other id is a new lesson,
            -- placed in `module` after `after` (NULL: at the end). `data` is the
            -- lesson as JSON, already validated and sanitized (parse_lesson).
            CREATE TABLE IF NOT EXISTS lessons (
                id TEXT PRIMARY KEY,
                track TEXT NOT NULL,
                module TEXT NOT NULL,
                after TEXT,
                data TEXT NOT NULL,
                published INTEGER NOT NULL DEFAULT 0,
                created REAL NOT NULL,
                updated REAL NOT NULL,
                updated_by TEXT NOT NULL
            );
            -- The banners shown at the top of every page while active.
            CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY,
                text TEXT NOT NULL,
                text_hy TEXT NOT NULL DEFAULT '',
                level TEXT NOT NULL DEFAULT 'info',
                active INTEGER NOT NULL DEFAULT 1,
                created REAL NOT NULL,
                created_by TEXT NOT NULL
            );
            -- Every change made through the admin panel or `app.py admin`.
            -- Names, not user ids: the record outlives deleted accounts.
            CREATE TABLE IF NOT EXISTS admin_log (
                id INTEGER PRIMARY KEY,
                ts REAL NOT NULL,
                admin TEXT NOT NULL,
                action TEXT NOT NULL,
                target TEXT,
                detail TEXT
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
        if "is_admin" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
            log.info("migration: added users.is_admin")

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
            -- the activity log is read newest first.
            CREATE INDEX IF NOT EXISTS idx_admin_log_ts
                ON admin_log(ts);
            """
        )

        # Blobs stored before the "martinium:" → "1991_academy:" rename. Values
        # are untouched (a code draft may contain the old word); only keys move.
        legacy = conn.execute(
            "SELECT user_id, data FROM state WHERE data LIKE ?", (f'%"{LEGACY_STORE_PREFIX}%',)
        ).fetchall()
        renamed = 0
        for row in legacy:
            try:
                blob = json.loads(row["data"])
            except json.JSONDecodeError:
                continue
            if isinstance(blob, dict) and current_keys(blob) is not blob:
                conn.execute(
                    "UPDATE state SET data = ? WHERE user_id = ?",
                    (json.dumps(current_keys(blob)), row["user_id"]),
                )
                renamed += 1
        if renamed:
            log.info("migration: renamed %s* keys to %s* in %d stored state blob(s)",
                     LEGACY_STORE_PREFIX, STORE_PREFIX, renamed)
        conn.commit()


def current_keys(data: dict) -> dict:
    """The state blob with legacy "martinium:" keys renamed to STORE_PREFIX.
    Returns the same dict when there is nothing to rename. If both spellings of
    a key are present, the current one wins."""
    if not any(k.startswith(LEGACY_STORE_PREFIX) for k in data):
        return data
    out = {k: v for k, v in data.items() if not k.startswith(LEGACY_STORE_PREFIX)}
    for k, v in data.items():
        if k.startswith(LEGACY_STORE_PREFIX):
            out.setdefault(STORE_PREFIX + k[len(LEGACY_STORE_PREFIX):], v)
    return out


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
    if row["pass_hash"] == INVITED:      # no password chosen yet: nothing matches
        burn_password_time(password)
        return False
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


def email_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def deliver(to: str, subject: str, body: str) -> None:
    """Send a plaintext email through the configured mailbox, or raise.

    The connection is encrypted before the password is sent, and the mail
    server's certificate is checked against the trusted authorities: an
    unchecked one would hand the mailbox password to whoever sits in between.
    Port 465 is encrypted from the start; any other port (587) upgrades with
    STARTTLS."""
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    context = ssl.create_default_context()
    if SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20, context=context)
    else:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
    with server as s:
        if SMTP_PORT != 465:
            s.starttls(context=context)
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plaintext email. If SMTP isn't configured, log the body instead
    (so local dev / reset links stay testable) and report False."""
    if not email_configured():
        log.warning("SMTP not configured — email to %s NOT sent. Contents:\n%s", to, body)
        return False
    try:
        deliver(to, subject, body)
        log.info("sent email to %s: %s", to, subject)
        return True
    except Exception as exc:  # noqa: BLE001 — never leak SMTP errors to the client
        log.error("SMTP send to %s failed: %s", to, exc)
        return False

# ---------------------------------------------------------------- helpers


def err(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


class Invalid(ValueError):
    """Input to send back with its message: a lesson, an announcement, an invitation."""


def public_user(row) -> dict:
    return {
        "username": row["username"],
        "email": row["email"],
        "created": row["created"],
        "leaderboardOptIn": bool(row["leaderboard_opt_in"]),
        "xp": row["xp_total"],
        "admin": bool(row["is_admin"]),
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
    """The request's JSON object, or None. Every endpoint takes an object, so a
    list or a bare number is as invalid as malformed JSON (and must not reach
    the handlers' body.get() as a 500)."""
    try:
        body = await request.body()
        if len(body) > MAX_BODY:
            return None
        body = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError, RecursionError):
        return None
    return body if isinstance(body, dict) else None

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

# Tuned to what the site actually loads: KaTeX from jsDelivr, Google Fonts,
# YouTube thumbnails and no-cookie embeds. No eval and no workers: learners'
# code runs in Google Colab, never in these pages.
#
# Scripts: only files from this site and the one KaTeX release, never inline
# code. So even if markup were ever injected into a page, an inline
# <script> or onclick= in it would not run. jsDelivr is pinned to the KaTeX
# path (it also serves any npm package or GitHub repo, which an attacker
# could publish), and tracks/math.html adds integrity= hashes on top.
# 'unsafe-inline' stays for styles only: the renderers emit style attributes.
KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/"
CSP = "; ".join([
    "default-src 'self'",
    f"script-src 'self' {KATEX}",
    "worker-src 'none'",
    f"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com {KATEX}",
    f"font-src 'self' data: https://fonts.gstatic.com {KATEX}",
    "img-src 'self' data: https://i.ytimg.com",
    "frame-src 'self' https://www.youtube-nocookie.com",
    "connect-src 'self'",
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
class GZipExceptMedia(GZipMiddleware):
    """Videos are compressed already, and gzip would break the byte ranges a
    player asks for when it seeks."""

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"].startswith("/media/"):
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


app.add_middleware(GZipExceptMedia, minimum_size=1024)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("unhandled error: %s %s", request.method, request.url.path)
    return JSONResponse({"error": "Something went wrong on our end."}, status_code=500)


# 1991 Academy is a closed school: only its students (accounts an admin
# invited) see anything. Without a session a visitor reaches the sign-in page
# and what it needs: its scripts and styles, and the privacy policy. Lessons
# (js/data/), course files (assets/), videos (media/) and every other page
# need one. API endpoints check the session themselves.
PUBLIC_PATHS = {"/account.html", "/privacy.html", "/robots.txt"}


def public_path(path: str) -> bool:
    if path in PUBLIC_PATHS or path.startswith("/css/"):
        return True
    return path.startswith("/js/") and not path.startswith("/js/data/")


def session_valid(token) -> bool:
    if not token:
        return False
    with db() as conn:
        row = conn.execute("SELECT created FROM sessions WHERE token = ?", (token,)).fetchone()
    return row is not None and time.time() - row["created"] <= SESSION_TTL


def gate(request: Request, path: str):
    """The response that stops this request, or None to let it through."""
    if path.startswith("/media/"):
        if not MEDIA_PATH_RE.match(path) or not MEDIA_DIR.is_dir():
            return err("not found", 404)
    elif not path.startswith("/api/") and not static_allowed(path):
        return err("not found", 404)
    # Cross-site request forgery: a form or <img> on another site can only send
    # form or text bodies. A JSON body from another origin needs a CORS
    # preflight, which this API never grants. Requiring JSON on every API write
    # therefore also covers same-site pages (other subdomains), where the
    # SameSite=Lax cookie alone would still be sent.
    if path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        ctype = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if ctype != "application/json":
            return err("Send the request as JSON.", 415)
    # global body-size cap (cheap check via header; body() re-checks)
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY:
        return err("Request too large.", 413)
    return None


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    response = gate(request, path)
    if response is None and not path.startswith("/api/") and not public_path(path):
        if not await run_in_threadpool(session_valid, session_token(request)):
            if path == "/" or path.endswith(".html"):
                # a page: to the sign-in page, and back here afterwards
                response = RedirectResponse("/account.html?next=" + quote(path, safe="/"), status_code=303)
            else:
                response = err("Sign in first.", 401)

    t0 = time.time()
    if response is None:
        response = await call_next(request)
    ms = int((time.time() - t0) * 1000)

    if DEBUG or path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/assets/colab/"):
        # the exercise notebooks change with the exercises: always revalidate
        response.headers["Cache-Control"] = "no-cache"
    elif path.startswith(("/assets/", "/media/")):
        # private: only the student's own browser keeps a copy, never a proxy
        response.headers["Cache-Control"] = "private, max-age=86400"
    else:
        response.headers["Cache-Control"] = "no-cache"

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = CSP
    if SECURE_COOKIES:  # only meaningful (and only sent) over HTTPS in production
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # A closed school: search engines index nothing (robots.txt says so too).
    response.headers["X-Robots-Tag"] = "noindex, nofollow"

    if path.startswith("/api/"):
        log.info("%s %s %s %dms", request.method, path, response.status_code, ms)
    return response

# ---------------------------------------------------------------- auth


def create_account(conn, username: str, email: str, password: str | None = None) -> int:
    """A new account (its id), or Invalid. There is no sign-up: admins invite
    students, so without a password this is an invitation, which nobody can
    sign in to until the student chooses a password with the welcome link.
    The caller commits."""
    if not USERNAME_RE.match(username):
        raise Invalid("Username must be 3-20 characters: letters, digits, underscore.")
    if len(email) > MAX_EMAIL or not EMAIL_RE.match(email):
        raise Invalid("That doesn't look like an email address.")
    if conn.execute("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (username,)).fetchone():
        raise Invalid(f"The username {username} is taken.")
    if conn.execute("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone():
        raise Invalid(f"{email} already has an account.")
    if password is None:
        pass_hash, salt = INVITED, ""
    else:
        raw_salt = secrets.token_bytes(16)
        pass_hash, salt = hash_password(password, raw_salt), raw_salt.hex()
    try:
        cur = conn.execute(
            "INSERT INTO users (username, email, pass_hash, salt, created) VALUES (?, ?, ?, ?, ?)",
            (username, email, pass_hash, salt, time.time()),
        )
    except sqlite3.IntegrityError:            # a concurrent invite for the same name
        raise Invalid(f"The username {username} or {email} is taken.") from None
    return cur.lastrowid


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
    data = json.loads(row["data"])
    if isinstance(data, dict):
        data = current_keys(data)
    return {"data": data, "updated": row["updated"]}


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
        raw = json.loads(data.get(XP_KEY) or "{}")
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
    data = current_keys(data)  # from a page loaded before the storage-prefix rename
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
    if not await run_in_threadpool(session_valid, session_token(request)):
        return err("not signed in", 401)
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


def new_reset_link(conn, user_id: int, welcome: bool = False) -> str:
    """A fresh link to set the account's password, replacing any older one:
    a one-hour password reset, or with welcome=True a week-long invitation
    (account.html?welcome=…). Only the token's hash is stored. The caller
    commits."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = time.time()
    conn.execute("DELETE FROM password_resets WHERE user_id = ?", (user_id,))
    conn.execute(
        "INSERT INTO password_resets (token_hash, user_id, created, expires) "
        "VALUES (?, ?, ?, ?)",
        (token_hash, user_id, now, now + (INVITE_TTL if welcome else RESET_TTL)),
    )
    return f"{BASE_URL}/account.html?{'welcome' if welcome else 'reset'}={token}"


def invitation_email(username: str, link: str) -> tuple[str, str]:
    return (
        "Your 1991 Academy account",
        "You've been invited to 1991 Academy, the online school run by 1991 Unit.\n\n"
        f"Your username: {username}\n\n"
        f"Choose your password here (the link works for 7 days):\n{link}\n\n"
        "Questions? Write to ai.1991@mil.am.",
    )


def _forgot_password(email: str):
    """Returns the reset link to send, or None when the email is unknown."""
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email,)
        ).fetchone()
        if row is None:
            return None
        link = new_reset_link(conn, row["id"])
        conn.commit()
    return link


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
    """(user row, session token or None), or None for a bad link. A student
    accepting an invitation is signed in at once; after a password reset every
    session ends and the owner signs in again."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with db() as conn:
        row = conn.execute(
            "SELECT r.*, u.pass_hash AS old_hash FROM password_resets r "
            "JOIN users u ON u.id = r.user_id WHERE r.token_hash = ?", (token_hash,)
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
        session = new_session(conn, row["user_id"]) if row["old_hash"] == INVITED else None
        user = conn.execute("SELECT * FROM users WHERE id = ?", (row["user_id"],)).fetchone()
        return user, session


def _welcome(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with db() as conn:
        row = conn.execute(
            "SELECT u.username, r.expires FROM password_resets r JOIN users u ON u.id = r.user_id "
            "WHERE r.token_hash = ?", (token_hash,)
        ).fetchone()
    return row["username"] if row and row["expires"] >= time.time() else None


@app.post("/api/welcome")
async def api_welcome(request: Request):
    """Whose invitation (or reset) link this is: the page shows the username."""
    if rate_limited(request, "reset", 10, 600):
        return err("Too many attempts — try again later.", 429)
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    username = await run_in_threadpool(_welcome, str(body.get("token", "")))
    if username is None:
        return err("This link is invalid or has expired. Ask for a new one.", 400)
    return {"username": username}


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
    out = await run_in_threadpool(_reset_password, token, new)
    if out is None:
        return err("This reset link is invalid or has expired.", 400)
    user, session = out
    log.info("%s user=%s", "welcome" if session else "reset-password", user["username"])
    if session is None:
        return {"ok": True}
    response = JSONResponse({"ok": True, "user": public_user(user)})
    set_session_cookie(response, session)
    return response


def delete_user_rows(conn, uid: int):
    """Remove an account and everything stored for it. The caller commits."""
    # child rows first: foreign keys are enforced on this connection.
    conn.execute("DELETE FROM state WHERE user_id = ?", (uid,))
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
    conn.execute("DELETE FROM password_resets WHERE user_id = ?", (uid,))
    conn.execute("DELETE FROM users WHERE id = ?", (uid,))


def _delete_account(token, password: str):
    with db() as conn:
        user = current_user(token, conn)
        if user is None:
            return "unauthorized"
        if not verify_password(user, password):
            return "wrong-password"
        delete_user_rows(conn, user["id"])
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

# ---------------------------------------------------------------- admin
#
# Admins are ordinary accounts with users.is_admin = 1. Only the command line
# on the server grants or removes it (`make admin NAME=...` runs
# `python app.py admin add NAME`). Nothing reachable over HTTP can make an
# admin, so a stolen admin session can't mint more of them. Every admin
# endpoint checks the flag on each request, and every change an admin makes
# is written to admin_log as well as the app log.


class AdminError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def _as_admin(token, fn, *args):
    with db() as conn:
        admin = current_user(token, conn)
        if admin is None:
            raise AdminError("not signed in", 401)
        if not admin["is_admin"]:
            raise AdminError("Admins only.", 403)
        return fn(conn, admin, *args)


async def admin_call(request: Request, fn, *args):
    """fn(conn, admin_row, *args) in the thread pool, for a signed-in admin
    only. AdminError becomes the matching JSON error response."""
    try:
        return await run_in_threadpool(_as_admin, session_token(request), fn, *args)
    except AdminError as e:
        return err(e.message, e.status)


def audit(conn, admin_name: str, action: str, target: str | None = None, detail: str | None = None):
    """Record an admin's change. The caller commits (with the change itself)."""
    conn.execute(
        "INSERT INTO admin_log (ts, admin, action, target, detail) VALUES (?, ?, ?, ?, ?)",
        (time.time(), admin_name, action, target, detail),
    )
    log.info("admin user=%s action=%s target=%s", admin_name, action, target)


def learner_progress(data_json) -> dict:
    """What a learner has done, read from their synced state blob: the
    browser's localStorage keys (js/progress.js, js/xp.js). Anything
    malformed counts as nothing."""
    def obj(raw):
        try:
            value = json.loads(raw) if isinstance(raw, str) else raw
        except (json.JSONDecodeError, TypeError, ValueError, RecursionError):
            return {}
        return value if isinstance(value, dict) else {}

    blob = current_keys(obj(data_json))
    progress = obj(blob.get(STORE_PREFIX + "progress:v1"))
    awards = obj(obj(blob.get(XP_KEY)).get("awards"))
    streak = obj(progress.get("streak"))

    def when(v):  # completion time in ms; very old progress stored `true`
        return v if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None

    def ids(prefix):
        return sorted(k[len(prefix):] for k in awards if k.startswith(prefix))

    return {
        "done": {k: when(v) for k, v in obj(progress.get("done")).items() if v},
        "quiz": {
            k: {"score": v.get("score"), "total": v.get("total")}
            for k, v in obj(progress.get("quiz")).items() if isinstance(v, dict)
        },
        "streak": {"count": streak.get("count") if isinstance(streak.get("count"), int) else 0,
                   "last": streak.get("last") if isinstance(streak.get("last"), str) else None},
        "labs": ids("lab:"),
        "missions": ids("mission:"),
        "exercises": sum(1 for k in awards if k.startswith("ex:")),
    }


def week_xp(row, wk: str) -> int:
    return (row["xp_total"] - row["xp_week_start"]) if row["week_id"] == wk else 0


def find_learner(conn, username: str):
    row = conn.execute(
        "SELECT u.*, s.updated AS last_active, s.data AS data FROM users u "
        "LEFT JOIN state s ON s.user_id = u.id WHERE u.username = ? COLLATE NOCASE",
        (username,),
    ).fetchone()
    if row is None:
        raise AdminError("No such learner.", 404)
    return row


def learner_summary(row, wk: str) -> dict:
    return {
        "username": row["username"],
        "email": row["email"],
        "created": row["created"],
        "lastActive": row["last_active"],
        "xp": row["xp_total"],
        "weekXp": week_xp(row, wk),
        "optIn": bool(row["leaderboard_opt_in"]),
        "admin": bool(row["is_admin"]),
        "invited": row["pass_hash"] == INVITED,    # hasn't chosen a password yet
    }


# --- statistics

def _overview(conn, _admin):
    now = time.time()
    day = 86400
    one = lambda sql, *args: conn.execute(sql, args).fetchone()[0]  # noqa: E731
    days = [time.strftime("%Y-%m-%d", time.gmtime(now - (29 - i) * day)) for i in range(30)]
    signups = dict(conn.execute(
        "SELECT date(created, 'unixepoch'), COUNT(*) FROM users WHERE created >= ? GROUP BY 1",
        (now - 30 * day,),
    ).fetchall())

    # Progress lives in each learner's blob, so add them up. Lesson ids start
    # with their track's id ("web-2-4"), which is how completions map to tracks.
    lessons, labs, missions, completions = Counter(), Counter(), Counter(), Counter()
    starters, track_done = Counter(), Counter()
    with_progress = 0
    for row in conn.execute("SELECT data FROM state"):
        p = learner_progress(row["data"])
        if p["done"]:
            with_progress += 1
        lessons.update(p["done"].keys())
        labs.update(p["labs"])
        missions.update(p["missions"])
        tracks = Counter(lid.split("-", 1)[0] for lid in p["done"])
        starters.update(tracks.keys())
        track_done.update(tracks)
        for ms in p["done"].values():
            if ms and ms / 1000 >= now - 30 * day:
                completions[time.strftime("%Y-%m-%d", time.gmtime(ms / 1000))] += 1

    return {
        "learners": one("SELECT COUNT(*) FROM users"),
        "invited": one("SELECT COUNT(*) FROM users WHERE pass_hash = ?", INVITED),
        "admins": one("SELECT COUNT(*) FROM users WHERE is_admin = 1"),
        "new7": one("SELECT COUNT(*) FROM users WHERE created >= ?", now - 7 * day),
        "new30": one("SELECT COUNT(*) FROM users WHERE created >= ?", now - 30 * day),
        "active7": one("SELECT COUNT(*) FROM state WHERE updated >= ?", now - 7 * day),
        "active30": one("SELECT COUNT(*) FROM state WHERE updated >= ?", now - 30 * day),
        "optedIn": one("SELECT COUNT(*) FROM users WHERE leaderboard_opt_in = 1"),
        "xpTotal": one("SELECT COALESCE(SUM(xp_total), 0) FROM users"),
        "withProgress": with_progress,
        "days": days,
        "signups": [signups.get(d, 0) for d in days],
        "completions": [completions.get(d, 0) for d in days],
        "lessons": dict(lessons),
        "tracks": {t: {"starters": starters[t], "completions": track_done[t]} for t in starters},
        "labs": dict(labs),
        "missions": dict(missions),
    }


@app.get("/api/admin/overview")
async def api_admin_overview(request: Request):
    return await admin_call(request, _overview)


# --- learners

# ORDER BY clauses by name. The request picks a key; its text never reaches SQL.
LEARNER_SORTS = {
    "created": "u.created DESC",
    "active": "COALESCE(s.updated, 0) DESC, u.created DESC",
    "xp": "u.xp_total DESC, u.username COLLATE NOCASE",
    "name": "u.username COLLATE NOCASE",
}
LEARNERS_PAGE = 50


def like_pattern(text: str) -> str:
    """`text` as a literal substring for LIKE ... ESCAPE '\\': its own % and _
    match only themselves."""
    return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _learners(conn, _admin, query: str, sort: str, offset: int):
    where, args = "", []
    if query:
        where = "WHERE u.username LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\'"
        args = [like_pattern(query)] * 2
    total = conn.execute(f"SELECT COUNT(*) FROM users u {where}", args).fetchone()[0]
    rows = conn.execute(
        "SELECT u.*, s.updated AS last_active, s.data AS data FROM users u "
        f"LEFT JOIN state s ON s.user_id = u.id {where} "
        f"ORDER BY {LEARNER_SORTS[sort]} LIMIT ? OFFSET ?",
        [*args, LEARNERS_PAGE, offset],
    ).fetchall()
    wk = current_week_id()
    learners = []
    for row in rows:
        p = learner_progress(row["data"])
        learners.append({**learner_summary(row, wk), "lessons": len(p["done"])})
    return {"total": total, "offset": offset, "pageSize": LEARNERS_PAGE, "learners": learners}


@app.get("/api/admin/users")
async def api_admin_users(request: Request):
    params = request.query_params
    query = params.get("q", "").strip()[:100]
    sort = params.get("sort", "created")
    if sort not in LEARNER_SORTS:
        sort = "created"
    offset = params.get("offset", "0")
    offset = int(offset) if offset.isdigit() else 0
    return await admin_call(request, _learners, query, sort, offset)


def _learner(conn, _admin, username: str):
    row = find_learner(conn, username)
    sessions, last_sign_in = conn.execute(
        "SELECT COUNT(*), MAX(created) FROM sessions WHERE user_id = ? AND created >= ?",
        (row["id"], time.time() - SESSION_TTL),
    ).fetchone()
    return {
        "learner": {**learner_summary(row, current_week_id()), "sessions": sessions, "lastSignIn": last_sign_in},
        "progress": learner_progress(row["data"]),
    }


@app.get("/api/admin/users/{username}")
async def api_admin_user(request: Request, username: str):
    return await admin_call(request, _learner, username)


def _learner_reset_link(conn, admin, username: str):
    """A reset link, or for a student who hasn't accepted the invitation yet,
    a new invitation."""
    row = find_learner(conn, username)
    invited = row["pass_hash"] == INVITED
    link = new_reset_link(conn, row["id"], welcome=invited)
    audit(conn, admin["username"], "invite" if invited else "reset-link", row["username"])
    conn.commit()
    return row["email"], link, row["username"], invited


@app.post("/api/admin/users/{username}/reset-link")
async def api_admin_reset_link(request: Request, username: str):
    out = await admin_call(request, _learner_reset_link, username)
    if isinstance(out, JSONResponse):
        return out
    email, link, username, invited = out
    if not email_configured():
        # Nothing can send it, so the admin passes it on. With email set up,
        # the link goes only to the learner: an admin can't take an account.
        return {"sent": False, "link": link, "invite": invited}
    subject, text = invitation_email(username, link) if invited else (
        "Set a new 1991 Academy password",
        "An administrator of 1991 Academy sent you a link to set a new password.\n\n"
        f"Set a new password (link valid for 1 hour):\n{link}\n\n"
        "If you didn't ask for this, ignore this email — your password is unchanged.",
    )
    return JSONResponse({"sent": True, "email": email, "invite": invited},
                        background=BackgroundTask(send_email, email, subject, text))


MAX_INVITES = 200   # per request


def username_from(conn, email: str) -> str:
    """A free username made from an email address: anna.k@x.am -> anna_k."""
    base = re.sub(r"[^A-Za-z0-9_]", "_", email.split("@")[0])[:16].strip("_") or "student"
    base = base if len(base) >= 3 else (base + "___")[:3]
    name, n = base, 1
    while conn.execute("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (name,)).fetchone():
        n += 1
        name = f"{base}{n}"
    return name


def _invite(conn, admin, students: list):
    results = []
    for s in students:
        email = s["email"]
        try:
            username = s["username"] or username_from(conn, email)
            uid = create_account(conn, username, email)
        except Invalid as e:
            results.append({"email": email, "username": s["username"], "error": str(e)})
            continue
        link = new_reset_link(conn, uid, welcome=True)
        audit(conn, admin["username"], "invite", username)
        results.append({"email": email, "username": username, "link": link})
    conn.commit()
    return results


def send_invitations(invited: list):
    """[(email, username, link)], one email each."""
    for email, username, link in invited:
        send_email(email, *invitation_email(username, link))


@app.post("/api/admin/invites")
async def api_admin_invites(request: Request):
    """Accounts for new students, each with a week-long link to choose a
    password: emailed when email is set up, otherwise returned for the admin
    to hand out."""
    body = await json_body(request)
    raw = body.get("students") if body else None
    if not isinstance(raw, list) or not raw:
        return err("invalid request body")
    if len(raw) > MAX_INVITES:
        return err(f"At most {MAX_INVITES} students at a time.")
    students = []
    for item in raw:
        if not isinstance(item, dict):
            return err("invalid request body")
        students.append({
            "email": str(item.get("email", "")).strip().lower(),
            "username": str(item.get("username") or "").strip(),
        })
    results = await admin_call(request, _invite, students)
    if isinstance(results, JSONResponse):
        return results
    # (a copy: the links come out of the admin's answer below)
    invited = [(r["email"], r["username"], r["link"]) for r in results if "link" in r]
    if not email_configured():
        return {"sent": False, "results": results}
    # sent only to the students: the admin doesn't see the links
    for r in results:
        r.pop("link", None)
    return JSONResponse({"sent": True, "results": results},
                        background=BackgroundTask(send_invitations, invited))


def _learner_sign_out(conn, admin, username: str):
    row = find_learner(conn, username)
    if row["id"] == admin["id"]:
        raise AdminError("That's you: sign out from your account page instead.")
    n = conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],)).rowcount
    audit(conn, admin["username"], "sign-out", row["username"], f"{n} session(s)")
    conn.commit()
    return {"ok": True, "sessions": n}


@app.post("/api/admin/users/{username}/sign-out")
async def api_admin_sign_out(request: Request, username: str):
    return await admin_call(request, _learner_sign_out, username)


def _learner_delete(conn, admin, username: str):
    row = find_learner(conn, username)
    if row["is_admin"]:
        raise AdminError("Admin accounts can't be deleted here. Remove the admin rights on the server first.", 409)
    delete_user_rows(conn, row["id"])
    audit(conn, admin["username"], "delete-account", row["username"])
    conn.commit()
    return {"ok": True}


@app.post("/api/admin/users/{username}/delete")
async def api_admin_delete(request: Request, username: str):
    return await admin_call(request, _learner_delete, username)


# --- lessons

LESSON_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)+$")   # web-2-4: track, then the rest
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

# The HTML a lesson may contain: what the built-in lessons use, plus a few
# harmless extras. Everything else (scripts, styles, event handlers, iframes,
# javascript: links) is removed when the lesson is saved, so even a stolen
# admin account can't put code on the pages learners read.
LESSON_TAGS = {
    "p", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i", "u", "code", "pre",
    "div", "span", "br", "hr", "blockquote", "a", "sub", "sup", "kbd",
    "table", "thead", "tbody", "tr", "th", "td",
}


def clean_html(html: str) -> str:
    return nh3.clean(
        html,
        tags=LESSON_TAGS,
        attributes={"a": {"href", "title"}},
        allowed_classes={"div": {"callout"}},
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
    )


def _text(obj: dict, key: str, limit: int, label: str, required: bool = False) -> str:
    value = obj.get(key, "")
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise Invalid(f"{label} must be text.")
    value = value.strip()
    if required and not value:
        raise Invalid(f"{label} is required.")
    if len(value) > limit:
        raise Invalid(f"{label} is too long (at most {limit} characters).")
    return value


def _list(obj: dict, key: str, limit: int, label: str) -> list:
    value = obj.get(key) or []
    if not isinstance(value, list):
        raise Invalid(f"{label} must be a list.")
    if len(value) > limit:
        raise Invalid(f"At most {limit} {label}.")
    return value


def _takeaways(obj: dict, key: str, label: str) -> list:
    out = []
    for item in _list(obj, key, 12, label):
        if not isinstance(item, str) or len(item) > 500:
            raise Invalid(f"Each of the {label} is a line of at most 500 characters.")
        item = clean_html(item.strip())
        if item:
            out.append(item)
    return out


def _question(q, n: int) -> dict:
    if not isinstance(q, dict):
        raise Invalid(f"Quiz question {n} is malformed.")
    label = f"Question {n}"
    options = q.get("options")
    if (not isinstance(options, list) or not 2 <= len(options) <= 6
            or not all(isinstance(o, str) and o.strip() and len(o) <= 300 for o in options)):
        raise Invalid(f"{label}: give 2 to 6 answer options, none empty.")
    options_hy = q.get("options_hy") or []
    if options_hy and (not isinstance(options_hy, list) or len(options_hy) != len(options)
                       or not all(isinstance(o, str) and o.strip() and len(o) <= 300 for o in options_hy)):
        raise Invalid(f"{label}: translate every answer option into Armenian, or none of them.")
    answer = q.get("answer")
    if isinstance(answer, bool) or not isinstance(answer, int) or not 0 <= answer < len(options):
        raise Invalid(f"{label}: mark the correct answer.")
    out = {
        "q": _text(q, "q", 500, label, required=True),
        "options": [o.strip() for o in options],
        "answer": answer,
        "explain": _text(q, "explain", 1000, f"{label}'s explanation"),
        "q_hy": _text(q, "q_hy", 500, f"{label} (Armenian)"),
        "explain_hy": _text(q, "explain_hy", 1000, f"{label}'s explanation (Armenian)"),
    }
    if options_hy:
        out["options_hy"] = [o.strip() for o in options_hy]
    return out


def _video(v, n: int) -> dict:
    if not isinstance(v, dict) or not isinstance(v.get("id"), str) or not YOUTUBE_ID_RE.match(v["id"]):
        raise Invalid(f"Video {n}: paste a YouTube link (or its 11-character video id).")
    return {
        "id": v["id"],
        "title": _text(v, "title", 200, f"Video {n}'s title", required=True),
        "channel": _text(v, "channel", 100, f"Video {n}'s channel"),
        "length": _text(v, "length", 20, f"Video {n}'s length"),
    }


def parse_lesson(lesson_id: str, body: dict) -> dict:
    """A lesson from the admin panel, checked and with its HTML sanitized."""
    if len(lesson_id) > 40 or not LESSON_ID_RE.match(lesson_id):
        raise Invalid("Lesson id: lowercase letters, digits and dashes, like web-2-4.")
    track, module, after = body.get("track"), body.get("module"), body.get("after") or None
    for value, label in ((track, "track"), (module, "module")):
        if not isinstance(value, str) or len(value) > 40 or not SLUG_RE.match(value):
            raise Invalid(f"Unknown {label}.")
    if not lesson_id.startswith(track + "-"):
        raise Invalid(f"Lesson ids in this track start with {track}-.")
    if after is not None and (not isinstance(after, str) or len(after) > 40 or not LESSON_ID_RE.match(after)):
        raise Invalid("Unknown position.")
    minutes = body.get("minutes")
    if isinstance(minutes, bool) or not isinstance(minutes, int) or not 1 <= minutes <= 600:
        raise Invalid("Reading time: a whole number of minutes, 1 to 600.")
    content = clean_html(_text(body, "content", 100_000, "Content", required=True))
    if not content.strip():
        raise Invalid("Content is empty once unsupported HTML is removed.")
    data = {
        "title": _text(body, "title", 200, "Title", required=True),
        "title_hy": _text(body, "title_hy", 200, "Title (Armenian)"),
        "minutes": minutes,
        "content": content,
        "content_hy": clean_html(_text(body, "content_hy", 100_000, "Content (Armenian)")),
        "takeaways": _takeaways(body, "takeaways", "takeaways"),
        "takeaways_hy": _takeaways(body, "takeaways_hy", "Armenian takeaways"),
        "quiz": [_question(q, i + 1) for i, q in enumerate(_list(body, "quiz", 20, "quiz questions"))],
        "videos": [_video(v, i + 1) for i, v in enumerate(_list(body, "videos", 10, "videos"))],
    }
    return {"track": track, "module": module, "after": after,
            "published": bool(body.get("published")), "data": data}


def lesson_out(row) -> dict:
    return {
        "id": row["id"], "track": row["track"], "module": row["module"], "after": row["after"],
        "published": bool(row["published"]), "created": row["created"], "updated": row["updated"],
        "updatedBy": row["updated_by"], "data": json.loads(row["data"]),
    }


def _lessons(conn, _admin):
    return {"lessons": [lesson_out(r) for r in conn.execute("SELECT * FROM lessons ORDER BY created")]}


@app.get("/api/admin/lessons")
async def api_admin_lessons(request: Request):
    return await admin_call(request, _lessons)


def _lesson_save(conn, admin, lesson_id: str, rec: dict):
    now = time.time()
    existed = conn.execute("SELECT 1 FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
    conn.execute(
        "INSERT INTO lessons (id, track, module, after, data, published, created, updated, updated_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
        "track = excluded.track, module = excluded.module, after = excluded.after, data = excluded.data, "
        "published = excluded.published, updated = excluded.updated, updated_by = excluded.updated_by",
        (lesson_id, rec["track"], rec["module"], rec["after"], json.dumps(rec["data"]),
         int(rec["published"]), now, now, admin["username"]),
    )
    audit(conn, admin["username"], "lesson-update" if existed else "lesson-create", lesson_id,
          "published" if rec["published"] else "draft")
    conn.commit()
    return {"lesson": lesson_out(conn.execute("SELECT * FROM lessons WHERE id = ?", (lesson_id,)).fetchone())}


@app.put("/api/admin/lessons/{lesson_id}")
async def api_admin_lesson_save(request: Request, lesson_id: str):
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    try:
        rec = parse_lesson(lesson_id, body)
    except Invalid as e:
        return err(str(e))
    return await admin_call(request, _lesson_save, lesson_id, rec)


def _lesson_preview(_conn, _admin, rec: dict):
    return {"data": rec["data"]}


@app.post("/api/admin/lessons/{lesson_id}/preview")
async def api_admin_lesson_preview(request: Request, lesson_id: str):
    """The lesson exactly as saving it would store it (checked and sanitized),
    without saving anything."""
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    try:
        rec = parse_lesson(lesson_id, body)
    except Invalid as e:
        return err(str(e))
    return await admin_call(request, _lesson_preview, rec)


def _lesson_delete(conn, admin, lesson_id: str):
    if conn.execute("DELETE FROM lessons WHERE id = ?", (lesson_id,)).rowcount == 0:
        raise AdminError("No such lesson.", 404)
    audit(conn, admin["username"], "lesson-delete", lesson_id)
    conn.commit()
    return {"ok": True}


@app.delete("/api/admin/lessons/{lesson_id}")
async def api_admin_lesson_delete(request: Request, lesson_id: str):
    return await admin_call(request, _lesson_delete, lesson_id)


# --- announcements

def parse_announcement(body: dict) -> dict:
    level = body.get("level", "info")
    if level not in ("info", "warning"):
        raise Invalid("Unknown kind of announcement.")
    return {
        "text": _text(body, "text", 300, "The announcement", required=True),
        "text_hy": _text(body, "text_hy", 300, "The Armenian announcement"),
        "level": level,
        "active": bool(body.get("active", True)),
    }


def announcement_out(row) -> dict:
    return {"id": row["id"], "text": row["text"], "text_hy": row["text_hy"], "level": row["level"],
            "active": bool(row["active"]), "created": row["created"], "createdBy": row["created_by"]}


def _announcements(conn, _admin):
    rows = conn.execute("SELECT * FROM announcements ORDER BY created DESC")
    return {"announcements": [announcement_out(r) for r in rows]}


@app.get("/api/admin/announcements")
async def api_admin_announcements(request: Request):
    return await admin_call(request, _announcements)


def _announcement_create(conn, admin, rec: dict):
    cur = conn.execute(
        "INSERT INTO announcements (text, text_hy, level, active, created, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        (rec["text"], rec["text_hy"], rec["level"], int(rec["active"]), time.time(), admin["username"]),
    )
    audit(conn, admin["username"], "announcement-create", str(cur.lastrowid), rec["text"][:80])
    conn.commit()
    return {"announcement": announcement_out(
        conn.execute("SELECT * FROM announcements WHERE id = ?", (cur.lastrowid,)).fetchone())}


def _announcement_update(conn, admin, aid: int, rec: dict):
    if conn.execute(
        "UPDATE announcements SET text = ?, text_hy = ?, level = ?, active = ? WHERE id = ?",
        (rec["text"], rec["text_hy"], rec["level"], int(rec["active"]), aid),
    ).rowcount == 0:
        raise AdminError("No such announcement.", 404)
    audit(conn, admin["username"], "announcement-update", str(aid), "shown" if rec["active"] else "hidden")
    conn.commit()
    return {"announcement": announcement_out(
        conn.execute("SELECT * FROM announcements WHERE id = ?", (aid,)).fetchone())}


def _announcement_delete(conn, admin, aid: int):
    if conn.execute("DELETE FROM announcements WHERE id = ?", (aid,)).rowcount == 0:
        raise AdminError("No such announcement.", 404)
    audit(conn, admin["username"], "announcement-delete", str(aid))
    conn.commit()
    return {"ok": True}


async def announcement_body(request: Request):
    body = await json_body(request)
    if body is None:
        return None, err("invalid request body")
    try:
        return parse_announcement(body), None
    except Invalid as e:
        return None, err(str(e))


@app.post("/api/admin/announcements")
async def api_admin_announcement_create(request: Request):
    rec, problem = await announcement_body(request)
    return problem or await admin_call(request, _announcement_create, rec)


@app.put("/api/admin/announcements/{aid}")
async def api_admin_announcement_update(request: Request, aid: int):
    rec, problem = await announcement_body(request)
    return problem or await admin_call(request, _announcement_update, aid, rec)


@app.delete("/api/admin/announcements/{aid}")
async def api_admin_announcement_delete(request: Request, aid: int):
    return await admin_call(request, _announcement_delete, aid)


# --- activity log

def _admin_log(conn, _admin):
    rows = conn.execute("SELECT * FROM admin_log ORDER BY ts DESC, id DESC LIMIT 200")
    return {"entries": [{"ts": r["ts"], "admin": r["admin"], "action": r["action"],
                         "target": r["target"], "detail": r["detail"]} for r in rows]}


@app.get("/api/admin/log")
async def api_admin_log(request: Request):
    return await admin_call(request, _admin_log)


# --- lesson videos hosted here

def hosted_media() -> dict:
    """The lesson videos in MEDIA_DIR, by YouTube id:
    {id: {"video": "/media/<id>.mp4", "poster": "/media/<id>.jpg" or None}}.
    The pages play these instead of the YouTube embed."""
    try:
        names = sorted(os.listdir(MEDIA_DIR))
    except OSError:
        return {}
    files = {}
    for name in names:
        m = YOUTUBE_FILE_RE.match(name)
        if m and (MEDIA_DIR / name).is_file():
            files.setdefault(m.group(1), {})[m.group(2)] = "/media/" + name
    return {
        vid: {"video": kinds.get("mp4") or kinds["webm"], "poster": kinds.get("jpg")}
        for vid, kinds in files.items() if "mp4" in kinds or "webm" in kinds
    }


def _admin_media(_conn, _admin):
    media = hosted_media()
    sizes = {}
    for vid, f in media.items():
        try:
            sizes[vid] = (MEDIA_DIR / f["video"].rsplit("/", 1)[1]).stat().st_size
        except OSError:
            sizes[vid] = None
    return {"media": media, "sizes": sizes}


@app.get("/api/admin/media")
async def api_admin_media(request: Request):
    return await admin_call(request, _admin_media)


# --- what every page loads: published lessons, active announcements, hosted videos

def _public_content(signed_in: bool):
    if not signed_in:          # the sign-in page: just the announcements
        with db() as conn:
            rows = conn.execute("SELECT * FROM announcements WHERE active = 1 ORDER BY created DESC")
            return {"lessons": [], "media": {}, "announcements": [
                {"id": r["id"], "text": r["text"], "text_hy": r["text_hy"], "level": r["level"]} for r in rows]}
    with db() as conn:
        lessons = [
            {"id": r["id"], "track": r["track"], "module": r["module"], "after": r["after"],
             "data": json.loads(r["data"])}
            for r in conn.execute("SELECT * FROM lessons WHERE published = 1 ORDER BY created")
        ]
        announcements = [
            {"id": r["id"], "text": r["text"], "text_hy": r["text_hy"], "level": r["level"]}
            for r in conn.execute("SELECT * FROM announcements WHERE active = 1 ORDER BY created DESC")
        ]
    return {"lessons": lessons, "announcements": announcements, "media": hosted_media()}


@app.get("/api/content.js")
async def api_content_js(request: Request):
    """A script, so pages get it before they render (js/custom-content.js
    applies it). json.dumps escapes every non-ASCII character and quote, so
    the data can only ever be a JavaScript value. Lessons and videos only for
    a signed-in student; the sign-in page gets the announcements."""
    signed_in = await run_in_threadpool(session_valid, session_token(request))
    content = await run_in_threadpool(_public_content, signed_in)
    return Response(
        "window.ACADEMY_CUSTOM = " + json.dumps(content, separators=(",", ":")) + ";\n",
        media_type="application/javascript",
    )


# ------------------------------------------------------- command line (admins)


def email_test(to: str) -> int:
    """`make email-test TO=…`: send one email now and say exactly what failed."""
    if not email_configured():
        print("Email isn't set up: fill in ACADEMY_SMTP_HOST, _USER and _PASS in .env, then make restart.",
              file=sys.stderr)
        return 1
    print(f"Sending a test email from {SMTP_FROM} to {to} through {SMTP_HOST}:{SMTP_PORT} ...")
    try:
        deliver(to, "1991 Academy: test email",
                "This is a test from 1991 Academy. Email works: invitations and password resets\n"
                "will be sent from this address.")
    except ssl.SSLCertVerificationError as e:
        print(f"FAILED: the mail server's certificate isn't trusted ({getattr(e, 'verify_message', None) or e}). Ask the mail "
              "administrator for the right server name, or for a certificate from a public authority.",
              file=sys.stderr)
        return 1
    except smtplib.SMTPAuthenticationError:
        print("FAILED: the mail server refused the user name or password.", file=sys.stderr)
        return 1
    except (OSError, smtplib.SMTPException) as e:
        print(f"FAILED: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    print("Sent. Check that it arrived (and isn't in spam).")
    return 0


def cli(args: list) -> int:
    """python app.py admin add NAME [EMAIL] | admin remove NAME | admin list

    With EMAIL, a NAME that has no account yet gets one (an invitation): how
    the first admin starts, since there is no sign-up."""
    usage = ("usage: python app.py admin add NAME [EMAIL] | admin remove NAME | admin list\n"
             "       python app.py email-test ADDRESS")
    if args[:1] == ["email-test"] and len(args) == 2:
        return email_test(args[1])
    if args[:1] != ["admin"] or len(args) < 2:
        print(usage, file=sys.stderr)
        return 2
    init_db()
    with db() as conn:
        if args[1:] == ["list"]:
            rows = conn.execute(
                "SELECT username, email FROM users WHERE is_admin = 1 ORDER BY username COLLATE NOCASE"
            ).fetchall()
            for r in rows:
                print(f"{r['username']}  <{r['email']}>")
            if not rows:
                print("No admins yet. Make one with: make admin NAME=<username>")
            return 0
        if not (len(args) == 3 or (len(args) == 4 and args[1] == "add")) or args[1] not in ("add", "remove"):
            print(usage, file=sys.stderr)
            return 2
        row = conn.execute(
            "SELECT id, username FROM users WHERE username = ? COLLATE NOCASE", (args[2],)
        ).fetchone()
        welcome = None
        if row is None and len(args) == 4:
            try:
                uid = create_account(conn, args[2], args[3].strip().lower())
            except Invalid as e:
                print(e, file=sys.stderr)
                return 1
            welcome = new_reset_link(conn, uid, welcome=True)
            row = conn.execute("SELECT id, username FROM users WHERE id = ?", (uid,)).fetchone()
        if row is None:
            print(f"No account named {args[2]!r}. To create it, give an email too: "
                  f"make admin NAME={args[2]} EMAIL=...", file=sys.stderr)
            return 1
        add = args[1] == "add"
        conn.execute("UPDATE users SET is_admin = ? WHERE id = ?", (int(add), row["id"]))
        audit(conn, "(server)", "admin-add" if add else "admin-remove", row["username"])
        conn.commit()
    print(f"{row['username']} is {'now an admin: sign in and open /admin.html' if add else 'no longer an admin'}.")
    if welcome:
        print(f"The account is new: open this link to choose its password (valid for 7 days):\n{welcome}")
    return 0


# ---------------------------------------------------------------- health


@app.get("/api/auth-check")
async def api_auth_check(request: Request):
    """Caddy asks this (forward_auth) before serving a video itself."""
    if await run_in_threadpool(session_valid, session_token(request)):
        return Response(status_code=204)
    return err("Sign in first.", 401)


@app.get("/api/health")
async def api_health():
    return {
        "ok": True,
        "uptime_s": int(time.time() - STARTED_AT),
        "debug": DEBUG,
        "email": email_configured(),
        "secure_cookies": SECURE_COOKIES,
        "trust_proxy": TRUST_PROXY,
        "week": current_week_id(),
        "version": VERSION,
        "revision": REVISION,
    }

# Lesson videos. On a server with Caddy, Caddy serves /media itself (faster);
# this covers your own computer and an external web server. StaticFiles
# answers byte-range requests, so the player can seek.
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR), check_dir=False), name="media")

# static site LAST so /api/* wins (the guard middleware has already restricted
# which paths can reach it)
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="site")


if __name__ == "__main__":
    if len(sys.argv) > 1:   # python app.py admin ... (see cli)
        sys.exit(cli(sys.argv[1:]))
    log.info("1991 Academy backend on http://localhost:%d  [debug=%s, secure_cookies=%s, trust_proxy=%s, rev=%s]",
             PORT, DEBUG, SECURE_COOKIES, TRUST_PROXY, (REVISION or "dev")[:7])
    # server_header=False: no "server: uvicorn" banner for scanners to match on
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning", server_header=False)
