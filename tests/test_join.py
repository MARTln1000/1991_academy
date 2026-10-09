"""Invitation links.

An admin makes links and sends them from their own mailbox (the site sends no
email). A link isn't tied to an address: whoever opens it types the email
they want and gets an account with a temporary password, once, within
JOIN_LINK_TTL.
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
LINK_RE = re.compile(r"^https://academy\.example\.am/account\.html#join=([A-Za-z0-9_-]{32})$")


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


def make(client, *sent_to):
    r = client.post("/api/admin/join-links", json={"sentTo": list(sent_to)})
    assert r.status_code == 200, r.text
    return r.json()


def token(link):
    return LINK_RE.match(link["link"]).group(1)


def join(client, tok, email, username=""):
    return client.post("/api/join", json={"token": tok, "email": email, "username": username})


def links(admin):
    return {l["id"]: l for l in admin.get("/api/admin/join-links").json()["links"]}


# ------------------------------------------------------------------ making

def test_links_are_made_shown_once_and_stored_hashed(admin, caplog):
    caplog.set_level(logging.INFO, logger="academy")
    out = make(admin, "anna@gmail.com", "Arman Sargsyan")
    assert out["days"] == 7 and out["warning"] is None
    a, b = out["links"]
    assert a["sentTo"] == "anna@gmail.com" and token(a) != token(b)
    with app.db() as conn:
        stored = " ".join(r["token_hash"] for r in conn.execute("SELECT token_hash FROM join_links"))
    assert token(a) not in stored and token(a) not in caplog.text
    listed = admin.get("/api/admin/join-links").text + admin.get("/api/admin/log").text
    assert token(a) not in listed
    assert [l["status"] for l in links(admin).values()] == ["waiting", "waiting"]
    entry = admin.get("/api/admin/log").json()["entries"][0]
    assert (entry["action"], entry["detail"]) == ("join-links", "2 link(s)")


@pytest.mark.parametrize("body", [{}, {"sentTo": []}, {"sentTo": "x"}, {"sentTo": [1]}, {"sentTo": ["x"] * 201}])
def test_bad_requests(admin, body):
    assert admin.post("/api/admin/join-links", json=body).status_code == 400


def test_only_admins_make_or_see_links(admin):
    link = make(admin, "anna")["links"][0]
    with app.db() as conn:
        app.create_account(conn, "pupil", "pupil@example.com", "pupil-password")
        conn.commit()
    with TestClient(app.app) as visitor:
        assert visitor.post("/api/admin/join-links", json={"sentTo": ["x"]}).status_code == 401
        assert visitor.get("/api/admin/join-links").status_code == 401
        visitor.post("/api/login", json={"identifier": "pupil", "password": "pupil-password"})
        assert visitor.post("/api/admin/join-links", json={"sentTo": ["x"]}).status_code == 403
        assert visitor.get("/api/admin/join-links").status_code == 403
        assert visitor.post(f"/api/admin/join-links/{link['id']}/cancel", json={}).status_code == 403


def test_a_local_address_is_flagged(admin, monkeypatch):
    monkeypatch.setattr(app, "BASE_URL", "http://localhost:8735")
    assert "works only on the computer running the site" in make(admin, "x")["warning"]


# ----------------------------------------------------------------- joining

def test_joining_end_to_end(admin):
    link = make(admin, "anna@school.am")["links"][0]
    with TestClient(app.app) as anna:
        assert anna.post("/api/join/check", json={"token": token(link)}).json() == {"ok": True, "days": 14}
        r = join(anna, token(link), "Anna.K@Gmail.com")              # not the address it was sent to
        out = r.json()
        assert r.status_code == 200 and out["username"] == "anna_k" and out["email"] == "anna.k@gmail.com"
        assert TEMP_RE.match(out["password"]) and out["days"] == 14
        assert "msession" not in r.headers.get("set-cookie", "")       # no session yet
        assert anna.get("/index.html", follow_redirects=False).status_code == 303
        # the temporary password works only for the email typed, to choose her own
        assert anna.post("/api/login", json={"identifier": "anna@school.am", "password": out["password"]}).status_code == 401
        assert anna.post("/api/login", json={"identifier": "anna.k@gmail.com", "password": out["password"]}).status_code == 403
        r = anna.post("/api/first-password", json={"identifier": "anna.k@gmail.com", "password": out["password"],
                                                   "newPassword": "annas-password"})
        assert r.status_code == 200 and anna.get("/index.html").status_code == 200
    # in the admin panel, and on the leaderboard
    assert links(admin)[link["id"]]["status"] == "used" and links(admin)[link["id"]]["usedBy"] == "anna_k"
    learner = admin.get("/api/admin/users/anna_k").json()["learner"]
    assert learner["optIn"] is True and learner["new"] is False


def test_a_chosen_username(admin):
    tok = token(make(admin, "x")["links"][0])
    with TestClient(app.app) as c:
        assert join(c, tok, "a@example.com", "bad name!").status_code == 400
        assert join(c, tok, "a@example.com", "boss").status_code == 400          # taken
        assert join(c, tok, "a@example.com", "Ani_99").json()["username"] == "Ani_99"


def test_a_link_works_once(admin):
    tok = token(make(admin, "x")["links"][0])
    with TestClient(app.app) as c:
        assert join(c, tok, "first@example.com").status_code == 200
        r = join(c, tok, "second@example.com")
        assert r.status_code == 410 and r.json()["problem"] == "used"
        assert c.post("/api/join/check", json={"token": tok}).json()["problem"] == "used"
    with app.db() as conn:
        assert conn.execute("SELECT 1 FROM users WHERE email = 'second@example.com'").fetchone() is None


def test_a_link_works_once_even_twice_at_once(admin):
    tok = token(make(admin, "x")["links"][0])
    out = []
    threads = [threading.Thread(target=lambda i=i: out.append(app._join(tok, f"s{i}@example.com", "")[0]))
               for i in range(5)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sum(1 for x in out if x) == 1
    with app.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 2         # boss and one student


def test_a_rejected_email_leaves_the_link_unused(admin):
    tok = token(make(admin, "x")["links"][0])
    with TestClient(app.app) as c:
        for bad in ("not-an-email", "a@x.am\r\nBcc: v@x.am", "boss@example.com", "BOSS@example.com"):
            r = join(c, tok, bad)
            assert r.status_code == 400 and "problem" not in r.json()
        assert join(c, tok, "fine@example.com").status_code == 200


def test_an_expired_link(admin):
    link = make(admin, "x")["links"][0]
    with app.db() as conn:
        conn.execute("UPDATE join_links SET expires = ?", (time.time() - 1,))
        conn.commit()
    with TestClient(app.app) as c:
        r = join(c, token(link), "a@example.com")
        assert r.status_code == 410 and r.json()["problem"] == "expired"
    assert links(admin)[link["id"]]["status"] == "expired"
    assert admin.post(f"/api/admin/join-links/{link['id']}/cancel", json={}).status_code == 409


def test_a_cancelled_link(admin):
    link = make(admin, "x")["links"][0]
    assert admin.post(f"/api/admin/join-links/{link['id']}/cancel", json={}).status_code == 200
    with TestClient(app.app) as c:
        assert join(c, token(link), "a@example.com").json()["problem"] == "cancelled"
    assert links(admin)[link["id"]]["status"] == "cancelled"
    assert admin.post(f"/api/admin/join-links/{link['id']}/cancel", json={}).status_code == 409
    assert admin.post("/api/admin/join-links/999/cancel", json={}).status_code == 404
    assert admin.get("/api/admin/log").json()["entries"][0]["action"] == "join-link-cancel"


def test_guessing_links_is_paused(admin):
    with TestClient(app.app) as attacker:
        codes = [attacker.post("/api/join/check", json={"token": f"guess{i:027d}"}).status_code
                 for i in range(app.IP_LOGIN_FAILS + 1)]
        assert codes[:-1] == [410] * app.IP_LOGIN_FAILS and codes[-1] == 429
        # paused for real links too, from that address
        assert join(attacker, token(make(admin, "x")["links"][0]), "a@example.com").status_code == 429


@pytest.mark.parametrize("body", [{}, {"token": ""}, {"token": "x" * 101}])
def test_bad_join_requests(admin, body):
    assert admin.post("/api/join", json=body).status_code == 400
    assert admin.post("/api/join/check", json=body).status_code == 400


def test_old_links_are_swept(admin):
    make(admin, "old", "new")
    with app.db() as conn:
        conn.execute("UPDATE join_links SET expires = ? WHERE sent_to = 'old'", (time.time() - app.JOIN_LINKS_KEPT - 1,))
        conn.commit()
    app.sweep_expired()
    assert [l["sentTo"] for l in links(admin).values()] == ["new"]


def test_new_students_are_on_the_leaderboard(admin):
    out = admin.post("/api/admin/students", json={"students": [{"email": "s@example.com"}]}).json()["results"][0]
    with TestClient(app.app) as s:
        s.post("/api/first-password", json={"identifier": "s@example.com", "password": out["password"], "newPassword": "s-password"})
        assert s.get("/api/me").json()["user"]["leaderboardOptIn"] is True
        assert s.post("/api/leaderboard-optin", json={"optIn": False}).json()["optIn"] is False   # they can hide
