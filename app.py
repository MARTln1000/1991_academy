#!/usr/bin/env python3
"""1991 Academy: web application backend.

A single FastAPI application that serves the JSON API and the static frontend.
Storage is one SQLite database. See docs/architecture.md for the design and
docs/api.md for the endpoint reference.

Run:
    python app.py                       # http://localhost:8735
    uvicorn app:app --port 8735         # equivalent; schema setup runs in lifespan
    python app.py admin add NAME EMAIL  # administration CLI, see cli()

Conventions:
    * Blocking work (SQLite, scrypt) runs in the thread pool, never on the event loop.
    * Static files are served from an explicit allowlist (static_allowed).
    * Schema migrations and the expiry sweep run in the lifespan handler, so they
      apply under any ASGI server.
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
# With ACADEMY_TRUST_PROXY=1 this port must be reachable only by the proxy,
# otherwise clients can forge X-Forwarded-For. Docker publishes it on 127.0.0.1.
HOST = os.environ.get("ACADEMY_HOST", "0.0.0.0")
DB_PATH = os.environ.get("ACADEMY_DB", str(ROOT / "1991_academy.db"))
# Self-hosted lesson videos: <youtube-id>.mp4|webm with an optional <youtube-id>.jpg
# poster. Mounted at runtime; see docs/content.md.
MEDIA_DIR = Path(os.environ.get("ACADEMY_MEDIA", str(ROOT / "media")))
DEBUG = os.environ.get("ACADEMY_DEBUG", "1") == "1"

# Secure (HTTPS-only) session cookie; on by default outside debug mode.
SECURE_COOKIES = os.environ.get("ACADEMY_SECURE_COOKIES", "0" if DEBUG else "1") == "1"
# Read the client IP from X-Forwarded-For. Enable only behind a trusted proxy
# that overwrites the header; otherwise per-IP rate limits can be bypassed.
TRUST_PROXY = os.environ.get("ACADEMY_TRUST_PROXY", "0") == "1"

SESSION_TTL = 30 * 86400
MAX_BODY = 300_000                # bytes, per request
TEMP_PASSWORD_TTL = 14 * 86400
JOIN_LINK_TTL = 7 * 86400
JOIN_LINKS_KEPT = 30 * 86400      # retention of expired links for the admin view
NO_PASSWORD = "!"                 # pass_hash sentinel: account has no usable password
SWEEP_INTERVAL = 3600
# Upper bound for the XP snapshot; also keeps it within SQLite's 64-bit INTEGER.
MAX_XP = 10_000_000

# localStorage key prefix mirrored by the synced state blob. Keys with the
# legacy prefix are migrated on read and write (current_keys).
STORE_PREFIX = "1991_academy:"
LEGACY_STORE_PREFIX = "martinium:"
XP_KEY = STORE_PREFIX + "xp:v1"

# Public site URL used in invitation links and onboarding messages.
BASE_URL = os.environ.get("ACADEMY_BASE_URL", f"http://localhost:{PORT}").rstrip("/")

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
# Excludes whitespace, control characters and HTML/header metacharacters.
_EMAIL_CHAR = r"[^@\s\x00-\x1f\x7f<>\"'`()\[\]\\,;:]"
EMAIL_RE = re.compile(rf"^{_EMAIL_CHAR}+@{_EMAIL_CHAR}+\.{_EMAIL_CHAR}+$")
MAX_EMAIL = 254                   # RFC 5321 limit
DISPOSABLE_FILE = ROOT / "disposable_email_domains.txt"

# Build revision written by the Dockerfile; reported by /api/health.
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

# Allowlist of servable paths. A blocklist would be bypassable through case
# folding on case-insensitive filesystems (e.g. /APP.PY).
PAGE_FILES = {
    "",  # "/" resolves to index.html
    "index.html", "lab.html", "missions.html", "practice.html", "account.html", "privacy.html",
    "admin.html", "robots.txt",
}
ANY_EXTENSION = object()           # course materials come in arbitrary formats

# top-level directory -> permitted extensions
STATIC_TREES = {
    "css": {".css"},
    "js": {".js"},
    "tracks": {".html"},
    "assets": ANY_EXTENSION,
}


MEDIA_PATH_RE = re.compile(r"^/media/[A-Za-z0-9_-]{1,64}\.(?:mp4|webm|jpg|vtt)$")
YOUTUBE_FILE_RE = re.compile(r"^([A-Za-z0-9_-]{11})\.(mp4|webm|jpg)$")


def static_allowed(path: str) -> bool:
    rel = path.lstrip("/")
    if rel in PAGE_FILES:
        return True
    segments = rel.split("/")
    if len(segments) < 2 or segments[0] not in STATIC_TREES:
        return False
    if any(seg in ("", ".", "..") or seg.startswith(".") for seg in segments):
        return False
    allowed_exts = STATIC_TREES[segments[0]]
    if allowed_exts is ANY_EXTENSION:
        return True
    return os.path.splitext(rel)[1].lower() in allowed_exts

# ---------------------------------------------------------------- database


@contextmanager
def db():
    """Yield a configured connection; callers are responsible for commit."""
    conn = sqlite3.connect(DB_PATH, timeout=5)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 5000")
        conn.execute("PRAGMA synchronous = NORMAL")  # durable enough under WAL
        conn.execute("PRAGMA foreign_keys = ON")     # per-connection setting
        yield conn
    finally:
        conn.close()


def init_db():
    with db() as conn:
        # WAL: concurrent readers alongside the single writer. Persistent per file.
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
            -- Admin-authored lessons. An id matching a built-in lesson overrides
            -- it; otherwise the lesson is inserted after `after` (NULL = last).
            -- `data` is validated and sanitized JSON (parse_lesson).
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
            CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY,
                text TEXT NOT NULL,
                text_hy TEXT NOT NULL DEFAULT '',
                level TEXT NOT NULL DEFAULT 'info',
                active INTEGER NOT NULL DEFAULT 1,
                created REAL NOT NULL,
                created_by TEXT NOT NULL
            );
            -- Single-use invitation links; only the SHA-256 of the token is stored.
            -- sent_to: admin's note on the recipient; used_by: resulting username.
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
            -- Audit trail. Stores names rather than ids so entries survive deletions.
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
        # Additive, idempotent migrations.
        cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
        if "leaderboard_opt_in" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN leaderboard_opt_in INTEGER NOT NULL DEFAULT 0")
            log.info("migration: added users.leaderboard_opt_in")
        if "xp_total" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN xp_total INTEGER NOT NULL DEFAULT 0")
            conn.execute("ALTER TABLE users ADD COLUMN xp_updated REAL")
            log.info("migration: added users.xp_total / xp_updated")
        if "week_id" not in cols:
            # weekly XP = xp_total - xp_week_start (rebased in _put_state)
            conn.execute("ALTER TABLE users ADD COLUMN xp_week_start INTEGER NOT NULL DEFAULT 0")
            conn.execute("ALTER TABLE users ADD COLUMN week_id TEXT")
            log.info("migration: added users.xp_week_start / week_id")
        if "must_change_password" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0")
            conn.execute("ALTER TABLE users ADD COLUMN temp_password_expires REAL")
            log.info("migration: added users.must_change_password / temp_password_expires")
        # Accounts without a usable password must be issued a temporary one.
        conn.execute("UPDATE users SET must_change_password = 1 WHERE pass_hash = ? AND must_change_password = 0",
                     (NO_PASSWORD,))
        if "is_admin" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
            log.info("migration: added users.is_admin")

        # Login matches username/email case-insensitively, so uniqueness must be
        # case-insensitive too. Fall back to a plain index if legacy data
        # already contains case-duplicates.
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
            CREATE INDEX IF NOT EXISTS idx_users_leaderboard
                ON users(leaderboard_opt_in, xp_total DESC);
            CREATE INDEX IF NOT EXISTS idx_sessions_user
                ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_created
                ON sessions(created);
            CREATE INDEX IF NOT EXISTS idx_users_week
                ON users(leaderboard_opt_in, week_id);
            CREATE INDEX IF NOT EXISTS idx_resets_user
                ON password_resets(user_id);
            CREATE INDEX IF NOT EXISTS idx_resets_expires
                ON password_resets(expires);
            CREATE INDEX IF NOT EXISTS idx_admin_log_ts
                ON admin_log(ts);
            """
        )

        # Rename legacy-prefixed keys in stored state; values are left untouched.
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
    """Return `data` with legacy-prefixed keys renamed to STORE_PREFIX.

    Returns the input object unchanged when nothing needs renaming. If both
    forms of a key exist, the current one wins.
    """
    if not any(k.startswith(LEGACY_STORE_PREFIX) for k in data):
        return data
    out = {k: v for k, v in data.items() if not k.startswith(LEGACY_STORE_PREFIX)}
    for k, v in data.items():
        if k.startswith(LEGACY_STORE_PREFIX):
            out.setdefault(STORE_PREFIX + k[len(LEGACY_STORE_PREFIX):], v)
    return out


def sweep_expired():
    """Delete expired sessions and tokens. Runs at startup and hourly."""
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
    """Constant-time comparison of `password` against the row's hash."""
    if row["pass_hash"] == NO_PASSWORD:
        burn_password_time(password)
        return False
    return hmac.compare_digest(
        row["pass_hash"], hash_password(password, bytes.fromhex(row["salt"]))
    )


_DECOY_SALT = secrets.token_bytes(16)


def burn_password_time(password: str) -> None:
    """Spend the cost of a real hash so response time doesn't reveal whether an
    account exists."""
    hash_password(password, _DECOY_SALT)


def current_week_id(now: float | None = None) -> str:
    """ISO year-week, e.g. '2026-W28' (UTC)."""
    return time.strftime("%G-W%V", time.gmtime(now if now is not None else time.time()))


# ---------------------------------------------------------------- helpers


def err(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


class Invalid(ValueError):
    """Validation error whose message is safe to return to the client."""


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
    """Return the user row for a session token, or None. Expired sessions are deleted."""
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
    """Parse the body as a JSON object; None if oversized, malformed or not an object."""
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
_BUCKET_CAP = 4096  # prune idle keys beyond this many


def client_ip(request: Request) -> str:
    """Client IP; honours X-Forwarded-For only when TRUST_PROXY is set."""
    if TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "?"


def _recent(key: str, window_s: int):
    """Sliding window: the deque of timestamps for `key` within `window_s`."""
    now = time.time()
    if len(_BUCKETS) > _BUCKET_CAP:
        for k in [k for k, dq in _BUCKETS.items() if not dq or dq[-1] < now - 3600]:
            del _BUCKETS[k]
    dq = _BUCKETS[key]
    while dq and dq[0] < now - window_s:
        dq.popleft()
    return dq, now


def failures(request: Request, bucket: str, window_s: int):
    """Recent failures for this client IP. Only failures are counted, so many
    users behind one NAT (a classroom) can sign in concurrently."""
    return _recent(f"{client_ip(request)}:{bucket}", window_s)


IP_LOGIN_FAILS = 10          # per IP per minute


def rate_limited(request: Request, bucket: str, limit: int, window_s: int) -> bool:
    """Per-IP sliding-window limiter; True when the limit is exceeded."""
    ip = client_ip(request)
    dq, now = _recent(f"{ip}:{bucket}", window_s)
    if len(dq) >= limit:
        log.warning("rate-limit ip=%s bucket=%s", ip, bucket)
        return True
    dq.append(now)
    return False


# Per-account lockout, independent of the client IP.
LOGIN_FAILS, LOGIN_FAIL_WINDOW = 20, 900


def account_key(kind: str, name: str) -> str:
    return f"{kind}:{name.strip().lower()[:254]}"

# ---------------------------------------------------------------- app


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await run_in_threadpool(init_db)
    await run_in_threadpool(sweep_expired)
    if not DEBUG and links_warning():
        log.warning("%s Students would be given a useless address: set DOMAIN in .env.", links_warning())

    async def sweeper():
        while True:
            await asyncio.sleep(SWEEP_INTERVAL)
            try:
                await run_in_threadpool(sweep_expired)
            except Exception:  # noqa: BLE001 - keep the task alive
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

# Content-Security-Policy. No inline scripts, eval or workers. jsDelivr is
# restricted to the pinned KaTeX path (tracks/math.html adds SRI hashes);
# 'unsafe-inline' is allowed for styles only, which the renderers emit.
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


# Compress in-app (~930 KB -> ~275 KB on the heaviest page) so it does not depend
# on proxy configuration. BREACH does not apply: no secret is reflected in bodies.
class GZipExceptMedia(GZipMiddleware):
    """GZip middleware that skips /media: video is already compressed and range
    requests must be served byte-exact."""

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


# Paths served without a session. Everything else requires one; API endpoints
# perform their own authentication.
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
    """Return an error response for disallowed requests, or None."""
    if path.startswith("/media/"):
        if not MEDIA_PATH_RE.match(path) or not MEDIA_DIR.is_dir():
            return err("not found", 404)
    elif not path.startswith("/api/") and not static_allowed(path):
        return err("not found", 404)
    # CSRF: cross-origin forms cannot send application/json without a CORS
    # preflight, which is never granted. Also covers same-site subdomains.
    if path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        ctype = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if ctype != "application/json":
            return err("Send the request as JSON.", 415)
    # Early rejection by Content-Length; json_body() enforces the limit as well.
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
        response.headers["Cache-Control"] = "no-cache"
    elif path.startswith(("/assets/", "/media/")):
        response.headers["Cache-Control"] = "private, max-age=86400"
    else:
        response.headers["Cache-Control"] = "no-cache"

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = CSP
    if SECURE_COOKIES:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"

    if path.startswith("/api/"):
        log.info("%s %s %s %dms", request.method, path, response.status_code, ms)
    return response

# ---------------------------------------------------------------- auth


# Temporary passwords: 3x4 characters from an alphabet without look-alikes (~59 bits).
TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def temp_password() -> str:
    return "-".join("".join(secrets.choice(TEMP_ALPHABET) for _ in range(4)) for _ in range(3))


def issue_temp_password(conn, uid: int) -> str:
    """Set and return a new temporary password and revoke all sessions.

    The password is valid for TEMP_PASSWORD_TTL and only for choosing a new
    one (/api/first-password). Only its hash is stored. Caller commits.
    """
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
    """True if the address belongs to a disposable-email domain or a subdomain of one."""
    parts = email.rsplit("@", 1)[-1].strip().lower().rstrip(".").split(".")
    return any(".".join(parts[i:]) in DISPOSABLE_DOMAINS for i in range(len(parts) - 1))


def create_account(conn, username: str, email: str, password: str | None = None) -> int:
    """Insert a user and return its id; raises Invalid on bad or duplicate input.

    With password=None the account has no usable password until the caller
    issues a temporary one. New accounts are opted in to the leaderboard.
    Caller commits.
    """
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
    except sqlite3.IntegrityError:            # lost a race with a concurrent insert
        raise Invalid(f"The username {username} or {email} is taken.") from None
    return cur.lastrowid


def _login(identifier: str, password: str):
    """Return (row, token) on success, (row, None) for a temporary password
    (no session is issued), or (None, None)."""
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
            (identifier, identifier),
        ).fetchone()
        if row is None:
            burn_password_time(password)
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
        fails.append(now)        # count unknown identifiers too, to avoid enumeration
        ip_fails.append(now)
        log.info("login-failed identifier=%s", identifier[:64])
        return err("Wrong credentials.", 401)
    fails.clear()
    if token is None:            # temporary password: must set a new one first
        if temp_expired(row):
            return err("This temporary password has expired. Ask your instructor for a new one.", 401)
        return JSONResponse({"error": "Choose your own password to continue.", "mustChangePassword": True,
                             "username": row["username"]}, status_code=403)
    response = JSONResponse({"user": public_user(row)})
    set_session_cookie(response, token)
    log.info("login user=%s", row["username"])
    return response


def _first_password(identifier: str, temporary: str, new: str):
    """Replace a temporary password. Returns (user, token) or (None, reason).

    The check and the update are a single conditional UPDATE, so a temporary
    password cannot be redeemed twice by concurrent requests.
    """
    salt = secrets.token_bytes(16)
    new_hash = hash_password(new, salt)          # hash before taking the write lock
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
            return None, "wrong"                  # not (or no longer) a temporary password
        if temp_expired(row):
            return None, "expired"
        if hmac.compare_digest(new, temporary):
            return None, "same"
        changed = conn.execute(
            "UPDATE users SET pass_hash = ?, salt = ?, must_change_password = 0, temp_password_expires = NULL "
            "WHERE id = ? AND must_change_password = 1 AND pass_hash = ?",
            (new_hash, salt.hex(), row["id"], row["pass_hash"]),
        ).rowcount
        if not changed:                           # lost the race to a concurrent request
            conn.rollback()
            return None, "wrong"
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        conn.commit()
        session = new_session(conn, row["id"])
        user = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
        return user, session


@app.post("/api/first-password")
async def api_first_password(request: Request):
    """Exchange a temporary password for a user-chosen one and sign in."""
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
    """Extract the XP total from a state blob, or None if it is not a valid number.

    Never raises: it runs inside the state-write transaction, and a malformed
    value must not prevent the progress itself from being saved.
    """
    try:
        raw = json.loads(data.get(XP_KEY) or "{}")
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(raw, dict):
        return None
    total = raw.get("total")
    # bool is a subclass of int
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
            # On the first sync of a new ISO week, rebase the weekly baseline.
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
    # Values mirror localStorage and must be strings; this also keeps NaN/Infinity,
    # which JSON.parse cannot read back, out of storage.
    if not all(isinstance(k, str) and isinstance(v, str) for k, v in data.items()):
        return err("invalid request body")
    data = current_keys(data)
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
        # Revoke all other sessions; keep the current one.
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
    """Sign-in URL included in onboarding messages."""
    return f"{BASE_URL}/account.html"


def links_warning() -> str | None:
    """Warning text if BASE_URL points at a loopback host, else None."""
    host = BASE_URL.split("://", 1)[-1].split("/", 1)[0].split(":")[0]
    if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        return f"This address starts with {BASE_URL}, which works only on the computer running the site."
    return None


def delete_user_rows(conn, uid: int):
    """Delete a user and all dependent rows (children first). Caller commits."""
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
# Admin is a flag on users (is_admin), granted only through the server CLI,
# never over HTTP. It is checked on every request; all changes are audited.


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
    """Run fn(conn, admin, *args) in the thread pool for an authenticated admin;
    AdminError is mapped to a JSON error response."""
    try:
        return await run_in_threadpool(_as_admin, session_token(request), fn, *args)
    except AdminError as e:
        return err(e.message, e.status)


async def admin_gate(request: Request):
    """Return a 401/403 response for non-admins, or None.

    Called before reading the body so validation errors are never shown to
    unauthorized clients.
    """
    try:
        await run_in_threadpool(_as_admin, session_token(request), lambda conn, admin: None)
    except AdminError as e:
        return err(e.message, e.status)
    return None


def audit(conn, admin_name: str, action: str, target: str | None = None, detail: str | None = None):
    """Append an audit entry. Caller commits together with the change."""
    conn.execute(
        "INSERT INTO admin_log (ts, admin, action, target, detail) VALUES (?, ?, ?, ?, ?)",
        (time.time(), admin_name, action, target, detail),
    )
    log.info("admin user=%s action=%s target=%s", admin_name, action, target)


def learner_progress(data_json) -> dict:
    """Summarize progress from a state blob (see js/progress.js, js/xp.js).
    Malformed entries are ignored."""
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

    def when(v):  # epoch ms; legacy entries are `true`
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
        "new": bool(row["must_change_password"]),
        "tempEmail": disposable_email(row["email"]),
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

    # Aggregate per-user blobs. Lesson ids are prefixed with their track id.
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

# Whitelisted ORDER BY clauses; client input selects a key, never SQL text.
LEARNER_SORTS = {
    "created": "u.created DESC",
    "active": "COALESCE(s.updated, 0) DESC, u.created DESC",
    "xp": "u.xp_total DESC, u.username COLLATE NOCASE",
    "name": "u.username COLLATE NOCASE",
}
LEARNERS_PAGE = 50


def like_pattern(text: str) -> str:
    """LIKE pattern matching `text` literally (escapes %, _ and backslash)."""
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
    """Issue a temporary password to a student. Refused for admin accounts to
    prevent admin-to-admin takeover; use the server CLI for those."""
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
    """Derive an available username from an email address (anna.k@x.am -> anna_k)."""
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
    """Create student accounts with temporary passwords.

    The passwords are returned once for the admin to distribute; the
    application does not send email.
    """
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
# Links are not bound to an email address (the recipient chooses one), so each
# is single-use: a leaked link yields at most one account, visible to admins.

MAX_JOIN_LINKS = 200     # per request
MAX_SENT_TO = 120        # max length of the recipient note


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def join_address(token: str) -> str:
    # Token in the fragment: never sent to servers or leaked via Referer.
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
    """Create one invitation link per entry in sentTo. Links are returned once."""
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
    """Return None if the link is usable, else the reason it is not."""
    row = conn.execute("SELECT * FROM join_links WHERE token_hash = ?", (token_hash(token),)).fetchone()
    if row is None:
        return "unknown"
    status = link_status(row, time.time())
    return None if status == "waiting" else status


def _check_join(token: str):
    with db() as conn:
        return join_problem(conn, token)


def _join(token: str, email: str, username: str):
    """Redeem a link: returns (result, None) or (None, problem).

    The claim and the account creation share one transaction, so concurrent
    submissions create at most one account, and a validation error leaves
    the link unused.
    """
    with db() as conn:
        problem = join_problem(conn, token)
        if problem:
            return None, problem
        now = time.time()
        claimed = conn.execute(
            "UPDATE join_links SET used = ? WHERE token_hash = ? AND used IS NULL AND cancelled IS NULL AND expires >= ?",
            (now, token_hash(token), now),
        ).rowcount
        if not claimed:                          # lost the race to a concurrent request
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
    """Return (body, token, ip_failures) or (error_response, None, None).
    Invalid tokens count toward the same per-IP limit as failed logins."""
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
    """Create an account from an invitation link and return its temporary password."""
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

LESSON_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)+$")   # <track>-<module>-<n>, e.g. web-2-4
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

# Allowed tags for admin-authored lesson HTML. Scripts, styles, event handlers,
# frames and javascript: URLs are stripped on save.
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
    """Validate an admin-submitted lesson and sanitize its HTML."""
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
    """Return the validated, sanitized lesson without persisting it."""
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


# --- self-hosted media

def hosted_media() -> dict:
    """Map YouTube id -> {"video": url, "poster": url | None} for files in MEDIA_DIR."""
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


# --- public content: published lessons, active announcements, hosted media

def _public_content(signed_in: bool):
    if not signed_in:          # anonymous: announcements only
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
    """Serve dynamic content as a script so it is available before first render
    (applied by js/custom-content.js). json.dumps output is safe to embed as
    a JavaScript literal.
    """
    signed_in = await run_in_threadpool(session_valid, session_token(request))
    content = await run_in_threadpool(_public_content, signed_in)
    return Response(
        "window.ACADEMY_CUSTOM = " + json.dumps(content, separators=(",", ":")) + ";\n",
        media_type="application/javascript",
    )


# ---------------------------------------------------------------- CLI


def cli(args: list) -> int:
    """Administration commands.

        python app.py admin add NAME [EMAIL]   grant admin; creates the account if EMAIL is given
        python app.py admin remove NAME
        python app.py admin list
        python app.py password NAME            issue a temporary password

    Returns the process exit code.
    """
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
    """Session check for Caddy's forward_auth on /media."""
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

# Fallback for /media when not served by Caddy (supports range requests).
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR), check_dir=False), name="media")

# Mounted last so API routes take precedence; paths are pre-filtered by guard().
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="site")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        sys.exit(cli(sys.argv[1:]))
    log.info("1991 Academy backend on http://localhost:%d  [debug=%s, secure_cookies=%s, trust_proxy=%s, rev=%s]",
             PORT, DEBUG, SECURE_COOKIES, TRUST_PROXY, (REVISION or "dev")[:7])
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning", server_header=False)
