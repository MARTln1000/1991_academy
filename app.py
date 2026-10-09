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
    POST /api/first-password      {identifier, password, newPassword}  (temporary -> own password)
    POST /api/join/check          {token}   is this invitation link still good?
    POST /api/join                {token, email, username?} -> {username, password, days}
    POST /api/logout
    GET  /api/me
    GET  /api/state               -> {"data": {...}|null, "updated": ts|null}
    PUT  /api/state               {"data": {...}}   (also snapshots XP)
    GET  /api/leaderboard[?period=week|all] -> {"top": [{username, xp}...], "you": rank|null, "period"}
    POST /api/leaderboard-optin   {"optIn": bool}
    POST /api/change-password     {currentPassword, newPassword}
    POST /api/delete-account      {password}
    GET  /api/health
    GET  /api/auth-check          204 when signed in, else 401 (Caddy asks it before serving videos)
    GET  /api/content.js          lessons and announcements added in the admin panel,
                                  and the lesson videos hosted here (ACADEMY_MEDIA)

There is no open sign-up, and the site sends no email. An admin either adds
students (each gets a temporary password, shown to the admin once) or makes
invitation links and sends them from their own mailbox: whoever opens a link
types the email they want and gets a temporary password, once, within 7 days.
A temporary password works for 14 days and only to choose one's own. The
first admin is made on the server: `python app.py admin add NAME EMAIL`;
`python app.py password NAME` gives any account a new temporary password.

Admin (accounts with users.is_admin; `python app.py admin add NAME` grants it):
    GET  /api/admin/overview      site statistics
    POST /api/admin/students      {students: [{email, username?}]} -> accounts + temporary passwords
    GET  /api/admin/join-links    POST /api/admin/join-links {sentTo: [...]}  POST .../ID/cancel
    GET  /api/admin/users[?q=&sort=created|active|xp|name&offset=]
    GET  /api/admin/users/NAME    one learner, with their progress
    POST /api/admin/users/NAME/temp-password | sign-out | delete
    GET  /api/admin/lessons       PUT|DELETE /api/admin/lessons/ID   POST .../ID/preview
    GET  /api/admin/announcements POST /api/admin/announcements  PUT|DELETE .../ID
    GET  /api/admin/log           what admins changed
    GET  /api/admin/media         which lesson videos are hosted here

ACADEMY_BASE_URL: the site's address, which admins send to new students.
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
import sqlite3
import sys
import time
from collections import Counter, defaultdict, deque
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from urllib.parse import quote

import nh3
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
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
TEMP_PASSWORD_TTL = 14 * 86400   # a temporary password works for 14 days, once
JOIN_LINK_TTL = 7 * 86400         # an invitation link works for 7 days, once
JOIN_LINKS_KEPT = 30 * 86400      # the panel lists links this long after they expire
# pass_hash of an account that has no usable password (created before
# temporary passwords existed): nothing matches it.
NO_PASSWORD = "!"
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

# The site sends no email at all: admins send each new student, from their own
# mailbox, the site's address, a username and a temporary password (the admin
# panel writes that message). BASE_URL is the address in it, e.g.
# https://academy.example.com (docker-compose.yml sets it from DOMAIN).
BASE_URL = os.environ.get("ACADEMY_BASE_URL", f"http://localhost:{PORT}").rstrip("/")

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
# No whitespace, control characters, or characters that mean something in HTML
# or in a mail header: an address can never carry markup onto a page.
_EMAIL_CHAR = r"[^@\s\x00-\x1f\x7f<>\"'`()\[\]\\,;:]"
EMAIL_RE = re.compile(rf"^{_EMAIL_CHAR}+@{_EMAIL_CHAR}+\.{_EMAIL_CHAR}+$")
MAX_EMAIL = 254                   # the longest valid email address
DISPOSABLE_FILE = ROOT / "disposable_email_domains.txt"

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
            -- Invitation links an admin sends from their own mailbox. Whoever
            -- opens one types the email they want and gets an account, once.
            -- Only the token's hash is stored. `sent_to` is the admin's own
            -- note of who got the link; `used_by` the username it made.
            CREATE TABLE IF NOT EXISTS join_links (
                id INTEGER PRIMARY KEY,
                token_hash TEXT UNIQUE NOT NULL,
                sent_to TEXT NOT NULL DEFAULT '',
                created REAL NOT NULL,
                created_by TEXT NOT NULL,
                expires REAL NOT NULL,
                used REAL,
                used_by TEXT,
                cancelled REAL
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
        if "must_change_password" not in cols:
            # a temporary password (from an admin) works once, until it expires,
            # and only to choose the account's own password
            conn.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0")
            conn.execute("ALTER TABLE users ADD COLUMN temp_password_expires REAL")
            log.info("migration: added users.must_change_password / temp_password_expires")
        # accounts made before temporary passwords never got a usable
        # password: they wait for a temporary one from an admin
        conn.execute("UPDATE users SET must_change_password = 1 WHERE pass_hash = ? AND must_change_password = 0",
                     (NO_PASSWORD,))
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
        resets += conn.execute(
            "DELETE FROM join_links WHERE expires < ?", (now - JOIN_LINKS_KEPT,)
        ).rowcount
        conn.commit()
    if sessions or resets:
        log.info("sweep: removed %d expired session(s), %d reset token(s)", sessions, resets)
    return sessions, resets


def hash_password(password: str, salt: bytes) -> str:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1).hex()


def verify_password(row, password: str) -> bool:
    """Constant-time check of a plaintext password against a user row."""
    if row["pass_hash"] == NO_PASSWORD:  # no usable password: nothing matches
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


def _recent(key: str, window_s: int):
    """The timestamps under `key` within the window (a sliding window)."""
    now = time.time()
    # The dict grew one entry per distinct key forever; drop idle ones when it
    # gets large rather than letting a long-lived process leak them.
    if len(_BUCKETS) > _BUCKET_CAP:
        for k in [k for k, dq in _BUCKETS.items() if not dq or dq[-1] < now - 3600]:
            del _BUCKETS[k]
    dq = _BUCKETS[key]
    while dq and dq[0] < now - window_s:
        dq.popleft()
    return dq, now


def failures(request: Request, bucket: str, window_s: int):
    """This address's recent failures in `bucket`. Only failures count: a
    classroom shares one public address, and thirty students signing in or
    accepting their invitations at once must not lock each other out."""
    return _recent(f"{client_ip(request)}:{bucket}", window_s)


IP_LOGIN_FAILS = 10          # wrong passwords per minute per address


def rate_limited(request: Request, bucket: str, limit: int, window_s: int) -> bool:
    """Sliding-window limiter, per client IP. True = over the limit."""
    ip = client_ip(request)
    dq, now = _recent(f"{ip}:{bucket}", window_s)
    if len(dq) >= limit:
        log.warning("rate-limit ip=%s bucket=%s", ip, bucket)
        return True
    dq.append(now)
    return False


# Per account rather than per IP: an attacker with many addresses gets around
# the IP limits, but not this one. 20 wrong passwords in 15 minutes pause that
# account's sign-in for 15 minutes.
LOGIN_FAILS, LOGIN_FAIL_WINDOW = 20, 900


def account_key(kind: str, name: str) -> str:
    return f"{kind}:{name.strip().lower()[:254]}"

# ---------------------------------------------------------------- app


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Runs under `python app.py` AND any external ASGI server, so a uvicorn/
    # gunicorn deployment can never come up against an un-migrated database.
    await run_in_threadpool(init_db)
    await run_in_threadpool(sweep_expired)
    if not DEBUG and links_warning():
        log.warning("%s Students would be given a useless address: set DOMAIN in .env.", links_warning())

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
# added) see anything. Without a session a visitor reaches the sign-in page
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


# Temporary passwords: 12 characters in three groups, from an alphabet without
# look-alikes (no 0/o, 1/l/i), so they survive being typed from an email.
# About 59 bits: with the login limits, guessing one is out of the question.
TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def temp_password() -> str:
    return "-".join("".join(secrets.choice(TEMP_ALPHABET) for _ in range(4)) for _ in range(3))


def issue_temp_password(conn, uid: int) -> str:
    """Give the account a new temporary password: it works for
    TEMP_PASSWORD_TTL and only to choose the account's own password. Every
    session of the account ends. Only its hash is stored; the admin sees the
    password once. The caller commits."""
    password = temp_password()
    salt = secrets.token_bytes(16)
    conn.execute(
        "UPDATE users SET pass_hash = ?, salt = ?, must_change_password = 1, temp_password_expires = ? WHERE id = ?",
        (hash_password(password, salt), salt.hex(), time.time() + TEMP_PASSWORD_TTL, uid),
    )
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
    return password


def load_disposable_domains() -> frozenset:
    try:
        lines = DISPOSABLE_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        log.warning("%s is missing: temporary email addresses can't be refused.", DISPOSABLE_FILE.name)
        return frozenset()
    return frozenset(x.strip().lower() for x in lines if x.strip() and not x.startswith("#"))


DISPOSABLE_DOMAINS = load_disposable_domains()


def disposable_email(email: str) -> bool:
    """An address at a temporary-email service (mailinator.com, or any
    subdomain of one: x.mailinator.com)."""
    parts = email.rsplit("@", 1)[-1].strip().lower().rstrip(".").split(".")
    return any(".".join(parts[i:]) in DISPOSABLE_DOMAINS for i in range(len(parts) - 1))


def create_account(conn, username: str, email: str, password: str | None = None) -> int:
    """A new account (its id), or Invalid. There is no open sign-up: admins
    add students, or send them an invitation link. Without a password the
    account has none usable yet; the caller gives it a temporary one
    (issue_temp_password). New accounts are on the leaderboard; each student
    can hide themselves on their account page. The caller commits."""
    if not USERNAME_RE.match(username):
        raise Invalid("Username must be 3-20 characters: letters, digits, underscore.")
    if len(email) > MAX_EMAIL or not EMAIL_RE.match(email):
        raise Invalid("That doesn't look like an email address.")
    if disposable_email(email):
        raise Invalid("Temporary email addresses can't be used. Use an address you'll keep.")
    if conn.execute("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (username,)).fetchone():
        raise Invalid(f"The username {username} is taken.")
    if conn.execute("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone():
        raise Invalid(f"{email} already has an account.")
    if password is None:
        pass_hash, salt = NO_PASSWORD, ""
    else:
        raw_salt = secrets.token_bytes(16)
        pass_hash, salt = hash_password(password, raw_salt), raw_salt.hex()
    try:
        cur = conn.execute(
            "INSERT INTO users (username, email, pass_hash, salt, created, must_change_password, "
            "leaderboard_opt_in) VALUES (?, ?, ?, ?, ?, ?, 1)",
            (username, email, pass_hash, salt, time.time(), int(password is None)),
        )
    except sqlite3.IntegrityError:            # a concurrent request for the same name
        raise Invalid(f"The username {username} or {email} is taken.") from None
    return cur.lastrowid


def _login(identifier: str, password: str):
    """(row, session token) for a correct password; (row, None) when it is a
    temporary password, which gives no session: it only lets the student
    choose their own password (/api/first-password); (None, None) otherwise."""
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
        if row["must_change_password"]:
            return row, None
        return row, new_session(conn, row["id"])


def temp_expired(row) -> bool:
    return not row["temp_password_expires"] or row["temp_password_expires"] < time.time()


@app.post("/api/login")
async def api_login(request: Request):
    ip_fails, _ = failures(request, "login-fail", 60)
    if len(ip_fails) >= IP_LOGIN_FAILS:
        log.warning("rate-limit ip=%s bucket=login-fail", client_ip(request))
        return err("Too many login attempts — wait a minute.", 429)
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    identifier = str(body.get("identifier", "")).strip()
    password = str(body.get("password", ""))
    if not identifier or not password:
        return err("Enter your username/email and password.")

    fails, now = _recent(account_key("login-fail", identifier), LOGIN_FAIL_WINDOW)
    if len(fails) >= LOGIN_FAILS:
        log.warning("login-paused identifier=%s", identifier[:64])
        return err("Too many wrong passwords for this account — wait 15 minutes.", 429)
    row, token = await run_in_threadpool(_login, identifier, password)
    if row is None:
        fails.append(now)        # unknown names count too: no difference to probe
        ip_fails.append(now)
        log.info("login-failed identifier=%s", identifier[:64])
        return err("Wrong credentials.", 401)
    fails.clear()
    if token is None:            # a temporary password: no session, choose your own first
        if temp_expired(row):
            return err("This temporary password has expired. Ask your instructor for a new one.", 401)
        return JSONResponse({"error": "Choose your own password to continue.", "mustChangePassword": True,
                             "username": row["username"]}, status_code=403)
    response = JSONResponse({"user": public_user(row)})
    set_session_cookie(response, token)
    log.info("login user=%s", row["username"])
    return response


def _first_password(identifier: str, temporary: str, new: str):
    """The student's own password, set with the temporary one: (user row,
    session token), or a reason it can't be. Checked and changed in one
    write, so one temporary password can't be used twice."""
    salt = secrets.token_bytes(16)
    new_hash = hash_password(new, salt)          # the slow part, before taking the write lock
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
            (identifier, identifier),
        ).fetchone()
        if row is None:
            burn_password_time(temporary)
            return None, "wrong"
        if not verify_password(row, temporary):
            return None, "wrong"
        if not row["must_change_password"]:
            return None, "wrong"                  # not a temporary password (any more)
        if temp_expired(row):
            return None, "expired"
        if hmac.compare_digest(new, temporary):
            return None, "same"
        changed = conn.execute(
            "UPDATE users SET pass_hash = ?, salt = ?, must_change_password = 0, temp_password_expires = NULL "
            "WHERE id = ? AND must_change_password = 1 AND pass_hash = ?",
            (new_hash, salt.hex(), row["id"], row["pass_hash"]),
        ).rowcount
        if not changed:                           # a second submission won the race
            conn.rollback()
            return None, "wrong"
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        conn.commit()
        session = new_session(conn, row["id"])
        user = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
        return user, session


@app.post("/api/first-password")
async def api_first_password(request: Request):
    """Sign in with a temporary password and choose one's own, in one step."""
    ip_fails, _ = failures(request, "login-fail", 60)
    if len(ip_fails) >= IP_LOGIN_FAILS:
        return err("Too many login attempts — wait a minute.", 429)
    body = await json_body(request)
    if body is None:
        return err("invalid request body")
    identifier = str(body.get("identifier", "")).strip()
    temporary = str(body.get("password", ""))
    new = str(body.get("newPassword", ""))
    if len(new) < 8:
        return err("Password must be at least 8 characters.")
    fails, now = _recent(account_key("login-fail", identifier), LOGIN_FAIL_WINDOW)
    if len(fails) >= LOGIN_FAILS:
        return err("Too many wrong passwords for this account — wait 15 minutes.", 429)
    user, outcome = await run_in_threadpool(_first_password, identifier, temporary, new)
    if user is None:
        if outcome == "wrong":
            fails.append(now)
            ip_fails.append(now)
            return err("Wrong credentials.", 401)
        if outcome == "expired":
            return err("This temporary password has expired. Ask your instructor for a new one.", 401)
        return err("Choose a password different from the temporary one.")
    log.info("first-password user=%s", user["username"])
    response = JSONResponse({"user": public_user(user)})
    set_session_cookie(response, outcome)
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


def site_address() -> str:
    """Where students sign in: the address in the message an admin sends."""
    return f"{BASE_URL}/account.html"


def links_warning() -> str | None:
    """An address that only works on this computer: a server whose
    ACADEMY_BASE_URL (DOMAIN in .env) isn't set would give students a useless
    address."""
    host = BASE_URL.split("://", 1)[-1].split("/", 1)[0].split(":")[0]
    if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        return f"This address starts with {BASE_URL}, which works only on the computer running the site."
    return None


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


async def admin_gate(request: Request):
    """The 401/403 for anyone but an admin, or None. Endpoints that read a
    body check this first, so a non-admin learns nothing about what they would
    accept."""
    try:
        await run_in_threadpool(_as_admin, session_token(request), lambda conn, admin: None)
    except AdminError as e:
        return err(e.message, e.status)
    return None


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
        "new": bool(row["must_change_password"]),   # hasn't chosen their own password yet
        "tempEmail": disposable_email(row["email"]),  # made before such addresses were refused
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
        "new": one("SELECT COUNT(*) FROM users WHERE must_change_password = 1"),
        "admins": one("SELECT COUNT(*) FROM users WHERE is_admin = 1"),
        "tempEmail": sum(1 for r in conn.execute("SELECT email FROM users") if disposable_email(r["email"])),
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


def _learner_temp_password(conn, admin, username: str):
    """A new temporary password for a student who forgot theirs (or never
    used the first one). Not for admins: one admin could take over another's
    account (an admin's password is reset on the server: make password)."""
    row = find_learner(conn, username)
    if row["is_admin"]:
        raise AdminError("An admin's password is reset on the server (make password NAME=…), not here.", 409)
    password = issue_temp_password(conn, row["id"])
    audit(conn, admin["username"], "temp-password", row["username"])
    conn.commit()
    return {"username": row["username"], "email": row["email"], "password": password,
            "days": TEMP_PASSWORD_TTL // 86400, "site": site_address(), "warning": links_warning()}


@app.post("/api/admin/users/{username}/temp-password")
async def api_admin_temp_password(request: Request, username: str):
    if denied := await admin_gate(request):
        return denied
    return await admin_call(request, _learner_temp_password, username)


MAX_NEW_STUDENTS = 200   # per request


def username_from(conn, email: str) -> str:
    """A free username made from an email address: anna.k@x.am -> anna_k."""
    base = re.sub(r"[^A-Za-z0-9_]", "_", email.split("@")[0])[:16].strip("_") or "student"
    base = base if len(base) >= 3 else (base + "___")[:3]
    name, n = base, 1
    while conn.execute("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (name,)).fetchone():
        n += 1
        name = f"{base}{n}"
    return name


def _add_students(conn, admin, students: list):
    results = []
    for s in students:
        email = s["email"]
        try:
            username = s["username"] or username_from(conn, email)
            uid = create_account(conn, username, email)
        except Invalid as e:
            results.append({"email": email, "username": s["username"], "error": str(e)})
            continue
        password = issue_temp_password(conn, uid)
        audit(conn, admin["username"], "add-student", username)
        results.append({"email": email, "username": username, "password": password})
    conn.commit()
    return results


@app.post("/api/admin/students")
async def api_admin_students(request: Request):
    """Accounts for new students, each with a temporary password that works
    for TEMP_PASSWORD_TTL, only to choose their own. The site sends no email:
    the admin sends each student the address, username and password (the
    panel writes the message). The passwords are shown this once."""
    if denied := await admin_gate(request):
        return denied
    body = await json_body(request)
    raw = body.get("students") if body else None
    if not isinstance(raw, list) or not raw:
        return err("invalid request body")
    if len(raw) > MAX_NEW_STUDENTS:
        return err(f"At most {MAX_NEW_STUDENTS} students at a time.")
    students = []
    for item in raw:
        if not isinstance(item, dict):
            return err("invalid request body")
        students.append({
            "email": str(item.get("email", "")).strip().lower(),
            "username": str(item.get("username") or "").strip(),
        })
    results = await admin_call(request, _add_students, students)
    if isinstance(results, JSONResponse):
        return results
    return {"results": results, "days": TEMP_PASSWORD_TTL // 86400, "site": site_address(),
            "warning": links_warning()}



# --- invitation links
#
# The admin sends each student a link from their own mailbox. The link isn't
# tied to an address: the student may want another one, so whoever opens it
# types the email they want. That is why a link works only once: a forwarded
# or leaked link makes at most one account, and the admin sees whose.

MAX_JOIN_LINKS = 200     # per request
MAX_SENT_TO = 120        # characters of the admin's note


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def join_address(token: str) -> str:
    # in the fragment: browsers never send it to the server or in a Referer
    return f"{BASE_URL}/account.html#join={token}"


def link_status(row, now: float) -> str:
    if row["used"]:
        return "used"
    if row["cancelled"]:
        return "cancelled"
    return "expired" if row["expires"] < now else "waiting"


def link_out(row, now: float) -> dict:
    return {"id": row["id"], "sentTo": row["sent_to"], "created": row["created"], "createdBy": row["created_by"],
            "expires": row["expires"], "used": row["used"], "usedBy": row["used_by"], "status": link_status(row, now)}


def _make_join_links(conn, admin, sent_to: list):
    now, links = time.time(), []
    for note in sent_to:
        token = secrets.token_urlsafe(24)
        cur = conn.execute(
            "INSERT INTO join_links (token_hash, sent_to, created, created_by, expires) VALUES (?, ?, ?, ?, ?)",
            (token_hash(token), note, now, admin["username"], now + JOIN_LINK_TTL),
        )
        links.append({"id": cur.lastrowid, "sentTo": note, "link": join_address(token)})
    audit(conn, admin["username"], "join-links", None, f"{len(links)} link(s)")
    conn.commit()
    return {"links": links, "days": JOIN_LINK_TTL // 86400, "warning": links_warning()}


@app.post("/api/admin/join-links")
async def api_admin_join_links(request: Request):
    """Invitation links, one per entry in sentTo (the admin's note of who
    gets it: an email or a name). The links are shown this once."""
    if denied := await admin_gate(request):
        return denied
    body = await json_body(request)
    raw = body.get("sentTo") if body else None
    if not isinstance(raw, list) or not raw or not all(isinstance(x, str) for x in raw):
        return err("invalid request body")
    if len(raw) > MAX_JOIN_LINKS:
        return err(f"At most {MAX_JOIN_LINKS} links at a time.")
    return await admin_call(request, _make_join_links, [x.strip()[:MAX_SENT_TO] for x in raw])


def _join_links(conn, _admin):
    now = time.time()
    rows = conn.execute(
        "SELECT * FROM join_links WHERE expires >= ? ORDER BY created DESC, id DESC LIMIT 500",
        (now - JOIN_LINKS_KEPT,),
    ).fetchall()
    return {"links": [link_out(r, now) for r in rows]}


@app.get("/api/admin/join-links")
async def api_admin_join_links_list(request: Request):
    return await admin_call(request, _join_links)


def _cancel_join_link(conn, admin, link_id: int):
    row = conn.execute("SELECT * FROM join_links WHERE id = ?", (link_id,)).fetchone()
    if row is None:
        raise AdminError("not found", 404)
    if link_status(row, time.time()) != "waiting":
        raise AdminError("This link can't be used any more anyway.", 409)
    conn.execute("UPDATE join_links SET cancelled = ? WHERE id = ? AND used IS NULL", (time.time(), link_id))
    audit(conn, admin["username"], "join-link-cancel", row["sent_to"] or f"#{link_id}")
    conn.commit()
    return {"ok": True}


@app.post("/api/admin/join-links/{link_id}/cancel")
async def api_admin_join_link_cancel(request: Request, link_id: int):
    return await admin_call(request, _cancel_join_link, link_id)


JOIN_PROBLEMS = {
    "unknown": "This link doesn't work. Check that you opened the whole link, or ask your instructor for a new one.",
    "used": "This link has already been used. If that wasn't you, tell your instructor.",
    "expired": "This link has expired. Ask your instructor for a new one.",
    "cancelled": "This link was cancelled. Ask your instructor for a new one.",
}


def join_problem(conn, token: str):
    """None if the link can make an account, else what is wrong with it."""
    row = conn.execute("SELECT * FROM join_links WHERE token_hash = ?", (token_hash(token),)).fetchone()
    if row is None:
        return "unknown"
    status = link_status(row, time.time())
    return None if status == "waiting" else status


def _check_join(token: str):
    with db() as conn:
        return join_problem(conn, token)


def _join(token: str, email: str, username: str):
    """An account for whoever opened the link: (result, None) or (None,
    problem). The link is claimed and the account made in one transaction,
    so a link makes one account even if it is submitted twice at once; a
    rejected email or username leaves the link unused."""
    with db() as conn:
        problem = join_problem(conn, token)
        if problem:
            return None, problem
        now = time.time()
        claimed = conn.execute(
            "UPDATE join_links SET used = ? WHERE token_hash = ? AND used IS NULL AND cancelled IS NULL AND expires >= ?",
            (now, token_hash(token), now),
        ).rowcount
        if not claimed:                          # another submission got there first
            conn.rollback()
            return None, "used"
        try:
            uid = create_account(conn, username or username_from(conn, email), email)
        except Invalid as e:
            conn.rollback()
            return None, str(e)
        password = issue_temp_password(conn, uid)
        name = conn.execute("SELECT username FROM users WHERE id = ?", (uid,)).fetchone()[0]
        conn.execute("UPDATE join_links SET used_by = ? WHERE token_hash = ?", (name, token_hash(token)))
        conn.commit()
        return {"username": name, "email": email, "password": password, "days": TEMP_PASSWORD_TTL // 86400}, None


async def join_token(request: Request):
    """(body, token, ip failure list) or (error response, None, None). A
    wrong token counts like a wrong password: tokens can't be guessed, but
    nobody gets to try."""
    ip_fails, _ = failures(request, "join-fail", 60)
    if len(ip_fails) >= IP_LOGIN_FAILS:
        log.warning("rate-limit ip=%s bucket=join-fail", client_ip(request))
        return err("Too many attempts — try again later.", 429), None, None
    body = await json_body(request)
    token = str(body.get("token", "")) if body else ""
    if not body or not token or len(token) > 100:
        return err("invalid request body"), None, None
    return body, token, ip_fails


def join_error(problem: str, ip_fails) -> JSONResponse:
    if problem == "unknown":
        ip_fails.append(time.time())
    return JSONResponse({"error": JOIN_PROBLEMS[problem], "problem": problem}, status_code=410)


@app.post("/api/join/check")
async def api_join_check(request: Request):
    body, token, ip_fails = await join_token(request)
    if token is None:
        return body
    problem = await run_in_threadpool(_check_join, token)
    if problem:
        return join_error(problem, ip_fails)
    return {"ok": True, "days": TEMP_PASSWORD_TTL // 86400}


@app.post("/api/join")
async def api_join(request: Request):
    """Whoever opened an invitation link: an account for the email they type,
    with a temporary password (shown on their screen) to choose their own."""
    body, token, ip_fails = await join_token(request)
    if token is None:
        return body
    email = str(body.get("email", "")).strip().lower()
    username = str(body.get("username") or "").strip()
    result, problem = await run_in_threadpool(_join, token, email, username)
    if result is None:
        if problem in JOIN_PROBLEMS:
            return join_error(problem, ip_fails)
        return err(problem)
    log.info("join user=%s", result["username"])
    return result

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
    if denied := await admin_gate(request):
        return denied
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
    if denied := await admin_gate(request):
        return denied
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
    if denied := await admin_gate(request):
        return None, denied
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


def cli(args: list) -> int:
    """python app.py admin add NAME [EMAIL] | admin remove NAME | admin list
    python app.py password NAME

    With EMAIL, a NAME that has no account yet gets one, with a temporary
    password: how the first admin starts, since there is no sign-up.
    `password NAME` gives any account a new temporary password: the way back
    in for an admin who forgot theirs (the site sends no email)."""
    usage = ("usage: python app.py admin add NAME [EMAIL] | admin remove NAME | admin list\n"
             "       python app.py password NAME")
    if args[:1] == ["password"] and len(args) == 2:
        init_db()
        with db() as conn:
            row = conn.execute("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE",
                               (args[1],)).fetchone()
            if row is None:
                print(f"No account named {args[1]!r}.", file=sys.stderr)
                return 1
            password = issue_temp_password(conn, row["id"])
            audit(conn, "(server)", "temp-password", row["username"])
            conn.commit()
        print(f"Temporary password for {row['username']}: {password}\n"
              f"It works for {TEMP_PASSWORD_TTL // 86400} days, once, to choose their own password at {site_address()}")
        return 0
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
        temporary = None
        if row is None and len(args) == 4:
            try:
                uid = create_account(conn, args[2], args[3].strip().lower())
            except Invalid as e:
                print(e, file=sys.stderr)
                return 1
            temporary = issue_temp_password(conn, uid)
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
    if temporary:
        print(f"The account is new. Temporary password: {temporary}\n"
              f"Sign in at {site_address()} within {TEMP_PASSWORD_TTL // 86400} days and choose your own.")
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
