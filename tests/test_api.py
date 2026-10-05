"""API tests for the 1991 Academy backend.

    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/pytest -q

Every test runs against its own fresh temp SQLite DB (the `client` fixture
repoints app.DB_PATH per test), so nothing here can touch real accounts.
"""
import json
import os
import re
import subprocess
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
    """An account, signed in on `client`; returns the sign-in response. There
    is no sign-up (the school creates accounts), so it is made directly."""
    with app.db() as conn:
        app.create_account(conn, username, email, password)
        conn.commit()
    return client.post("/api/login", json={"identifier": username, "password": password})


# --------------------------------------------- accounts: by invitation only

def test_there_is_no_sign_up(client):
    r = client.post("/api/register", json={"username": "eve", "email": "eve@example.com", "password": "longenough1"})
    assert r.status_code in (404, 405)
    with app.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_signed_in_and_me(client):
    r = register(client)
    assert r.status_code == 200 and r.json()["user"]["username"] == "alice"
    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "alice@example.com"


def test_usernames_and_emails_are_unique_whatever_the_case(client):
    register(client)
    with app.db() as conn:
        for username, email in (("ALICE", "other@example.com"), ("bob", "Alice@Example.com")):
            with pytest.raises(app.Invalid):
                app.create_account(conn, username, email)


@pytest.mark.parametrize("username,email", [
    ("ab", "a@b.co"),                                       # username too short
    ("okname", "nope"),                                     # bad email
    # markup, SQL and header injection never get stored
    ("x' OR '1'='1", "a@b.co"),
    ("<b>bold</b>", "a@b.co"),
    ("okname", "<img/src=x/onerror=alert(1)>@b.co"),
    ("okname", "a\"onmouseover=\"x@b.co"),
    ("okname", "a@b.co\r\nBcc:x@evil.co"),
    ("okname", "a" * 250 + "@b.co"),
])
def test_account_validation(client, username, email):
    with app.db() as conn:
        with pytest.raises(app.Invalid):
            app.create_account(conn, username, email)
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_an_invited_student_chooses_a_password_and_is_signed_in(client):
    with app.db() as conn:
        uid = app.create_account(conn, "anna", "anna@example.com")
        link = app.new_reset_link(conn, uid, welcome=True)
        conn.commit()
    assert "/account.html?welcome=" in link
    token = link.split("welcome=")[1]
    # no password yet: nothing signs in, not even an empty one
    for pw in ("", "!", "anything123"):
        assert client.post("/api/login", json={"identifier": "anna", "password": pw}).status_code in (400, 401)
    assert client.post("/api/welcome", json={"token": token}).json() == {"username": "anna"}
    assert client.post("/api/welcome", json={"token": "nope"}).status_code == 400
    r = client.post("/api/reset-password", json={"token": token, "password": "annas-password"})
    assert r.status_code == 200 and r.json()["user"]["username"] == "anna"
    assert client.get("/api/me").status_code == 200                     # signed in at once
    assert client.post("/api/reset-password", json={"token": token, "password": "again12345"}).status_code == 400
    client.post("/api/logout", json={})
    assert client.post("/api/login", json={"identifier": "anna", "password": "annas-password"}).status_code == 200


def test_an_invitation_expires_after_a_week(client):
    with app.db() as conn:
        uid = app.create_account(conn, "anna", "anna@example.com")
        token = app.new_reset_link(conn, uid, welcome=True).split("welcome=")[1]
        conn.execute("UPDATE password_resets SET expires = ?", (time.time() - 1,))
        conn.commit()
    assert client.post("/api/welcome", json={"token": token}).status_code == 400
    assert client.post("/api/reset-password", json={"token": token, "password": "annas-password"}).status_code == 400


# ----------------------------------------------------------------------- login

def test_login_success_and_wrong_password(client):
    register(client)
    client.post("/api/logout", json={})
    ok = client.post("/api/login", json={"identifier": "alice", "password": "hunter2pw"})
    assert ok.status_code == 200
    bad = client.post("/api/login", json={"identifier": "alice", "password": "WRONG"})
    assert bad.status_code == 401


def test_login_by_email_case_insensitive(client):
    register(client)
    client.post("/api/logout", json={})
    r = client.post("/api/login", json={"identifier": "ALICE@EXAMPLE.COM", "password": "hunter2pw"})
    assert r.status_code == 200


def test_me_requires_auth(client):
    assert client.get("/api/me").status_code == 401


def test_login_does_not_leak_which_accounts_exist(client):
    """An unknown identifier must cost the same scrypt work as a real one.
    Returning early skipped the hash, so a ~30ms vs ~1ms gap enumerated every
    registered username and email."""
    register(client)
    client.post("/api/logout", json={})

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
    blob = {"1991_academy:xp:v1": '{"total": 140}', "1991_academy:progress:v1": "{}"}
    assert client.put("/api/state", json={"data": blob}).status_code == 200
    got = client.get("/api/state").json()
    assert got["data"]["1991_academy:xp:v1"] == '{"total": 140}'
    # opt in → XP should surface on the all-time leaderboard
    client.post("/api/leaderboard-optin", json={"optIn": True})
    lb = client.get("/api/leaderboard").json()
    assert lb["top"] and lb["top"][0]["username"] == "alice" and lb["top"][0]["xp"] == 140
    assert lb["you"] == 1



# The storage prefix was "martinium:" before the project was renamed. Progress
# saved under it must survive: accounts synced before the rename, and pages
# still open from before it, send and hold the old keys.

def test_legacy_prefixed_state_is_renamed_and_counts(client):
    register(client)
    blob = {"martinium:xp:v1": '{"total": 77}', "martinium:progress:v1": '{"done": {"web-1-1": 1}}'}
    assert client.put("/api/state", json={"data": blob}).status_code == 200
    got = client.get("/api/state").json()["data"]
    assert got == {"1991_academy:xp:v1": '{"total": 77}', "1991_academy:progress:v1": '{"done": {"web-1-1": 1}}'}
    client.post("/api/leaderboard-optin", json={"optIn": True})
    assert client.get("/api/leaderboard").json()["top"][0]["xp"] == 77


def test_current_key_wins_over_legacy_one(client):
    register(client)
    blob = {"martinium:xp:v1": '{"total": 1}', "1991_academy:xp:v1": '{"total": 2}'}
    client.put("/api/state", json={"data": blob})
    assert client.get("/api/state").json()["data"] == {"1991_academy:xp:v1": '{"total": 2}'}


def test_init_db_migrates_stored_legacy_blobs(client):
    register(client)
    client.put("/api/state", json={"data": {}})
    # a blob as a pre-rename server stored it; the draft's text mentions the old
    # prefix, and values must never be rewritten
    old = {"martinium:xp:v1": '{"total": 5}', "martinium:draft:ex:web-1-1:0": 'print("martinium:")'}
    with app.db() as conn:
        conn.execute("UPDATE state SET data = ?", (json.dumps(old),))
        conn.commit()
    app.init_db()
    with app.db() as conn:
        stored = json.loads(conn.execute("SELECT data FROM state").fetchone()["data"])
    assert stored == {"1991_academy:xp:v1": '{"total": 5}', "1991_academy:draft:ex:web-1-1:0": 'print("martinium:")'}
    app.init_db()  # idempotent
    with app.db() as conn:
        assert json.loads(conn.execute("SELECT data FROM state").fetchone()["data"]) == stored

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
    blob = {"1991_academy:xp:v1": json.dumps({"total": total}),
            "1991_academy:progress:v1": '{"done": {"web-1-1": 1}}'}
    r = client.put("/api/state", json={"data": blob})
    assert r.status_code == 200, r.text
    # the progress half must have been persisted
    got = client.get("/api/state").json()
    assert got["data"]["1991_academy:progress:v1"] == '{"done": {"web-1-1": 1}}'
    # ...and nothing absurd reached the leaderboard
    client.post("/api/leaderboard-optin", json={"optIn": True})
    top = client.get("/api/leaderboard?period=all").json()["top"]
    assert top == [] or top[0]["xp"] <= app.MAX_XP


def test_xp_is_clamped_to_a_sane_ceiling(client):
    register(client)
    client.post("/api/leaderboard-optin", json={"optIn": True})
    client.put("/api/state", json={"data": {"1991_academy:xp:v1": json.dumps({"total": 10 ** 12})}})
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
    client.put("/api/state", json={"data": {"1991_academy:xp:v1": '{"total": 42}'}})
    raw = client.get("/api/state").content.decode()
    json.loads(raw, parse_constant=_reject_constant)


def _reject_constant(c):
    raise AssertionError(f"non-standard JSON constant in response: {c}")


# ------------------------------------------------------------------ leaderboard

def test_leaderboard_weekly_vs_alltime(client):
    register(client)
    client.post("/api/leaderboard-optin", json={"optIn": True})
    client.put("/api/state", json={"data": {"1991_academy:xp:v1": '{"total": 50}'}})

    # fresh account: this week's XP == lifetime XP
    wk = client.get("/api/leaderboard?period=week").json()
    assert wk["period"] == "week"
    assert wk["top"][0]["xp"] == 50

    # simulate a week rollover: pretend the stored week is old, then sync more XP.
    with app.db() as conn:
        conn.execute("UPDATE users SET week_id = '1999-W01' WHERE username = 'alice'")
        conn.commit()
    client.put("/api/state", json={"data": {"1991_academy:xp:v1": '{"total": 65}'}})

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
    client.post("/api/logout", json={})
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
    client.put("/api/state", json={"data": {"1991_academy:xp:v1": '{"total": 10}'}})
    assert client.post("/api/delete-account", json={"password": "WRONG"}).status_code == 403
    assert client.post("/api/delete-account", json={"password": "hunter2pw"}).status_code == 200
    # session gone, login impossible, username free for a new account
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/login", json={"identifier": "alice", "password": "hunter2pw"}).status_code == 401
    assert register(client).status_code == 200


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
    assert h["revision"] is None  # no REVISION file outside a Docker image


def test_health_reports_the_deployed_revision(client, monkeypatch):
    # `make status` and CI's Docker smoke test read this to see which commit is live
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
    # inside the Docker image (/app) next to the site, but never web-visible
    "/REVISION",
    "/requirements.lock",
    "/deploy/backup.sh",
    # the rest of the Docker setup and CI
    "/Dockerfile",
    "/docker-compose.yml",
    "/docker-compose.local.yml",
    "/Makefile",
    "/.env.example",
    "/.env",
    "/deploy/Caddyfile",
    "/.github/workflows/ci.yml",
    # the notebook generator, and the exercises' reference solutions
    "/tools/build_notebooks.py",
    "/tools/site_data.js",
    "/tests/content/solutions/lab-two-sum.py",
])
def test_non_web_files_are_not_served(client, path):
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("path", [
    "/index.html", "/lab.html", "/missions.html", "/practice.html", "/account.html", "/privacy.html",
    "/tracks/web.html",
    "/css/tokens.css",
    "/js/colab.js",
    "/assets/colab/en/lab-two-sum.ipynb",
    "/assets/colab/hy/prog-1-1-ex1.ipynb",
    "/js/data/lab.js",
    # course materials are arbitrary file types, INCLUDING .py starter files —
    # an extension blocklist used to 404 these download links.
    "/assets/courses/ml/HW/1/knn.py",
    "/assets/courses/ml/HW/1/HW1.ipynb",
    "/assets/courses/ml/HW/1/car.csv",
])
def test_site_files_are_served(client, path):
    register(client)
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


def test_notebooks_are_always_revalidated(client, monkeypatch):
    """The exercise notebooks change with the exercises; other course files are
    cached for a day. (Debug mode sends no-store everywhere, so turn it off.)"""
    monkeypatch.setattr(app, "DEBUG", False)
    register(client)
    notebook = client.get("/assets/colab/en/lab-two-sum.ipynb")
    assert notebook.status_code == 200 and notebook.headers["Cache-Control"] == "no-cache"
    assert json.loads(notebook.content)["cells"]
    pdf = client.get("/assets/courses/math/Homeworks/Homework%201.pdf")
    assert pdf.headers["Cache-Control"] == "private, max-age=86400"   # the student's browser only


def test_security_headers_include_csp(client):
    r = client.get("/api/health")
    csp = r.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "object-src 'none'" in csp
    # KaTeX still loads from jsDelivr, but only that one release...
    script_src = next(d for d in csp.split("; ") if d.startswith("script-src "))
    assert script_src == "script-src 'self' https://cdn.jsdelivr.net/npm/katex@0.16.11/"
    # ...no inline script runs (injected markup stays inert)...
    assert "unsafe-inline" not in script_src
    # ...and no page runs learners' code any more (that happens in Colab)
    assert "unsafe-eval" not in csp and "blob:" not in csp


def test_no_page_has_inline_scripts_or_handlers(client):
    """The CSP blocks inline scripts, so a page that had one would silently
    break. Every external script it loads carries an integrity hash."""
    pages = [p for p in app.PAGE_FILES if p.endswith(".html")]
    pages += ["tracks/" + p.name for p in (app.ROOT / "tracks").glob("*.html")]
    for page in pages:
        html = (app.ROOT / page).read_text(encoding="utf-8")
        assert not re.search(r"<script(?![^>]*\bsrc=)[^>]*>", html), page
        assert not re.search(r"\son[a-z]+\s*=", html), page
        assert "javascript:" not in html, page
        for tag in re.findall(r"<(?:script|link)[^>]*https://[^>]*>", html):
            if "fonts.g" not in tag:   # Google Fonts' CSS varies by browser: no fixed hash
                assert 'integrity="sha384-' in tag and 'crossorigin="anonymous"' in tag, (page, tag)


# ------------------------------------------- injection, forgery, search engines

@pytest.mark.parametrize("identifier", [
    "' OR '1'='1", "' OR 1=1 --", "admin'--", "\" OR \"\"=\"",
    "alice' UNION SELECT pass_hash FROM users --", "1; DROP TABLE users",
])
def test_sql_injection_in_login_gets_nowhere(client, identifier):
    register(client)
    client.post("/api/logout", json={})
    r = client.post("/api/login", json={"identifier": identifier, "password": "' OR '1'='1"})
    assert r.status_code == 401
    # the tables are all still there and intact
    with app.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


def test_sql_injection_is_stored_as_plain_text(client):
    """State values are data: SQL in them is saved and handed back verbatim."""
    register(client)
    evil = "'); DROP TABLE users; --"
    assert client.put("/api/state", json={"data": {"k": evil}}).status_code == 200
    assert client.get("/api/state").json()["data"] == {"k": evil}
    assert client.get("/api/me").status_code == 200


@pytest.mark.parametrize("body", ["[]", "[1, 2]", "42", '"text"', "null", "[" * 50_000 + "]" * 50_000])
def test_non_object_json_is_a_400_not_a_crash(client, body):
    for path in ("/api/login", "/api/forgot-password", "/api/reset-password", "/api/welcome"):
        r = client.post(path, content=body, headers={"Content-Type": "application/json"})
        assert r.status_code == 400, (path, body[:10], r.status_code)


@pytest.mark.parametrize("ctype", [
    None,                                   # <img>/fetch with no body type
    "application/x-www-form-urlencoded",    # a plain <form method=post>
    "multipart/form-data; boundary=x",      # <form enctype=multipart/form-data>
    "text/plain",                           # <form enctype=text/plain>, the classic JSON-CSRF trick
])
def test_api_writes_must_be_json(client, ctype):
    """Cross-site forms can only send these types; JSON needs a CORS preflight
    this API never grants. So a forged request is refused before it runs."""
    register(client)
    headers = {"Content-Type": ctype} if ctype else {}
    body = '{"optIn": true}'
    for method, path in [("POST", "/api/leaderboard-optin"), ("POST", "/api/logout"),
                         ("PUT", "/api/state"), ("POST", "/api/delete-account")]:
        r = client.request(method, path, content=body, headers=headers)
        assert r.status_code == 415, (method, path, r.status_code)
    assert client.get("/api/me").status_code == 200    # still signed in, account intact
    assert client.get("/api/me").json()["user"]["leaderboardOptIn"] is False


def test_api_has_no_cors(client):
    r = client.options("/api/login", headers={"Origin": "https://evil.example",
                                              "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in r.headers


def test_robots_txt(client):
    r = client.get("/robots.txt")
    assert r.status_code == 200
    assert "Disallow: /\n" in r.text           # a closed school: nothing to index


@pytest.mark.parametrize("path", [
    "/", "/index.html", "/tracks/web.html", "/privacy.html", "/account.html",
    "/assets/courses/math/Homeworks/Homework%201.pdf", "/assets/colab/en/lab-two-sum.ipynb", "/api/health",
])
def test_search_engines_index_nothing(client, path):
    register(client)
    r = client.get(path)
    assert r.status_code == 200, path
    assert r.headers["X-Robots-Tag"] == "noindex, nofollow", path


# ------------------------------------------------ a closed school: who sees what

PRIVATE_PAGES = ["/", "/index.html", "/lab.html", "/missions.html", "/practice.html", "/admin.html",
                 "/tracks/web.html", "/tracks/math.html"]
PRIVATE_FILES = ["/js/data/web.js", "/js/data/i18n-hy-web.js", "/js/data/lab.js", "/assets/colab/en/lab-two-sum.ipynb",
                 "/assets/courses/ml/HW/1/knn.py", "/assets/courses/math/Homeworks/Homework%201.pdf"]
PUBLIC_FILES = ["/account.html", "/privacy.html", "/robots.txt", "/css/tokens.css", "/js/common.js",
                "/js/i18n.js", "/js/auth.js", "/js/account-page.js", "/js/custom-content.js"]


def test_visitors_see_only_the_sign_in_page(client):
    for path in PRIVATE_PAGES:
        r = client.get(path, follow_redirects=False)
        assert r.status_code == 303, path
        assert r.headers["location"] == "/account.html?next=" + path, path
    for path in PRIVATE_FILES:
        assert client.get(path).status_code == 401, path      # lessons and course files too
    for path in PUBLIC_FILES:
        assert client.get(path).status_code == 200, path
    assert client.get("/api/leaderboard").status_code == 401
    assert client.get("/api/auth-check").status_code == 401


def test_a_forged_or_expired_session_is_a_visitor(client):
    client.cookies.set("msession", "f" * 64)
    assert client.get("/index.html", follow_redirects=False).status_code == 303
    client.cookies.clear()
    register(client)
    assert client.get("/index.html").status_code == 200
    with app.db() as conn:
        conn.execute("UPDATE sessions SET created = ?", (time.time() - app.SESSION_TTL - 1,))
        conn.commit()
    assert client.get("/index.html", follow_redirects=False).status_code == 303
    assert client.get("/js/data/web.js").status_code == 401


def test_signing_out_closes_the_site_again(client):
    register(client)
    assert client.get("/tracks/web.html").status_code == 200
    assert client.get("/api/auth-check").status_code == 204
    client.post("/api/logout", json={})
    assert client.get("/tracks/web.html", follow_redirects=False).status_code == 303
    assert client.get("/api/auth-check").status_code == 401


def test_the_sign_in_page_gets_announcements_but_no_lessons(client):
    with TestClient(app.app) as admin:
        register(admin, "boss", "boss@example.com")
        assert app.cli(["admin", "add", "boss"]) == 0
        admin.put("/api/admin/lessons/web-2-9", json={
            "track": "web", "module": "web-m2", "published": True, "title": "Secret lesson", "minutes": 5,
            "content": "<p>for students only</p>"})
        admin.post("/api/admin/announcements", json={"text": "Exams on Monday"})
        assert "for students only" in admin.get("/api/content.js").text
    text = client.get("/api/content.js").text
    assert "Exams on Monday" in text and "for students only" not in text


@pytest.mark.parametrize("path", [
    "/assets/", "/assets/courses/", "/assets/courses/ml/", "/tracks/", "/css/", "/js/data/",
    "/.git/config", "/.git/HEAD", "/.env", "/backups/", "/assets/courses/.DS_Store",
    "/server-status", "/phpmyadmin/", "/wp-admin/",
    "/admin", "/.well-known/../app.py", "/%2e%2e/app.py", "/css/%2e%2e/app.py",
])
def test_nothing_for_a_dork_to_find(client, path, monkeypatch):
    """No directory listings, no repository or secrets, whatever the path a
    scanner tries."""
    monkeypatch.setattr(app, "DEBUG", False)
    assert client.get(path).status_code == 404, path


def test_api_docs_are_off_in_production():
    # The docs routes are chosen when the app is built; the Docker image sets
    # ACADEMY_DEBUG=0, which turns them off.
    out = subprocess.run(
        [sys.executable, "-c", "import app; print(app.app.docs_url, app.app.openapi_url)"],
        cwd=app.ROOT, env={**os.environ, "ACADEMY_DEBUG": "0"},
        capture_output=True, text=True, check=True,
    ).stdout.split()
    assert out == ["None", "None"]


def test_course_notebooks_carry_no_author_account_data():
    """Colab stamps every executed cell with the Google account that ran it
    (name, account id, photo URL). The published copies must not."""
    leaks = [str(p) for p in (app.ROOT / "assets").rglob("*.ipynb")
             if re.search(r'"(userId|photoUrl|executionInfo)"', p.read_text(encoding="utf-8"))]
    assert leaks == [], (
        "strip Colab's executionInfo from: %s\n(e.g. python3 -c \"import json,sys; f=sys.argv[1]; nb=json.load(open(f)); "
        "[c.get('metadata', {}).pop('executionInfo', None) for c in nb['cells']]; "
        "json.dump(nb, open(f, 'w'), indent=1, ensure_ascii=False)\" FILE)" % leaks)


# ----------------------------------------------------------------- hygiene

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
    big = {"data": {"1991_academy:xp:v1": "x" * (app.MAX_BODY + 1000)}}
    assert client.put("/api/state", json=big).status_code == 413


def test_schema_is_ready_without_calling_init_db(tmp_path, monkeypatch):
    """A uvicorn/gunicorn deployment never runs __main__, so the lifespan
    handler must create the schema on startup."""
    monkeypatch.setattr(app, "DB_PATH", str(tmp_path / "lifespan.db"))
    app._BUCKETS.clear()
    with TestClient(app.app) as c:           # entering runs the lifespan
        # no account yet, but the tables are there: a clean 401, not a 500
        assert c.post("/api/login", json={"identifier": "bob", "password": "hunter2pw"}).status_code == 401
        with app.db() as conn:
            assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
