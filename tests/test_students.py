"""Adding students: temporary passwords, and the first sign-in.

The site sends no email. An admin adds students; each gets a temporary
password (shown to the admin once), which the admin sends from their own
mailbox. It works for TEMP_PASSWORD_TTL, once, and only to choose the
student's own password.
"""
import logging
import re
import sys
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app  # noqa: E402

TEMP_RE = re.compile(r"^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$")


@pytest.fixture
def admin(tmp_path, monkeypatch):
    monkeypatch.setattr(app, "DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setattr(app, "BASE_URL", "https://academy.example.am")
    app._BUCKETS.clear()
    app.init_db()
    with app.db() as conn:
        app.create_account(conn, "boss", "boss@example.com", "boss-password")
        conn.execute("UPDATE users SET is_admin = 1 WHERE username = 'boss'")
        conn.commit()
    with TestClient(app.app) as c:
        assert c.post("/api/login", json={"identifier": "boss", "password": "boss-password"}).status_code == 200
        yield c


def add(client, *emails):
    return client.post("/api/admin/students", json={"students": [{"email": e} for e in emails]})


def first(client, who, temp, new):
    return client.post("/api/first-password", json={"identifier": who, "password": temp, "newPassword": new})


# ------------------------------------------------------------------ adding

def test_added_students_get_a_temporary_password_shown_once(admin, caplog):
    caplog.set_level(logging.INFO, logger="academy")
    r = add(admin, "anna@example.com", "Arman@Example.com")
    out = r.json()
    assert r.status_code == 200 and out["days"] == 14 and out["site"] == "https://academy.example.am/account.html"
    assert out["warning"] is None
    anna, arman = out["results"]
    assert (anna["username"], arman["username"], arman["email"]) == ("anna", "arman", "arman@example.com")
    assert TEMP_RE.match(anna["password"]) and anna["password"] != arman["password"]
    with app.db() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = 'anna'").fetchone()
    assert row["must_change_password"] == 1
    assert 13.9 * 86400 < row["temp_password_expires"] - time.time() <= 14 * 86400
    assert anna["password"] not in row["pass_hash"]                     # only its hash is stored
    # shown this once: no other answer and no log line has it
    later = admin.get("/api/admin/users?q=anna").text + admin.get("/api/admin/users/anna").text + admin.get("/api/admin/log").text
    assert anna["password"] not in later and anna["password"] not in caplog.text
    assert ("add-student", "anna") in [(e["action"], e["target"]) for e in admin.get("/api/admin/log").json()["entries"]]
    assert admin.get("/api/admin/users/anna").json()["learner"]["new"] is True
    assert admin.get("/api/admin/overview").json()["new"] == 2


def test_a_local_address_is_flagged(admin, monkeypatch):
    monkeypatch.setattr(app, "BASE_URL", "http://localhost:8735")
    assert "works only on the computer running the site" in add(admin, "a@example.com").json()["warning"]


@pytest.mark.parametrize("email", ["not-an-email", "<b>@x.am", "a@x.am\r\nBcc: v@x.am", "a@x.am, b@x.am", "a" * 300 + "@x.am"])
def test_bad_addresses_are_refused(admin, email):
    result = add(admin, email).json()["results"][0]
    assert "error" in result and "password" not in result


def test_duplicates_make_one_account(admin):
    r = add(admin, "anna@example.com", "ANNA@example.com").json()["results"]
    assert "password" in r[0] and "already has an account" in r[1]["error"]
    assert "already has an account" in add(admin, "anna@example.com").json()["results"][0]["error"]


def test_two_admins_adding_the_same_student_at_once(admin):
    out = []
    def go():
        with TestClient(app.app) as c:
            c.cookies.update(admin.cookies)
            out.append(add(c, "anna@example.com").json()["results"][0])
    threads = [threading.Thread(target=go) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sum(1 for x in out if "password" in x) == 1
    with app.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users WHERE email = 'anna@example.com'").fetchone()[0] == 1


@pytest.mark.parametrize("body", [{}, {"students": []}, {"students": "x"}, {"students": ["x"]},
                                  {"students": [{"email": "a@b.co"}] * 201}])
def test_bad_requests(admin, body):
    assert admin.post("/api/admin/students", json=body).status_code == 400


def test_only_admins_add_students_or_give_passwords(admin):
    add(admin, "anna@example.com")
    with TestClient(app.app) as visitor:
        assert visitor.post("/api/admin/students", json={"students": [{"email": "x@example.com"}]}).status_code == 401
        assert visitor.post("/api/admin/users/anna/temp-password", json={}).status_code == 401
    with app.db() as conn:
        app.create_account(conn, "pupil", "pupil@example.com", "pupil-password")
        conn.commit()
    with TestClient(app.app) as student:
        student.post("/api/login", json={"identifier": "pupil", "password": "pupil-password"})
        assert student.post("/api/admin/students", json={"students": [{"email": "x@example.com"}]}).status_code == 403
        assert student.post("/api/admin/users/anna/temp-password", json={}).status_code == 403


# ------------------------------------------------------------- first sign-in

def test_first_sign_in_end_to_end(admin):
    temp = add(admin, "anna@example.com").json()["results"][0]["password"]
    with TestClient(app.app) as anna:
        r = anna.post("/api/login", json={"identifier": "anna", "password": temp})
        assert r.status_code == 403 and r.json()["mustChangePassword"] is True and r.json()["username"] == "anna"
        assert "msession" not in r.headers.get("set-cookie", "")         # no session from a temporary password
        assert anna.get("/index.html", follow_redirects=False).status_code == 303
        assert first(anna, "anna", "wrong-temp-pass", "annas-password").status_code == 401
        assert first(anna, "anna", temp, temp).status_code == 400          # not the temporary one again
        assert first(anna, "anna", temp, "short").status_code == 400
        r = first(anna, "ANNA@example.com", temp, "annas-password")        # by email, any case
        assert r.status_code == 200 and r.json()["user"]["username"] == "anna"
        assert anna.get("/index.html").status_code == 200                  # signed in
    # the temporary password is spent; her own works
    with TestClient(app.app) as c:
        assert c.post("/api/login", json={"identifier": "anna", "password": temp}).status_code == 401
        assert first(c, "anna", temp, "another-pass").status_code == 401
        assert c.post("/api/login", json={"identifier": "anna", "password": "annas-password"}).status_code == 200
    assert admin.get("/api/admin/users/anna").json()["learner"]["new"] is False


def test_a_temporary_password_works_once_even_twice_at_once(admin, monkeypatch):
    temp = add(admin, "anna@example.com").json()["results"][0]["password"]
    slow = app.hash_password
    monkeypatch.setattr(app, "hash_password", lambda p, s: (time.sleep(0.2), slow(p, s))[1])
    wins = []
    threads = [threading.Thread(target=lambda pw=pw: wins.append(app._first_password("anna", temp, pw)[0]))
               for pw in ("first-password", "second-password")]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sum(1 for w in wins if w) == 1


def test_an_expired_temporary_password_says_so(admin):
    temp = add(admin, "anna@example.com").json()["results"][0]["password"]
    with app.db() as conn:
        conn.execute("UPDATE users SET temp_password_expires = ? WHERE username = 'anna'", (time.time() - 1,))
        conn.commit()
    with TestClient(app.app) as anna:
        r = anna.post("/api/login", json={"identifier": "anna", "password": temp})
        assert r.status_code == 401 and "expired" in r.json()["error"]
        assert first(anna, "anna", temp, "annas-password").status_code == 401


def test_guessing_a_temporary_password_is_paused(admin):
    add(admin, "anna@example.com")
    with TestClient(app.app) as attacker:
        codes = [first(attacker, "anna", f"aaaa-bbbb-{i:04d}", "attackers-pw").status_code
                 for i in range(app.IP_LOGIN_FAILS + 1)]
    assert 429 in codes and 200 not in codes


def test_a_temporary_password_is_long_and_random():
    passwords = {app.temp_password() for _ in range(2000)}
    assert len(passwords) == 2000 and all(TEMP_RE.match(p) for p in passwords)
    assert not any(c in "".join(passwords) for c in "01ilo")              # no look-alikes


# ------------------------------------------------- a new temporary password

def test_a_student_who_forgot_gets_a_new_temporary_password(admin):
    with app.db() as conn:
        app.create_account(conn, "anna", "anna@example.com", "old-password")
        conn.commit()
    with TestClient(app.app) as anna:
        anna.post("/api/login", json={"identifier": "anna", "password": "old-password"})
        assert anna.get("/api/me").status_code == 200
        out = admin.post("/api/admin/users/anna/temp-password", json={}).json()
        assert TEMP_RE.match(out["password"]) and out["days"] == 14 and out["email"] == "anna@example.com"
        assert anna.get("/api/me").status_code == 401                     # signed out everywhere
    with TestClient(app.app) as c:
        assert c.post("/api/login", json={"identifier": "anna", "password": "old-password"}).status_code == 401
        assert first(c, "anna", out["password"], "new-password").status_code == 200
    assert ("temp-password", "anna") in [(e["action"], e["target"]) for e in admin.get("/api/admin/log").json()["entries"]]


def test_no_temporary_password_for_an_admin_from_the_panel(admin):
    with app.db() as conn:
        app.create_account(conn, "boss2", "boss2@example.com", "boss2-password")
        conn.execute("UPDATE users SET is_admin = 1 WHERE username = 'boss2'")
        conn.commit()
    assert admin.post("/api/admin/users/boss2/temp-password", json={}).status_code == 409
    assert admin.post("/api/admin/users/boss/temp-password", json={}).status_code == 409   # nor yourself


# ------------------------------------------------------------- the server

def test_the_first_admin_and_lost_passwords_on_the_command_line(admin, capsys):
    assert app.cli(["admin", "add", "newboss", "newboss@example.com"]) == 0
    temp = re.search(r"Temporary password: (\S+)", capsys.readouterr().out).group(1)
    with TestClient(app.app) as c:
        assert c.post("/api/login", json={"identifier": "newboss", "password": temp}).status_code == 403
        assert first(c, "newboss", temp, "newboss-pass").status_code == 200
        assert c.get("/api/admin/overview").status_code == 200
    assert app.cli(["password", "newboss"]) == 0
    temp2 = re.search(r"Temporary password for newboss: (\S+)", capsys.readouterr().out).group(1)
    with TestClient(app.app) as c:
        assert first(c, "newboss", temp2, "newboss-pass2").status_code == 200
    assert app.cli(["password", "ghost"]) == 1
    assert app.cli(["admin", "add", "ghost"]) == 1                      # no account and no email


def test_accounts_from_the_old_invitation_links_wait_for_a_temporary_password(admin):
    with app.db() as conn:
        conn.execute("INSERT INTO users (username, email, pass_hash, salt, created) VALUES ('old', 'old@example.com', '!', '', 0)")
        conn.commit()
    app.init_db()                                                        # the migration
    with TestClient(app.app) as c:
        assert c.post("/api/login", json={"identifier": "old", "password": "!"}).status_code == 401
        temp = admin.post("/api/admin/users/old/temp-password", json={}).json()["password"]
        assert first(c, "old", temp, "olds-password").status_code == 200


def test_the_site_sends_no_email():
    source = (Path(app.__file__)).read_text(encoding="utf-8")
    assert "smtplib" not in source and "SMTP" not in source
    assert not any(hasattr(app, name) for name in ("deliver_all", "send_email", "SMTP_HOST", "SMTP_PASS"))
    for old in ("/api/forgot-password", "/api/reset-password", "/api/welcome", "/api/admin/invites"):
        assert old not in [r.path for r in app.app.routes if hasattr(r, "path")]
