"""The admin panel's API (app.py, "admin") and its page.

Two browsers: `admin` is signed in as "boss", made an admin the way the server
does it (`python app.py admin add boss`); `learner` is signed in as "alice".
Every test gets a fresh temp database.
"""
import json
import re
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import app  # noqa: E402


def register(client, username, email, password="hunter2pw"):
    """An account (there's no sign-up), signed in on `client`."""
    with app.db() as conn:
        app.create_account(conn, username, email, password)
        conn.commit()
    r = client.post("/api/login", json={"identifier": username, "password": password})
    assert r.status_code == 200, r.text
    return r


@pytest.fixture
def clients(tmp_path, monkeypatch):
    monkeypatch.setattr(app, "DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setattr(app, "SMTP_HOST", None)
    app._BUCKETS.clear()
    app.init_db()
    with TestClient(app.app) as admin, TestClient(app.app) as learner:
        register(admin, "boss", "boss@example.com")
        assert app.cli(["admin", "add", "boss"]) == 0
        register(learner, "alice", "alice@example.com")
        yield admin, learner




def add_users(names, created=None):
    """Accounts straight into the database: no sign-up rate limit."""
    with app.db() as conn:
        for name in names:
            conn.execute(
                "INSERT INTO users (username, email, pass_hash, salt, created) VALUES (?, ?, 'x', '00', ?)",
                (name, name.replace("%", "pct") + "@example.com", created or time.time()),
            )
        conn.commit()


def progress_blob(done, quiz=None, streak=None, awards=None, total=0):
    return {
        "1991_academy:progress:v1": json.dumps({"done": done, "quiz": quiz or {}, "streak": streak or {"count": 0, "last": None}}),
        "1991_academy:xp:v1": json.dumps({"total": total, "awards": awards or {}}),
    }


def lesson(**over):
    body = {
        "track": "web", "module": "web-m2", "after": "web-2-3", "published": True,
        "title": "Forms and Validation", "title_hy": "Ձևեր և ստուգում", "minutes": 12,
        "content": "<p>Forms collect input.</p>", "content_hy": "<p>Ձևերը հավաքում են տվյալներ։</p>",
        "takeaways": ["Use <code>required</code>"], "takeaways_hy": [],
        "quiz": [{"q": "Which attribute makes a field mandatory?", "options": ["required", "needed"],
                  "options_hy": [], "answer": 0, "explain": "It's required.", "q_hy": "", "explain_hy": ""}],
        "videos": [{"id": "UPxfpDPo-t0", "title": "Forms", "channel": "MDN", "length": "10:00"}],
    }
    body.update(over)
    return body


def content_js(client):
    r = client.get("/api/content.js")
    assert r.status_code == 200
    prefix = "window.ACADEMY_CUSTOM = "
    assert r.text.startswith(prefix) and r.text.rstrip().endswith(";")
    return json.loads(r.text[len(prefix):].rstrip().rstrip(";"))


# ------------------------------------------------------------------ access

ADMIN_GETS = ["/api/admin/overview", "/api/admin/users", "/api/admin/users/alice", "/api/admin/lessons",
              "/api/admin/announcements", "/api/admin/log"]
ADMIN_WRITES = [
    ("POST", "/api/admin/users/alice/reset-link"), ("POST", "/api/admin/users/alice/sign-out"),
    ("POST", "/api/admin/users/alice/delete"), ("PUT", "/api/admin/lessons/web-2-9"),
    ("DELETE", "/api/admin/lessons/web-2-9"), ("POST", "/api/admin/lessons/web-2-9/preview"),
    ("POST", "/api/admin/announcements"),
    ("PUT", "/api/admin/announcements/1"), ("DELETE", "/api/admin/announcements/1"),
]


def test_only_admins_reach_the_admin_api(clients):
    admin, learner = clients
    with TestClient(app.app) as anonymous:
        for path in ADMIN_GETS:
            assert anonymous.get(path).status_code == 401, path
            assert learner.get(path).status_code == 403, path
            assert admin.get(path).status_code == 200, path
        for method, path in ADMIN_WRITES:
            body = lesson() if "lessons" in path else {"text": "hi"}
            assert anonymous.request(method, path, json=body).status_code == 401, path
            assert learner.request(method, path, json=body).status_code == 403, path
    # ...and the learner's attempts changed nothing
    assert admin.get("/api/admin/users/alice").status_code == 200
    published = content_js(admin)
    assert published["lessons"] == [] and published["announcements"] == []


@pytest.mark.parametrize("method,path,body", [
    ("PUT", "/api/admin/lessons/web-2-9", {"nonsense": True}),
    ("POST", "/api/admin/lessons/web-2-9/preview", {"nonsense": True}),
    ("POST", "/api/admin/announcements", {"level": "<b>"}),
    ("PUT", "/api/admin/announcements/1", {}),
    ("POST", "/api/admin/invites", {"students": "x"}),
])
def test_non_admins_learn_nothing_from_bad_input(clients, method, path, body):
    """Checked before the body is read: a non-admin gets 403 (401 signed
    out), never a validation message about what an admin may send."""
    _, learner = clients
    assert learner.request(method, path, json=body).status_code == 403
    with TestClient(app.app) as anonymous:
        assert anonymous.request(method, path, json=body).status_code == 401


def test_me_says_who_is_an_admin(clients):
    admin, learner = clients
    assert admin.get("/api/me").json()["user"]["admin"] is True
    assert learner.get("/api/me").json()["user"]["admin"] is False


def test_admin_rights_come_and_go_on_the_command_line(clients, capsys):
    admin, learner = clients
    assert app.cli(["admin", "add", "nobody"]) == 1
    assert "No account named" in capsys.readouterr().err
    assert app.cli(["admin", "add", "ALICE"]) == 0              # names are case-insensitive
    assert learner.get("/api/admin/overview").status_code == 200
    assert app.cli(["admin", "list"]) == 0
    listed = capsys.readouterr().out
    assert "alice" in listed and "boss" in listed
    assert app.cli(["admin", "remove", "alice"]) == 0
    assert learner.get("/api/admin/overview").status_code == 403  # at once: checked on every request
    log = admin.get("/api/admin/log").json()["entries"]
    assert [(e["admin"], e["action"], e["target"]) for e in log[:2]] == [
        ("(server)", "admin-remove", "alice"), ("(server)", "admin-add", "alice")]


@pytest.mark.parametrize("args", [[], ["admin"], ["admin", "add"], ["admin", "grant", "x"], ["users"]])
def test_cli_usage(args, capsys):
    assert app.cli(args) == 2
    assert "usage" in capsys.readouterr().err


def test_no_web_request_can_make_an_admin(clients):
    admin, learner = clients
    learner.put("/api/state", json={"data": {"is_admin": "1"}})
    learner.post("/api/leaderboard-optin", json={"optIn": True, "is_admin": 1})
    assert learner.get("/api/me").json()["user"]["admin"] is False
    routes = [r.path for r in app.app.routes if hasattr(r, "path")]
    assert not any("admin" in p and ("grant" in p or "promote" in p or p.endswith("/admin")) for p in routes)


def test_admin_writes_need_json(clients):
    """The same cross-site request forgery guard as every other API write."""
    admin, _ = clients
    r = admin.post("/api/admin/users/alice/delete", content="{}", headers={"Content-Type": "text/plain"})
    assert r.status_code == 415
    assert admin.get("/api/admin/users/alice").status_code == 200


# --------------------------------------------------------------- invitations

def test_invite_students_and_they_join(clients):
    admin, _ = clients
    r = admin.post("/api/admin/invites", json={"students": [
        {"email": "Anna.K@Example.com"},                         # username made from the email
        {"email": "arman@example.com", "username": "arman_s"},
        {"email": "alice@example.com"},                          # already has an account
        {"email": "not-an-email"},
        {"email": "x@example.com", "username": "<b>"},
    ]})
    assert r.status_code == 200
    out = r.json()
    assert out["sent"] is False                                  # no email here: the admin gets the links
    ok = [x for x in out["results"] if "link" in x]
    assert [(x["username"], x["email"]) for x in ok] == [("anna_k", "anna.k@example.com"), ("arman_s", "arman@example.com")]
    errors = [x["error"] for x in out["results"] if "error" in x]
    assert len(errors) == 3 and "already has an account" in errors[0]
    listed = {u["username"]: u for u in admin.get("/api/admin/users?q=@example.com").json()["learners"]}
    assert listed["arman_s"]["invited"] is True and listed["alice"]["invited"] is False
    assert admin.get("/api/admin/overview").json()["invited"] == 2
    # Arman opens his link, chooses a password and is in
    with TestClient(app.app) as arman:
        token = ok[1]["link"].split("welcome=")[1]
        assert arman.post("/api/welcome", json={"token": token}).json() == {"username": "arman_s"}
        assert arman.post("/api/reset-password", json={"token": token, "password": "armans-pass"}).status_code == 200
        assert arman.get("/index.html").status_code == 200
    assert admin.get("/api/admin/users/arman_s").json()["learner"]["invited"] is False
    log = [(e["action"], e["target"]) for e in admin.get("/api/admin/log").json()["entries"]]
    assert ("invite", "anna_k") in log and ("invite", "arman_s") in log


def test_invitations_are_emailed_when_email_is_set_up(clients, sent_emails, monkeypatch):
    admin, _ = clients
    for k, v in (("SMTP_HOST", "smtp.example"), ("SMTP_USER", "u"), ("SMTP_PASS", "p")):
        monkeypatch.setattr(app, k, v)
    r = admin.post("/api/admin/invites", json={"students": [{"email": "anna@example.com"}]})
    assert r.json()["sent"] is True and "welcome=" not in r.text  # the admin never sees the link
    to, subject, body, html = sent_emails[0]
    assert to == "anna@example.com" and "Your username: anna" in body and "welcome=" in body
    assert r.json()["results"][0]["emailed"] is True


def test_resending_an_invitation(clients):
    admin, _ = clients
    admin.post("/api/admin/invites", json={"students": [{"email": "anna@example.com"}]})
    out = admin.post("/api/admin/users/anna/reset-link", json={}).json()
    assert out["invite"] is True and "welcome=" in out["link"]
    out = admin.post("/api/admin/users/alice/reset-link", json={}).json()   # a student with a password
    assert out["invite"] is False and "reset=" in out["link"]


@pytest.mark.parametrize("body", [{}, {"students": []}, {"students": "x"}, {"students": ["x"]},
                                  {"students": [{"email": "a@b.co"}] * 201}])
def test_bad_invitations(clients, body):
    admin, learner = clients
    assert admin.post("/api/admin/invites", json=body).status_code == 400
    assert learner.post("/api/admin/invites", json={"students": [{"email": "a@b.co"}]}).status_code == 403


def test_the_first_admin_is_made_on_the_server(clients, capsys):
    assert app.cli(["admin", "add", "newboss", "newboss@example.com"]) == 0
    out = capsys.readouterr().out
    assert "newboss is now an admin" in out and "welcome=" in out
    with app.db() as conn:
        row = conn.execute("SELECT is_admin, pass_hash FROM users WHERE username = 'newboss'").fetchone()
    assert row["is_admin"] == 1 and row["pass_hash"] == app.INVITED
    assert app.cli(["admin", "add", "ghost"]) == 1                      # no account, no email


def test_admin_page_is_served_but_not_indexed(clients):
    admin, _ = clients
    r = admin.get("/admin.html")
    assert r.status_code == 200
    assert r.headers["X-Robots-Tag"] == "noindex, nofollow"
    assert '<meta name="robots" content="noindex, nofollow"' in r.text


# ---------------------------------------------------------------- learners

def test_learner_list_search_sort_and_pages(clients):
    admin, _ = clients
    add_users(["user%02d" % i for i in range(60)] + ["a_b", "axb"])
    d = admin.get("/api/admin/users").json()
    assert d["total"] == 64 and len(d["learners"]) == 50 and d["pageSize"] == 50
    assert len(admin.get("/api/admin/users?offset=50").json()["learners"]) == 14
    # the search is literal: "_" and "%" are not wildcards
    assert [u["username"] for u in admin.get("/api/admin/users?q=a_b").json()["learners"]] == ["a_b"]
    assert admin.get("/api/admin/users?q=%25").json()["total"] == 0
    assert admin.get("/api/admin/users?q=ALICE@EXAMPLE").json()["learners"][0]["username"] == "alice"
    names = [u["username"] for u in admin.get("/api/admin/users?sort=name&offset=0").json()["learners"]]
    assert names[:3] == ["a_b", "alice", "axb"]
    # an unknown sort (or SQL in it) is just the default order
    r = admin.get("/api/admin/users?sort=xp;DROP TABLE users--&offset=-5")
    assert r.status_code == 200 and r.json()["total"] == 64 and r.json()["offset"] == 0


def test_learner_detail_shows_their_progress(clients):
    admin, learner = clients
    now_ms = int(time.time() * 1000)
    learner.put("/api/state", json={"data": progress_blob(
        done={"web-1-1": now_ms, "web-1-2": now_ms, "dsa-1-1": True},
        quiz={"web-1-1": {"score": 2, "total": 3, "at": now_ms}},
        streak={"count": 4, "last": "2026-10-01"},
        awards={"lab:lab-two-sum": True, "mission:mission-maze": True, "ex:web-1-1:0": True, "lesson:web-1-1": True},
        total=135)})
    d = admin.get("/api/admin/users/alice").json()
    u, p = d["learner"], d["progress"]
    assert u["username"] == "alice" and u["xp"] == 135 and u["sessions"] == 1 and u["lastActive"]
    assert p["done"] == {"web-1-1": now_ms, "web-1-2": now_ms, "dsa-1-1": None}
    assert p["quiz"] == {"web-1-1": {"score": 2, "total": 3}}
    assert p["streak"] == {"count": 4, "last": "2026-10-01"}
    assert p["labs"] == ["lab-two-sum"] and p["missions"] == ["mission-maze"] and p["exercises"] == 1
    listed = admin.get("/api/admin/users?q=alice").json()["learners"][0]
    assert listed["lessons"] == 3 and listed["xp"] == 135
    assert admin.get("/api/admin/users/nobody").status_code == 404


def test_a_corrupt_blob_counts_as_no_progress(clients):
    admin, learner = clients
    learner.put("/api/state", json={"data": {"1991_academy:progress:v1": "{not json", "1991_academy:xp:v1": "[1]"}})
    p = admin.get("/api/admin/users/alice").json()["progress"]
    assert p["done"] == {} and p["labs"] == []
    assert admin.get("/api/admin/overview").status_code == 200


def test_overview_adds_everyone_up(clients):
    admin, learner = clients
    now_ms = int(time.time() * 1000)
    learner.put("/api/state", json={"data": progress_blob(
        done={"web-1-1": now_ms, "web-1-2": now_ms}, awards={"lab:lab-knn": True}, total=60)})
    add_users(["old_timer"], created=time.time() - 90 * 86400)
    s = admin.get("/api/admin/overview").json()
    assert (s["learners"], s["admins"], s["new7"], s["new30"]) == (3, 1, 2, 2)
    assert s["active7"] == 1 and s["withProgress"] == 1 and s["xpTotal"] == 60
    assert s["lessons"] == {"web-1-1": 1, "web-1-2": 1}
    assert s["tracks"] == {"web": {"starters": 1, "completions": 2}}
    assert s["labs"] == {"lab-knn": 1} and s["missions"] == {}
    assert len(s["days"]) == 30 and s["signups"][-1] == 2 and s["completions"][-1] == 2


def test_reset_link_without_email_is_handed_to_the_admin(clients):
    admin, learner = clients
    out = admin.post("/api/admin/users/alice/reset-link", json={}).json()
    assert out["sent"] is False
    token = re.search(r"reset=([\w-]+)", out["link"]).group(1)
    assert learner.post("/api/reset-password", json={"token": token, "password": "brandnew123"}).status_code == 200
    assert learner.post("/api/login", json={"identifier": "alice", "password": "brandnew123"}).status_code == 200


def test_reset_link_with_email_goes_only_to_the_learner(clients, sent_emails, monkeypatch):
    admin, _ = clients
    for k, v in (("SMTP_HOST", "smtp.example"), ("SMTP_USER", "u"), ("SMTP_PASS", "p")):
        monkeypatch.setattr(app, k, v)
    r = admin.post("/api/admin/users/alice/reset-link", json={})
    assert {k: v for k, v in r.json().items() if k != "warning"} == {"sent": True, "email": "alice@example.com", "invite": False}
    assert "reset=" not in r.text
    assert sent_emails[0][0] == "alice@example.com" and "reset=" in sent_emails[0][2]


def test_sign_out_everywhere(clients):
    admin, learner = clients
    assert learner.get("/api/me").status_code == 200
    assert admin.post("/api/admin/users/alice/sign-out", json={}).json() == {"ok": True, "sessions": 1}
    assert learner.get("/api/me").status_code == 401
    assert admin.post("/api/admin/users/boss/sign-out", json={}).status_code == 400   # not yourself


def test_delete_a_learner_but_never_an_admin(clients):
    admin, learner = clients
    assert admin.post("/api/admin/users/boss/delete", json={}).status_code == 409
    assert admin.post("/api/admin/users/alice/delete", json={}).status_code == 200
    assert learner.get("/api/me").status_code == 401
    assert admin.get("/api/admin/users/alice").status_code == 404
    entry = admin.get("/api/admin/log").json()["entries"][0]
    assert (entry["action"], entry["target"]) == ("delete-account", "alice")
    assert "alice@example.com" not in json.dumps(entry)     # the log keeps no personal data of the deleted


# ----------------------------------------------------------------- lessons

def test_lessons_are_drafts_until_published(clients):
    admin, learner = clients
    assert admin.put("/api/admin/lessons/web-2-9", json=lesson(published=False)).status_code == 200
    assert content_js(learner)["lessons"] == []
    assert [x["id"] for x in admin.get("/api/admin/lessons").json()["lessons"]] == ["web-2-9"]
    saved = admin.put("/api/admin/lessons/web-2-9", json=lesson()).json()["lesson"]
    assert saved["published"] is True and saved["updatedBy"] == "boss"
    live = content_js(learner)["lessons"]
    assert [(x["id"], x["track"], x["module"], x["after"]) for x in live] == [("web-2-9", "web", "web-m2", "web-2-3")]
    assert live[0]["data"]["title_hy"] == "Ձևեր և ստուգում"
    assert admin.request("DELETE", "/api/admin/lessons/web-2-9", json={}).status_code == 200
    assert content_js(learner)["lessons"] == []
    assert admin.request("DELETE", "/api/admin/lessons/web-2-9", json={}).status_code == 404
    actions = [e["action"] for e in admin.get("/api/admin/log").json()["entries"]]
    assert actions[:3] == ["lesson-delete", "lesson-update", "lesson-create"]


def test_lesson_html_is_sanitized(clients):
    admin, _ = clients
    evil = (
        '<script>alert(1)</script><p onclick="steal()">Hi <a href="javascript:alert(1)">x</a> '
        '<a href="https://ok.example/page" target="_blank">ok</a></p>'
        '<div class="callout evil" style="color:red">Note</div><img src=x onerror=alert(1)>'
        '<iframe src="https://evil.example"></iframe><style>body{display:none}</style>'
        '<svg onload=alert(1)></svg><h3>Kept</h3><pre><code>&lt;b&gt;</code></pre>'
    )
    data = admin.put("/api/admin/lessons/web-2-9", json=lesson(
        content=evil, content_hy=evil, takeaways=['<b onmouseover="x()">bold</b>', "<script>x</script>"],
    )).json()["lesson"]["data"]
    for html in (data["content"], data["content_hy"], " ".join(data["takeaways"])):
        for bad in ("<script", "onclick", "onmouseover", "onerror", "onload", "javascript:", "<img", "<iframe",
                    "<style", "<svg", "evil", "style=", "target="):
            assert bad not in html, (bad, html)
    assert '<div class="callout">Note</div>' in data["content"]
    assert '<a href="https://ok.example/page" rel="noopener noreferrer">ok</a>' in data["content"]
    assert "<h3>Kept</h3><pre><code>&lt;b&gt;</code></pre>" in data["content"]
    assert data["takeaways"] == ["<b>bold</b>"]       # the script-only line is gone


def test_preview_shows_the_sanitized_lesson_without_saving(clients):
    admin, learner = clients
    r = admin.post("/api/admin/lessons/web-2-9/preview",
                   json=lesson(content='<p>Hi</p><img src=x onerror="alert(1)"><script>x</script>'))
    assert r.status_code == 200 and r.json()["data"]["content"] == "<p>Hi</p>"
    assert admin.get("/api/admin/lessons").json()["lessons"] == []
    bad = admin.post("/api/admin/lessons/web-2-9/preview", json=lesson(minutes=0))
    assert bad.status_code == 400 and "Reading time" in bad.json()["error"]


def test_built_in_html_survives_the_sanitizer():
    """Every tag the shipped lessons use passes through unchanged, so editing
    one in the panel can't quietly mangle it."""
    sample = ('<p>Text <strong>bold</strong> <em>it</em> <code>x</code></p><h3>H</h3>'
              '<ul><li>a</li></ul><ol><li>b</li></ol><pre><code>a &lt; b &amp;&amp; c</code></pre>'
              '<div class="callout"><span>💡</span><div><strong>Tip</strong> text</div></div>')
    assert app.clean_html(sample) == sample


@pytest.mark.parametrize("lesson_id,over,message", [
    ("Web-2-9", {}, "Lesson id"),
    ("web", {}, "Lesson id"),
    ("web-2-9-" + "x" * 40, {}, "Lesson id"),
    ("dsa-2-9", {}, "start with web-"),
    ("web-2-9", {"track": "Web"}, "Unknown track"),
    ("web-2-9", {"module": "../x"}, "Unknown module"),
    ("web-2-9", {"after": "<b>"}, "Unknown position"),
    ("web-2-9", {"minutes": 0}, "Reading time"),
    ("web-2-9", {"minutes": "12"}, "Reading time"),
    ("web-2-9", {"minutes": True}, "Reading time"),
    ("web-2-9", {"title": "  "}, "Title is required"),
    ("web-2-9", {"title": "x" * 201}, "too long"),
    ("web-2-9", {"content": "<script>only()</script>"}, "Content is empty"),
    ("web-2-9", {"content": 5}, "must be text"),
    ("web-2-9", {"takeaways": "not a list"}, "must be a list"),
    ("web-2-9", {"takeaways": ["x"] * 13}, "At most 12"),
    ("web-2-9", {"quiz": [{"q": "Q", "options": ["only one"], "answer": 0}]}, "2 to 6"),
    ("web-2-9", {"quiz": [{"q": "Q", "options": ["a", "b"], "answer": 2}]}, "correct answer"),
    ("web-2-9", {"quiz": [{"q": "Q", "options": ["a", "b"], "answer": True}]}, "correct answer"),
    ("web-2-9", {"quiz": [{"q": "Q", "options": ["a", "b"], "answer": -1}]}, "correct answer"),
    ("web-2-9", {"quiz": [{"q": "Q", "options": ["a", "b"], "options_hy": ["ա"], "answer": 0}]}, "Armenian"),
    ("web-2-9", {"quiz": [{"q": "", "options": ["a", "b"], "answer": 0}]}, "Question 1 is required"),
    ("web-2-9", {"quiz": ["nope"]}, "malformed"),
    ("web-2-9", {"quiz": [{"q": "Q", "options": ["a", "b"], "answer": 0}] * 21}, "At most 20"),
    ("web-2-9", {"videos": [{"id": "javascript:x", "title": "T"}]}, "YouTube"),
    ("web-2-9", {"videos": [{"id": '"><img src=x>', "title": "T"}]}, "YouTube"),
    ("web-2-9", {"videos": [{"id": "UPxfpDPo-t0", "title": ""}]}, "title is required"),
])
def test_lesson_validation(clients, lesson_id, over, message):
    admin, _ = clients
    r = admin.put("/api/admin/lessons/" + lesson_id, json=lesson(**over))
    assert r.status_code in (400, 404), r.text
    if r.status_code == 400:
        assert message in r.json()["error"], r.json()
    assert admin.get("/api/admin/lessons").json()["lessons"] == []


def test_content_js_is_inert_data(clients):
    """Whatever an admin types, api/content.js stays one assignment of plain
    data: every non-ASCII character and quote is escaped."""
    admin, learner = clients
    admin.put("/api/admin/lessons/web-2-9", json=lesson(title='</script><script>alert(1)</script>"; alert(2); "'))
    admin.post("/api/admin/announcements", json={"text": "Maintenance tonight", "text_hy": "Աշխատանքներ"})
    r = learner.get("/api/content.js")
    assert r.headers["content-type"].startswith("application/javascript")
    assert r.headers["Cache-Control"] == "no-store"
    assert r.text.isascii()
    assert r.text.count("\n") == 1                         # one statement; U+2028 escaped too
    data = content_js(learner)
    assert data["lessons"][0]["data"]["title"] == '</script><script>alert(1)</script>"; alert(2); "'
    assert data["announcements"][0]["text_hy"] == "Աշխատանքներ"


# ------------------------------------------------------------ announcements

def test_announcements(clients):
    admin, learner = clients
    for bad, message in (({"text": " "}, "required"), ({"text": "x" * 301}, "too long"),
                         ({"text": "ok", "level": "<b>"}, "Unknown kind")):
        r = admin.post("/api/admin/announcements", json=bad)
        assert r.status_code == 400 and message in r.json()["error"]
    a = admin.post("/api/admin/announcements", json={"text": "New track!", "level": "info"}).json()["announcement"]
    b = admin.post("/api/admin/announcements", json={"text": "Down at 22:00", "text_hy": "Անջատում", "level": "warning"}).json()["announcement"]
    assert [x["text"] for x in content_js(learner)["announcements"]] == ["Down at 22:00", "New track!"]
    admin.put("/api/admin/announcements/%d" % a["id"], json={**a, "active": False})
    assert [x["id"] for x in content_js(learner)["announcements"]] == [b["id"]]
    assert admin.request("DELETE", "/api/admin/announcements/%d" % b["id"], json={}).status_code == 200
    assert content_js(learner)["announcements"] == []
    assert admin.request("DELETE", "/api/admin/announcements/%d" % b["id"], json={}).status_code == 404
    assert admin.put("/api/admin/announcements/999", json={"text": "x"}).status_code == 404
    assert [x["active"] for x in admin.get("/api/admin/announcements").json()["announcements"]] == [False]
    assert admin.get("/api/admin/log").json()["entries"][0]["action"] == "announcement-delete"


# ---------------------------------------------------------------- the page

def test_every_sign_in_page_string_has_an_armenian_translation():
    page = (ROOT / "js" / "account-page.js").read_text(encoding="utf-8")
    keys = set(re.findall(r'\bt\(\s*"((?:[^"\\]|\\.)*)"', page))
    translated = (ROOT / "js" / "i18n.js").read_text(encoding="utf-8")
    assert len(keys) > 40 and sorted(k for k in keys if '"%s":' % k not in translated) == []


def test_every_admin_panel_string_has_an_armenian_translation():
    page = (ROOT / "js" / "admin-page.js").read_text(encoding="utf-8")
    keys = set(re.findall(r'\bt\(\s*"((?:[^"\\]|\\.)*)"', page))
    keys |= {k for pair in re.findall(r'\bt\([^"()]*\?\s*"([^"]+)"\s*:\s*"([^"]+)"', page) for k in pair}
    for table in ("const ACTIONS = {", "const DETAILS = {", "const SORTS = ["):
        start = page.index(table)
        chunk = page[start:page.index("}" if table.endswith("{") else "];", start)]
        keys |= set(re.findall(r'(?::\s*|\[\s*"[^"]+",\s*)"([^"]+)"', chunk))
    translated = (ROOT / "js" / "i18n-admin.js").read_text(encoding="utf-8") + (ROOT / "js" / "i18n.js").read_text(encoding="utf-8")
    missing = sorted(k for k in keys if '"%s":' % k not in translated)
    assert len(keys) > 150 and missing == []
