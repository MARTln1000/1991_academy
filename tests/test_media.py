"""Lesson videos hosted on the server (media/, README.md → "Lesson videos").

On a server Caddy serves /media itself; the app serves it too (your own
computer, an external web server), and tells every page which videos are
hosted, so the player uses them instead of YouTube.
"""
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app  # noqa: E402

VID = "ehvWj3Ir7yA"            # an 11-character YouTube id
VIDEO = bytes(range(256)) * 400   # 100 KB of "video"


@pytest.fixture
def media(tmp_path, monkeypatch):
    folder = tmp_path / "media"
    folder.mkdir()
    monkeypatch.setattr(app, "MEDIA_DIR", folder)
    monkeypatch.setattr(app, "DB_PATH", str(tmp_path / "test.db"))
    app._BUCKETS.clear()
    app.init_db()
    # StaticFiles was created with the folder app.py started with; point it here
    for route in app.app.routes:
        if getattr(route, "name", None) == "media":
            monkeypatch.setattr(route.app, "directory", str(folder))
            monkeypatch.setattr(route.app, "all_directories", [str(folder)])
    return folder


@pytest.fixture
def client(media):
    """Signed in as a student: videos are for the school's students only."""
    with app.db() as conn:
        app.create_account(conn, "student", "student@example.com", "hunter2pw")
        conn.commit()
    with TestClient(app.app) as c:
        c.post("/api/login", json={"identifier": "student", "password": "hunter2pw"})
        yield c


def test_videos_are_for_signed_in_students_only(client, media):
    (media / f"{VID}.mp4").write_bytes(VIDEO)
    assert client.get(f"/media/{VID}.mp4").status_code == 200
    with TestClient(app.app) as visitor:
        assert visitor.get(f"/media/{VID}.mp4").status_code == 401
        assert visitor.get(f"/media/{VID}.mp4", headers={"Range": "bytes=0-99"}).status_code == 401
        assert content(visitor)["media"] == {}


def content(client):
    text = client.get("/api/content.js").text
    return json.loads(text[len("window.ACADEMY_CUSTOM = "):].rstrip().rstrip(";"))


def test_a_hosted_video_is_served_and_seekable(client, media, monkeypatch):
    monkeypatch.setattr(app, "DEBUG", False)
    (media / f"{VID}.mp4").write_bytes(VIDEO)
    r = client.get(f"/media/{VID}.mp4", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200 and r.content == VIDEO
    assert r.headers["content-type"] == "video/mp4"
    assert "content-encoding" not in r.headers            # never gzipped
    assert r.headers["Cache-Control"] == "private, max-age=86400"   # the student's browser only
    assert r.headers["X-Robots-Tag"] == "noindex, nofollow"
    # a player seeking: a byte range
    part = client.get(f"/media/{VID}.mp4", headers={"Range": "bytes=1000-1999", "Accept-Encoding": "gzip"})
    assert part.status_code == 206 and part.content == VIDEO[1000:2000]
    assert part.headers["content-range"] == f"bytes 1000-1999/{len(VIDEO)}"
    assert "content-encoding" not in part.headers


@pytest.mark.parametrize("path", [
    "/media/", "/media", "/media/.hidden.mp4", f"/media/{VID}.exe", f"/media/{VID}.MP4",
    "/media/../app.py", "/media/%2e%2e/app.py", f"/media/sub/{VID}.mp4", "/media/" + "a" * 65 + ".mp4",
    f"/media/{VID}.mp4.part", "/media/missing.mp4",
])
def test_only_media_files_are_served(client, media, path):
    (media / ".hidden.mp4").write_bytes(b"x")
    (media / f"{VID}.exe").write_bytes(b"x")
    (media / "sub").mkdir()
    (media / "sub" / f"{VID}.mp4").write_bytes(b"x")
    assert client.get(path).status_code == 404, path


def test_no_media_folder_is_fine(client, media):
    media.rmdir()
    assert client.get(f"/media/{VID}.mp4").status_code == 404
    assert content(client)["media"] == {}


def test_pages_learn_which_videos_are_hosted(client, media):
    (media / f"{VID}.mp4").write_bytes(VIDEO)
    (media / f"{VID}.jpg").write_bytes(b"jpg")
    (media / "AAAAAAAAAAA.webm").write_bytes(b"webm")
    (media / "BBBBBBBBBBB.jpg").write_bytes(b"a poster without a video")
    (media / "notes.txt").write_text("ignored")
    (media / ".CCCCCCCCCCC.partial.mp4").write_bytes(b"still being encoded")
    assert content(client)["media"] == {
        VID: {"video": f"/media/{VID}.mp4", "poster": f"/media/{VID}.jpg"},
        "AAAAAAAAAAA": {"video": "/media/AAAAAAAAAAA.webm", "poster": None},
    }


def test_admins_see_what_is_hosted(client, media):
    (media / f"{VID}.mp4").write_bytes(VIDEO)
    with TestClient(app.app) as visitor:
        assert visitor.get("/api/admin/media").status_code == 401
    assert client.get("/api/admin/media").status_code == 403
    with app.db() as conn:
        app.create_account(conn, "boss", "boss@example.com", "hunter2pw")
        conn.commit()
    client.post("/api/login", json={"identifier": "boss", "password": "hunter2pw"})
    assert app.cli(["admin", "add", "boss"]) == 0
    d = client.get("/api/admin/media").json()
    assert d["media"][VID]["video"] == f"/media/{VID}.mp4" and d["sizes"][VID] == len(VIDEO)


def test_videos_are_kept_out_of_git_and_the_image():
    root = Path(app.__file__).parent
    assert "media/" in (root / ".gitignore").read_text().splitlines()
    assert "media/" in (root / ".dockerignore").read_text().splitlines()
