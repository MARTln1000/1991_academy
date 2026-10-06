"""Outbound email (invitations, password resets): app.deliver and
`make email-test`. A fake SMTP class stands in for the mail server."""
import smtplib
import ssl
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app  # noqa: E402


class FakeSMTP:
    instances = []
    fail_with = None

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port, self.context = host, port, context
        self.calls, self.sent = [], []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        self.calls.append(("starttls", context))

    def login(self, user, password):
        self.calls.append(("login", user))
        if FakeSMTP.fail_with:
            raise FakeSMTP.fail_with

    def send_message(self, msg):
        self.sent.append(msg)


@pytest.fixture
def mail(monkeypatch):
    FakeSMTP.instances, FakeSMTP.fail_with = [], None
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
    for key, value in (("SMTP_HOST", "mail.mil.am"), ("SMTP_PORT", 587), ("SMTP_USER", "ai.1991@mil.am"),
                       ("SMTP_PASS", "secret"), ("SMTP_FROM", "1991 Academy <ai.1991@mil.am>")):
        monkeypatch.setattr(app, key, value)
    return FakeSMTP


def verifying(context):
    return isinstance(context, ssl.SSLContext) and context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname


def test_port_587_upgrades_with_a_checked_certificate_before_the_password(mail):
    app.deliver("anna@example.com", "Hi", "Body")
    s = mail.instances[0]
    assert (s.host, s.port) == ("mail.mil.am", 587)
    assert [c[0] for c in s.calls] == ["starttls", "login"]          # encrypted before the password
    assert verifying(s.calls[0][1])
    msg = s.sent[0]
    assert msg["From"] == "1991 Academy <ai.1991@mil.am>" and msg["To"] == "anna@example.com"


def test_port_465_is_encrypted_from_the_start(mail, monkeypatch):
    monkeypatch.setattr(app, "SMTP_PORT", 465)
    app.deliver("anna@example.com", "Hi", "Body")
    s = mail.instances[0]
    assert s.port == 465 and verifying(s.context)
    assert [c[0] for c in s.calls] == ["login"]


def test_a_failure_is_logged_never_raised_to_the_request(mail, caplog):
    mail.fail_with = smtplib.SMTPAuthenticationError(535, b"bad")
    assert app.send_email("anna@example.com", "Hi", "Body") is False
    assert "SMTP connection failed" in caplog.text


@pytest.mark.parametrize("error,says", [
    (smtplib.SMTPAuthenticationError(535, b"bad"), "refused the user name or password"),
    (ssl.SSLCertVerificationError(1, "self-signed certificate in certificate chain"), "certificate isn't trusted"),
    (ConnectionRefusedError(61, "Connection refused"), "ConnectionRefusedError"),
])
def test_email_test_says_what_went_wrong(mail, capsys, error, says):
    mail.fail_with = error
    assert app.cli(["email-test", "me@example.com"]) == 1
    assert says in capsys.readouterr().err


def test_email_test(mail, capsys):
    assert app.cli(["email-test", "me@example.com"]) == 0
    assert "Sent." in capsys.readouterr().out
    assert mail.instances[0].sent[0]["To"] == "me@example.com"


def test_email_test_without_settings(monkeypatch, capsys):
    monkeypatch.setattr(app, "SMTP_HOST", None)
    assert app.cli(["email-test", "me@example.com"]) == 1
    assert "isn't set up" in capsys.readouterr().err
