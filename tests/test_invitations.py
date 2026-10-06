"""The invitation emails end to end, as an audit: who may send them, what
exactly is sent, what the admin is told when the mail server fails, the
links' safety, and abuse limits. Nothing leaves the machine: the fake SMTP
class below records what app.deliver_all hands over, and the `sent_emails`
fixture (conftest.py) stands in for the whole mail server."""
import email
import json
import logging
import smtplib
import sys
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app  # noqa: E402


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


def invite(client, *emails):
    return client.post("/api/admin/invites", json={"students": [{"email": e} for e in emails]})


def token_of(text):
    return text.split("welcome=")[1].split()[0].split('"')[0]


# ------------------------------------------------------------------ what is sent

class RecordingSMTP:
    """Stands in for smtplib.SMTP: records the real EmailMessage objects that
    app.build_message produced, and can refuse recipients or the login."""
    sent, refuse, login_error, instances = [], set(), None, 0

    def __init__(self, *a, **k):
        RecordingSMTP.instances += 1

    def __enter__(self):
        return self

    def __exit__(self, *e):
        return False

    def starttls(self, context=None):
        pass

    def login(self, user, password):
        if RecordingSMTP.login_error:
            raise RecordingSMTP.login_error

    def send_message(self, msg):
        if msg["To"] in RecordingSMTP.refuse:
            raise smtplib.SMTPRecipientsRefused({msg["To"]: (550, b"no such mailbox")})
        RecordingSMTP.sent.append(msg)


@pytest.fixture
def smtp(monkeypatch):
    RecordingSMTP.sent, RecordingSMTP.refuse, RecordingSMTP.login_error, RecordingSMTP.instances = [], set(), None, 0
    monkeypatch.setattr(smtplib, "SMTP", RecordingSMTP)
    for key, value in (("SMTP_HOST", "mail.mil.am"), ("SMTP_PORT", 587), ("SMTP_USER", "ai.1991@mil.am"),
                       ("SMTP_PASS", "the-mailbox-password"), ("SMTP_FROM", "1991 Academy <ai.1991@mil.am>")):
        monkeypatch.setattr(app, key, value)
    return RecordingSMTP


def test_the_invitation_email_itself(admin, smtp):
    r = invite(admin, "anna@example.com")
    assert r.json()["results"][0]["emailed"] is True
    msg = smtp.sent[0]
    assert msg["From"] == "1991 Academy <ai.1991@mil.am>"
    assert msg["To"] == "anna@example.com"
    assert "1991 Academy" in msg["Subject"]
    assert msg["Date"] and msg["Message-ID"].endswith("@mil.am>")      # spam filters expect both
    text = msg.get_body(("plain",)).get_content()
    page = msg.get_body(("html",)).get_content()
    link = "https://academy.example.am/account.html?welcome="
    assert link in text and link in page and "localhost" not in text + page
    assert "Your username: anna" in text and "Քո օգտանունը: anna" in text      # English and Armenian
    assert "7 days" in text and "ai.1991@mil.am" in text
    # Armenian survives the trip through MIME
    raw = msg.as_bytes()
    assert "Ընտրի՛ր գաղտնաբառդ" in email.message_from_bytes(raw, policy=email.policy.default).get_body(("plain",)).get_content()
    # the link in the email works
    token = token_of(text)
    with TestClient(app.app) as student:
        assert student.post("/api/welcome", json={"token": token}).json() == {"username": "anna"}
        assert student.post("/api/reset-password", json={"token": token, "password": "annas-pass"}).status_code == 200
        assert student.get("/index.html").status_code == 200


def test_one_connection_for_a_whole_class(admin, smtp):
    r = invite(admin, *[f"s{i}@example.com" for i in range(25)])
    assert all(x.get("emailed") for x in r.json()["results"]) and len(smtp.sent) == 25
    assert smtp.instances == 1


def test_the_html_version_escapes_everything():
    subject, text, page = app.account_email("invite", '<img src=x onerror=alert(1)>"', 'https://x/a?welcome=t"><script>alert(1)</script>')
    assert "<script>" not in page and "<img" not in page and 'onerror=alert(1)>"' not in page
    assert "&lt;script&gt;" in page and "&quot;" in page


def test_no_header_injection_through_an_address(admin, smtp):
    r = admin.post("/api/admin/invites", json={"students": [
        {"email": "a@example.com\r\nBcc: victim@example.com"}, {"email": "b@example.com\nSubject: hi"},
        {"email": "c@example.com, d@example.com"}, {"email": "Eve <e@example.com>"}]})
    assert all("error" in x for x in r.json()["results"]) and smtp.sent == []
    with pytest.raises(ValueError):          # and even if one got through, the message refuses it
        app.build_message("a@example.com\r\nBcc: v@example.com", "s", "t")


# ------------------------------------------------- the mail server fails: the truth

def test_one_refused_address_doesnt_stop_the_others(admin, smtp):
    smtp.refuse = {"bad@example.com"}
    r = invite(admin, "ok1@example.com", "bad@example.com", "ok2@example.com").json()
    by = {x["email"]: x for x in r["results"]}
    assert by["ok1@example.com"]["emailed"] and by["ok2@example.com"]["emailed"]
    assert by["bad@example.com"]["emailError"] == "The mail server refused this address."
    assert "emailed" not in by["bad@example.com"] and "link" not in by["bad@example.com"]


def test_mail_server_down_or_wrong_password_is_reported_not_hidden(admin, smtp):
    smtp.login_error = smtplib.SMTPAuthenticationError(535, b"bad")
    r = invite(admin, "anna@example.com", "arman@example.com").json()
    assert r["sent"] is True and all("refused the site's mailbox login" in x["emailError"] for x in r["results"])
    assert "welcome=" not in json.dumps(r)                       # no link to the admin, even now
    # the accounts exist: once fixed, "Resend the invitation" sends them
    smtp.login_error = None
    out = admin.post("/api/admin/users/anna/reset-link", json={})
    assert out.status_code == 200 and out.json()["sent"] is True and out.json()["invite"] is True
    assert smtp.sent[-1]["To"] == "anna@example.com"


def test_a_failed_resend_says_so(admin, smtp):
    invite(admin, "anna@example.com")
    smtp.login_error = OSError("connection timed out")
    r = admin.post("/api/admin/users/anna/reset-link", json={})
    assert r.status_code == 502 and r.json()["error"] == "The mail server couldn't be reached."


def test_the_mailbox_password_never_leaves_the_server(admin, smtp, caplog):
    caplog.set_level(logging.INFO, logger="academy")
    smtp.login_error = smtplib.SMTPAuthenticationError(535, b"bad")
    responses = [invite(admin, "anna@example.com").text, admin.post("/api/admin/users/anna/reset-link", json={}).text,
                 admin.get("/api/health").text, admin.get("/api/admin/overview").text, admin.get("/api/content.js").text]
    assert not any("the-mailbox-password" in r for r in responses)
    assert "the-mailbox-password" not in caplog.text


# ------------------------------------------------------------------ the links

def test_a_link_works_once_even_when_submitted_twice_at_once(admin, sent_emails, monkeypatch):
    invite(admin, "anna@example.com")
    token = token_of(sent_emails[0][2])
    slow = app.hash_password
    monkeypatch.setattr(app, "hash_password", lambda p, s: (time.sleep(0.2), slow(p, s))[1])
    wins = []
    threads = [threading.Thread(target=lambda pw=pw: wins.append(app._reset_password(token, pw)))
               for pw in ("first-password", "second-password")]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sum(1 for w in wins if w) == 1


def test_an_invitation_expiring_mid_way_is_refused(admin, sent_emails):
    invite(admin, "anna@example.com")
    token = token_of(sent_emails[0][2])
    with TestClient(app.app) as student:
        assert student.post("/api/welcome", json={"token": token}).status_code == 200     # page opened
        with app.db() as conn:                                                             # a week passes
            conn.execute("UPDATE password_resets SET expires = ?", (time.time() - 1,))
            conn.commit()
        assert student.post("/api/reset-password", json={"token": token, "password": "annas-pass"}).status_code == 400


def test_resending_replaces_the_old_link(admin, sent_emails):
    invite(admin, "anna@example.com")
    old = token_of(sent_emails[0][2])
    admin.post("/api/admin/users/anna/reset-link", json={})
    new = token_of(sent_emails[1][2])
    with TestClient(app.app) as student:
        assert student.post("/api/welcome", json={"token": old}).status_code == 400
        assert student.post("/api/welcome", json={"token": new}).status_code == 200


def test_links_are_long_random_and_stored_only_hashed(admin, sent_emails):
    invite(admin, "anna@example.com", "arman@example.com")
    t1, t2 = token_of(sent_emails[0][2]), token_of(sent_emails[1][2])
    assert len(t1) >= 43 and t1 != t2                             # 32 random bytes each
    with app.db() as conn:
        stored = [r[0] for r in conn.execute("SELECT token_hash FROM password_resets")]
    assert t1 not in stored and t2 not in stored and len(stored[0]) == 64


def test_no_working_link_in_a_production_log(monkeypatch, caplog):
    monkeypatch.setattr(app, "SMTP_HOST", None)
    monkeypatch.setattr(app, "DEBUG", False)
    app.send_email("a@example.com", "Reset", "Set a new password: https://x/account.html?reset=SECRET-TOKEN")
    assert "SECRET-TOKEN" not in caplog.text and "isn't set up" in caplog.text


def test_links_that_only_work_locally_are_flagged(admin, sent_emails, monkeypatch):
    assert invite(admin, "a@example.com").json()["warning"] is None              # https://academy.example.am
    monkeypatch.setattr(app, "BASE_URL", "http://localhost:8735")
    r = invite(admin, "b@example.com").json()
    assert "works only on the computer running the site" in r["warning"]


# ------------------------------------------------------------------ duplicates

def test_the_same_address_twice_makes_one_account(admin, sent_emails):
    r = invite(admin, "anna@example.com", "ANNA@example.com").json()["results"]
    assert r[0]["emailed"] and "already has an account" in r[1]["error"] and len(sent_emails) == 1


def test_two_admins_inviting_the_same_student_at_once(admin, sent_emails):
    out = []
    def go():
        with TestClient(app.app) as c:
            c.cookies.update(admin.cookies)
            out.append(invite(c, "anna@example.com").json()["results"][0])
    threads = [threading.Thread(target=go) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sum(1 for x in out if x.get("emailed")) == 1 and len(sent_emails) == 1
    with app.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users WHERE email = 'anna@example.com'").fetchone()[0] == 1


# ------------------------------------------------------------------ abuse

def test_one_admin_cant_mass_mail(admin, sent_emails, monkeypatch):
    monkeypatch.setattr(app, "INVITE_EMAILS_PER_HOUR", 5)
    assert invite(admin, *[f"a{i}@example.com" for i in range(4)]).status_code == 200
    r = invite(admin, "b1@example.com", "b2@example.com")
    assert r.status_code == 429 and len(sent_emails) == 4
    with app.db() as conn:                                        # refused before any account was made
        assert conn.execute("SELECT COUNT(*) FROM users WHERE email IN ('b1@example.com', 'b2@example.com')").fetchone()[0] == 0


def test_one_student_cant_be_flooded_with_links(admin, sent_emails):
    invite(admin, "anna@example.com")
    codes = [admin.post("/api/admin/users/anna/reset-link", json={}).status_code for _ in range(app.RESENDS_PER_STUDENT + 1)]
    assert codes[:-1] == [200] * app.RESENDS_PER_STUDENT and codes[-1] == 429
    assert len(sent_emails) == 1 + app.RESENDS_PER_STUDENT
