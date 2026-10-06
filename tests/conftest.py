"""Test configuration — point the app at a throwaway DB BEFORE app.py is
imported, so tests never touch 1991_academy.db."""
import os
import tempfile

os.environ.setdefault("ACADEMY_DB", os.path.join(tempfile.gettempdir(), "academy_test_import.db"))
os.environ["ACADEMY_DEBUG"] = "1"

import pytest  # noqa: E402


@pytest.fixture
def sent_emails(monkeypatch):
    """Email "set up", but nothing leaves the machine: every message the site
    hands to the mail server lands in this list as (to, subject, text, html).
    Set `sent_emails.fail = {address: reason}` to make the server refuse some."""
    import app

    class Outbox(list):
        fail = {}

    box = Outbox()
    for key, value in (("SMTP_HOST", "mail.example"), ("SMTP_USER", "academy@example.com"), ("SMTP_PASS", "x")):
        monkeypatch.setattr(app, key, value)

    def fake_deliver_all(messages):
        out = []
        for to, subject, text, html in messages:
            if to in box.fail:
                out.append(box.fail[to])
            else:
                box.append((to, subject, text, html))
                out.append(None)
        return out

    monkeypatch.setattr(app, "deliver_all", fake_deliver_all)
    return box
