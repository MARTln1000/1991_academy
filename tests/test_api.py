"""API tests for the 1991 Academy backend.

    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/pytest -q

Every test runs against its own fresh temp SQLite DB (the `client` fixture
repoints app.DB_PATH per test), so nothing here can touch real accounts.
"""
import json
import re
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(app, "DB_PATH", str(tmp_path / "test.db"))
    app._BUCKETS.clear()  # rate-limit buckets are a module global — reset per test
    app.init_db()
    with TestClient(app.app) as c:
        yield c


@pytest.fixture
def sent_emails(monkeypatch):
    """Capture outbound email instead of sending it; return the recorded list."""
    box = []
    monkeypatch.setattr(app, "send_email", lambda to, subject, body: box.append((to, subject, body)) or True)
    return box


def register(client, username="alice", email="alice@example.com", password="hunter2pw"):
    return client.post("/api/register", json={"username": username, "email": email, "password": password})


# ----------------------------------------------------------------- registration

def test_register_and_me(client):
    r = register(client)
    assert r.status_code == 201
    assert r.json()["user"]["username"] == "alice"
    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "alice@example.com"


def test_register_duplicate_is_409(client):
    register(client)
    r = register(client, email="other@example.com")  # same username
    assert r.status_code == 409


@pytest.mark.parametrize("body", [
    {"username": "ab", "email": "a@b.co", "password": "longenough1"},   # username too short
    {"username": "okname", "email": "nope", "password": "longenough1"},  # bad email
    {"username": "okname", "email": "a@b.co", "password": "short"},      # password too short
])
def test_register_validation(client, body):
    assert client.post("/api/register", json=body).status_code == 400


# ----------------------------------------------------------------------- login

def test_login_success_and_wrong_password(client):
    register(client)
    client.post("/api/logout")
    ok = client.post("/api/login", json={"identifier": "alice", "password": "hunter2pw"})
    assert ok.status_code == 200
    bad = client.post("/api/login", json={"identifier": "alice", "password": "WRONG"})
    assert bad.status_code == 401


def test_login_by_email_case_insensitive(client):
    register(client)
    client.post("/api/logout")
    r = client.post("/api/login", json={"identifier": "ALICE@EXAMPLE.COM", "password": "hunter2pw"})
    assert r.status_code == 200


def test_me_requires_auth(client):
    assert client.get("/api/me").status_code == 401


def test_login_does_not_leak_which_accounts_exist(client):
    """An unknown identifier must cost the same scrypt work as a real one.
    Returning early skipped the hash, so a ~30ms vs ~1ms gap enumerated every
    registered username and email."""
    register(client)
    client.post("/api/logout")

    def median_ms(identifier):
        samples = []
        for _ in range(5):
            t = time.perf_counter()
            r = client.post("/api/login", json={"identifier": identifier, "password": "wrongpassword"})
            samples.append((time.perf_counter() - t) * 1000)
            assert r.status_code in (401, 429)
        samples.sort()
        return samples[len(samples) // 2]

    app._BUCKETS.clear()
    known = median_ms("alice")
    app._BUCKETS.clear()
    unknown = median_ms("nobody-here")
    # scrypt dominates both paths; anything beyond a few ms apart is the oracle.
    assert abs(known - unknown) < known * 0.6, f"known={known:.1f}ms unknown={unknown:.1f}ms"


# ------------------------------------------------------------------- state sync

def test_state_roundtrip_and_xp_snapshot(client):
    register(client)
    blob = {"martinium:xp:v1": '{"total": 140}', "martinium:progress:v1": "{}"}
    assert client.put("/api/state", json={"data": blob}).status_code == 200
    got = client.get("/api/state").json()
    assert got["data"]["martinium:xp:v1"] == '{"total": 140}'
    # opt in → XP should surface on the all-time leaderboard
    client.post("/api/leaderboard-optin", json={"optIn": True})
    lb = client.get("/api/leaderboard").json()
    assert lb["top"] and lb["top"][0]["username"] == "alice" and lb["top"][0]["xp"] == 140
    assert lb["you"] == 1


def test_state_requires_auth(client):
    assert client.get("/api/state").status_code == 401
    assert client.put("/api/state", json={"data": {}}).status_code == 401


@pytest.mark.parametrize("total", [
    float("inf"),      # int(inf) raises OverflowError
    float("-inf"),
    float("nan"),      # would round-trip as bare NaN, which JSON.parse rejects
    10 ** 30,          # too large for SQLite's 8-byte INTEGER
    "not a number",
    None,
    True,              # bool is an int subclass — must not count as XP
    {"nested": 1},
])
def test_corrupt_xp_never_breaks_the_state_write(client, total):
    """A bad XP value costs the leaderboard entry and nothing else. It used to
    abort the surrounding transaction and 500, so the learner's whole progress
    stopped syncing."""
    register(client)
    blob = {"martinium:xp:v1": json.dumps({"total": total}),
            "martinium:progress:v1": '{"done": {"web-1-1": 1}}'}
    r = client.put("/api/state", json={"data": blob})
    assert r.status_code == 200, r.text
    # the progress half must have been persisted
    got = client.get("/api/state").json()
    assert got["data"]["martinium:progress:v1"] == '{"done": {"web-1-1": 1}}'
    # ...and nothing absurd reached the leaderboard
    client.post("/api/leaderboard-optin", json={"optIn": True})
    top = client.get("/api/leaderboard?period=all").json()["top"]
    assert top == [] or top[0]["xp"] <= app.MAX_XP


def test_xp_is_clamped_to_a_sane_ceiling(client):
    register(client)
    client.post("/api/leaderboard-optin", json={"optIn": True})
    client.put("/api/state", json={"data": {"martinium:xp:v1": json.dumps({"total": 10 ** 12})}})
    assert client.get("/api/leaderboard?period=all").json()["top"][0]["xp"] == app.MAX_XP


def test_state_values_must_be_strings(client):
    """The blob mirrors localStorage, where every value is a string. Anything
    else is a malformed client and is refused rather than stored."""
    register(client)
    assert client.put("/api/state", json={"data": {"k": 5}}).status_code == 400
    assert client.put("/api/state", json={"data": {"k": {"a": 1}}}).status_code == 400
    assert client.put("/api/state", json={"data": {"k": "ok"}}).status_code == 200


def test_stored_state_is_always_valid_json_for_the_browser(client):
    """Whatever we store must survive a strict JSON parse on the way back out —
    Python's json accepts NaN/Infinity, JavaScript's does not."""
    register(client)
    client.put("/api/state", json={"data": {"martinium:xp:v1": '{"total": 42}'}})
    raw = client.get("/api/state").content.decode()
    json.loads(raw, parse_constant=_reject_constant)


def _reject_constant(c):
    raise AssertionError(f"non-standard JSON constant in response: {c}")


# ------------------------------------------------------------------ leaderboard

def test_leaderboard_weekly_vs_alltime(client):
    register(client)
    client.post("/api/leaderboard-optin", json={"optIn": True})
    client.put("/api/state", json={"data": {"martinium:xp:v1": '{"total": 50}'}})

    # fresh account: this week's XP == lifetime XP
    wk = client.get("/api/leaderboard?period=week").json()
    assert wk["period"] == "week"
    assert wk["top"][0]["xp"] == 50

    # simulate a week rollover: pretend the stored week is old, then sync more XP.
    with app.db() as conn:
        conn.execute("UPDATE users SET week_id = '1999-W01' WHERE username = 'alice'")
        conn.commit()
    client.put("/api/state", json={"data": {"martinium:xp:v1": '{"total": 65}'}})

    all_time = client.get("/api/leaderboard?period=all").json()
    week = client.get("/api/leaderboard?period=week").json()
    assert all_time["top"][0]["xp"] == 65          # lifetime keeps climbing
    assert week["top"][0]["xp"] == 15              # weekly rebased: 65 - 50


# -------------------------------------------------------------- change password

def test_change_password(client):
    register(client)
    wrong = client.post("/api/change-password", json={"currentPassword": "nope", "newPassword": "brandnew99"})
    assert wrong.status_code == 403
    ok = client.post("/api/change-password", json={"currentPassword": "hunter2pw", "newPassword": "brandnew99"})
    assert ok.status_code == 200
    client.post("/api/logout")
    assert client.post("/api/login", json={"identifier": "alice", "password": "hunter2pw"}).status_code == 401
    assert client.post("/api/login", json={"identifier": "alice", "password": "brandnew99"}).status_code == 200


def test_change_password_too_short(client):
    register(client)
    r = client.post("/api/change-password", json={"currentPassword": "hunter2pw", "newPassword": "short"})
    assert r.status_code == 400


# --------------------------------------------------------------- password reset

def test_forgot_password_is_generic_and_creates_token(client, sent_emails):
    register(client)
    # existing email → generic 200 + an email captured
    assert client.post("/api/forgot-password", json={"email": "alice@example.com"}).status_code == 200
    # unknown email → identical generic 200, no email
    assert client.post("/api/forgot-password", json={"email": "ghost@example.com"}).status_code == 200
    assert len(sent_emails) == 1
    assert "reset=" in sent_emails[0][2]


def test_reset_password_end_to_end(client, sent_emails):
    register(client)
    client.post("/api/forgot-password", json={"email": "alice@example.com"})
    token = re.search(r"reset=([A-Za-z0-9_-]+)", sent_emails[0][2]).group(1)

    bad = client.post("/api/reset-password", json={"token": "garbage", "password": "freshpass1"})
    assert bad.status_code == 400
    ok = client.post("/api/reset-password", json={"token": token, "password": "freshpass1"})
    assert ok.status_code == 200
    # token is single-use
    assert client.post("/api/reset-password", json={"token": token, "password": "again9999"}).status_code == 400
    # new password works, old one doesn't
    assert client.post("/api/login", json={"identifier": "alice", "password": "freshpass1"}).status_code == 200
    assert client.post("/api/login", json={"identifier": "alice", "password": "hunter2pw"}).status_code == 401


# -------------------------------------------------------------- delete account

def test_delete_account(client):
    register(client)
    client.put("/api/state", json={"data": {"martinium:xp:v1": '{"total": 10}'}})
    assert client.post("/api/delete-account", json={"password": "WRONG"}).status_code == 403
    assert client.post("/api/delete-account", json={"password": "hunter2pw"}).status_code == 200
    # session gone, login impossible, username freed for re-registration
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/login", json={"identifier": "alice", "password": "hunter2pw"}).status_code == 401
    assert register(client).status_code == 201


# ------------------------------------------------------------------ rate limit

def test_login_rate_limited(client):
    register(client)
    codes = [client.post("/api/login", json={"identifier": "alice", "password": "x"}).status_code for _ in range(12)]
    assert 429 in codes  # the limiter (10/min) must kick in within 12 tries


# ---------------------------------------------------------------------- health

def test_health(client):
    h = client.get("/api/health").json()
    assert h["ok"] is True and h["version"] == app.VERSION
    assert h["email"] is False  # SMTP unset in tests
    assert h["revision"] is None  # no REVISION file outside a deployed release


def test_health_reports_the_deployed_revision(client, monkeypatch):
    # deploy/activate.sh and deploy.sh compare this against the commit they shipped
    monkeypatch.setattr(app, "REVISION", "0123456789abcdef0123456789abcdef01234567")
    assert client.get("/api/health").json()["revision"] == app.REVISION


# ---------------------------------------------------------------- security

def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert "Referrer-Policy" in r.headers


def test_session_cookie_flags(client):
    r = register(client)
    setc = r.headers.get("set-cookie", "").lower()
    assert "msession=" in setc and "httponly" in setc and "samesite=lax" in setc
    # tests run with ACADEMY_DEBUG=1, so cookies are NOT Secure (dev over http)
    assert "secure" not in setc


def test_rate_limit_per_proxy_ip(client, monkeypatch):
    """With trust-proxy on, distinct X-Forwarded-For IPs get independent buckets."""
    monkeypatch.setattr(app, "TRUST_PROXY", True)
    app._BUCKETS.clear()
    # Hammer login from IP .1 until limited
    codes_a = [client.post("/api/login", json={"identifier": "x", "password": "y"},
                           headers={"X-Forwarded-For": "1.1.1.1"}).status_code for _ in range(12)]
    assert 429 in codes_a
    # A different forwarded IP is unaffected by .1's limit
    r_b = client.post("/api/login", json={"identifier": "x", "password": "y"},
                      headers={"X-Forwarded-For": "2.2.2.2"})
    assert r_b.status_code != 429


# ------------------------------------------------------------- static serving

@pytest.mark.parametrize("path", [
    "/app.py",                  # backend source
    "/APP.PY",                  # ...and its case variants, which resolve to the
    "/App.Py",                  #    same file on macOS/Windows volumes
    "/1991_academy.db",         # the credentials database
    "/1991_ACADEMY.DB",
    "/README.md",
    "/requirements.txt",
    "/tests/test_api.py",
    "/DEPLOYMENT.md",
    "/.venv/pyvenv.cfg",
    "/.claude/launch.json",
    # shipped inside every release by deploy/deploy.sh — never web-visible
    "/REVISION",
    "/requirements.lock",
    "/deploy/activate.sh",
    "/deploy/academy.env.example",
    "/.github/workflows/deploy.yml",
    # the Docker setup; deploy/backup.sh is also inside the image
    "/Dockerfile",
    "/docker-compose.yml",
    "/docker-compose.local.yml",
    "/Makefile",
    "/.env.example",
    "/.env",
    "/deploy/backup.sh",
    "/deploy/Caddyfile.docker",
])
def test_non_web_files_are_not_served(client, path):
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("path", [
    "/index.html", "/lab.html", "/missions.html", "/practice.html", "/account.html",
    "/tracks/web.html",
    "/css/tokens.css",
    "/js/runner.js",
    "/js/data/lab.js",
    # course materials are arbitrary file types, INCLUDING .py starter files —
    # an extension blocklist used to 404 these download links.
    "/assets/courses/ml/HW/1/knn.py",
    "/assets/courses/ml/HW/1/HW1.ipynb",
    "/assets/courses/ml/HW/1/car.csv",
])
def test_site_files_are_served(client, path):
    assert client.get(path).status_code == 200


def test_allowlist_rejects_traversal_and_hidden_segments():
    assert app.static_allowed("/css/base.css")
    assert app.static_allowed("/assets/courses/ml/HW/1/knn.py")
    assert app.static_allowed("")
    assert not app.static_allowed("/css/../app.py")
    assert not app.static_allowed("/assets/../../etc/passwd")
    assert not app.static_allowed("/js/.hidden/x.js")
    assert not app.static_allowed("/css")        # directory itself, no file
    assert not app.static_allowed("/nope/x.js")  # unknown tree


def test_security_headers_include_csp(client):
    r = client.get("/api/health")
    csp = r.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "object-src 'none'" in csp
    # the runtimes the site genuinely needs must stay permitted
    assert "blob:" in csp and "https://cdn.jsdelivr.net" in csp


# ----------------------------------------------------------------- hygiene

def test_case_insensitive_username_is_rejected(client):
    register(client)
    r = register(client, username="ALICE", email="other@example.com")
    assert r.status_code == 409


def test_sweep_removes_expired_sessions_and_tokens(client):
    register(client)
    assert client.get("/api/me").status_code == 200
    with app.db() as conn:
        # age this session past the TTL and expire any reset token
        conn.execute("UPDATE sessions SET created = ?", (time.time() - app.SESSION_TTL - 10,))
        conn.execute(
            "INSERT INTO password_resets (token_hash, user_id, created, expires) "
            "VALUES ('dead', (SELECT id FROM users LIMIT 1), ?, ?)",
            (time.time() - 7200, time.time() - 3600),
        )
        conn.commit()

    sessions, resets = app.sweep_expired()
    assert sessions == 1 and resets == 1
    with app.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM password_resets").fetchone()[0] == 0
    assert client.get("/api/me").status_code == 401


def test_oversized_body_is_rejected(client):
    register(client)
    big = {"data": {"martinium:xp:v1": "x" * (app.MAX_BODY + 1000)}}
    assert client.put("/api/state", json=big).status_code == 413


def test_schema_is_ready_without_calling_init_db(tmp_path, monkeypatch):
    """A uvicorn/gunicorn deployment never runs __main__, so the lifespan
    handler must create the schema on startup."""
    monkeypatch.setattr(app, "DB_PATH", str(tmp_path / "lifespan.db"))
    app._BUCKETS.clear()
    with TestClient(app.app) as c:           # entering runs the lifespan
        assert c.post("/api/register", json={
            "username": "bob", "email": "bob@example.com", "password": "hunter2pw"
        }).status_code == 201
