"""Contract and invalid-content regression tests for the DSA content router."""
import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dsa_api import build_dsa_router


@pytest.fixture
def content(tmp_path, monkeypatch):
    monkeypatch.delenv("ACADEMY_TUTOR_URL", raising=False)
    monkeypatch.delenv("ACADEMY_TUTOR_MODEL", raising=False)
    monkeypatch.delenv("ACADEMY_TUTOR_KEY", raising=False)
    catalog = {
        "version": 1,
        "topics": [
            {"id": "arrays", "title": "Arrays", "prerequisites": [], "status": "planned"},
            {"id": "binary-search", "title": "Binary search", "prerequisites": ["arrays"], "status": "ready"},
        ],
        "resources": [
            {"id": "search-book", "title": "Search reference", "type": "Book", "topics": ["binary-search"], "difficulty": "Intermediate", "language": "English"},
            {"id": "array-course", "title": "Array course", "type": "Course", "topics": ["arrays"], "difficulty": "Beginner", "language": "English"},
        ],
        "paths": [],
    }
    lesson = {
        "id": "binary-search", "title": "Binary search", "summary": "Reduce a sorted search interval.",
        "sections": [{"id": "invariant", "title": "Invariant", "body": "All positions before lo are too small."}],
        "resources": ["search-book"],
        "problems": [{"id": "first-match", "title": "Find first match", "hints": ["Consider the boundary.", "Use a monotone predicate."], "solution": {"algorithm": "Full solution."}}],
    }
    (tmp_path / "lessons").mkdir()
    (tmp_path / "catalog.json").write_text(json.dumps(catalog))
    (tmp_path / "lessons" / "binary-search.json").write_text(json.dumps(lesson))
    return tmp_path


def client(root):
    app = FastAPI()
    app.include_router(build_dsa_router(root))
    return TestClient(app)


def test_catalog_and_lazy_lesson_routes(content):
    api = client(content)
    assert len(api.get("/api/dsa/catalog").json()["topics"]) == 2
    assert api.get("/api/dsa/lessons/binary-search").json()["title"] == "Binary search"
    assert api.get("/api/dsa/lessons/missing").status_code == 404
    assert api.get("/api/dsa/lessons/%2e%2e%2fcatalog").status_code == 404


def test_resource_filters_and_pagination(content):
    api = client(content)
    response = api.get("/api/dsa/resources", params={"q": "SEARCH", "topic": "binary-search", "type": "Book", "difficulty": "Intermediate", "language": "English"}).json()
    assert response["total"] == 1
    assert response["items"][0]["id"] == "search-book"
    assert api.get("/api/dsa/resources?limit=1&offset=1").json()["items"][0]["id"] == "array-course"
    assert api.get("/api/dsa/resources?offset=5").json()["items"] == []
    assert api.get("/api/dsa/resources?limit=101").status_code == 422
    assert api.get("/api/dsa/resources?offset=-1").status_code == 422


def test_problems_from_lessons_are_discoverable(content):
    api = client(content)
    data = api.get("/api/dsa/problems?topic=binary-search&lesson=binary-search").json()
    assert data["total"] == 1
    assert data["items"][0]["lessonId"] == "binary-search"
    assert api.get("/api/dsa/problems?lesson=arrays").json()["items"] == []


@pytest.mark.parametrize("mutation", ["cycle", "missing", "duplicate", "alias", "resource"])
def test_invalid_catalog_fails_closed_without_leaking_paths(content, mutation):
    path = content / "catalog.json"
    catalog = json.loads(path.read_text())
    if mutation == "cycle":
        catalog["topics"][0]["prerequisites"] = ["binary-search"]
    elif mutation == "missing":
        catalog["topics"][0]["prerequisites"] = ["absent"]
    elif mutation == "duplicate":
        catalog["topics"].append(catalog["topics"][0])
    elif mutation == "alias":
        catalog["topics"][0]["aliases"] = ["Binary Indexed Tree"]
        catalog["topics"][1]["aliases"] = ["binary indexed tree"]
    else:
        catalog["resources"] = []
    path.write_text(json.dumps(catalog))
    response = client(content).get("/api/dsa/catalog")
    assert response.status_code == 503
    assert str(content) not in response.text


def test_guided_tutor_and_progressive_hints(content):
    api = client(content)
    body = {"lessonId": "binary-search", "question": "Why does the invariant hold?"}
    response = api.post("/api/dsa/tutor", json=body).json()
    assert response["provider"] == "guided"
    assert "All positions before lo" in response["answer"]
    body.update(mode="hint", context={"problem": "first-match", "hints": 0})
    assert api.post("/api/dsa/tutor", json=body).json()["answer"] == "Consider the boundary."
    body["context"]["hints"] = 1
    assert api.post("/api/dsa/tutor", json=body).json()["answer"] == "Use a monotone predicate."
    body["mode"] = "exam"
    exam = api.post("/api/dsa/tutor", json=body).json()["answer"]
    assert "Full solution" not in exam and "All positions before lo" not in exam


@pytest.mark.parametrize("update", [
    {"mode": "other"}, {"question": ""}, {"context": {"code": "x" * 12001}},
    {"context": {"mastery": {"trace": -1}}}, {"context": {"frame": {"x": "x" * 16001}}},
    {"context": {"attempts": -1}}, {"lessonId": "../secret"},
])
def test_tutor_bounds(content, update):
    body = {"lessonId": "binary-search", "question": "Why?", **update}
    assert client(content).post("/api/dsa/tutor", json=body).status_code == 422


def test_external_provider_is_explicit_and_contextual(content, monkeypatch):
    monkeypatch.setenv("ACADEMY_TUTOR_URL", "https://example.invalid/v1/chat/completions")
    monkeypatch.setenv("ACADEMY_TUTOR_MODEL", "configured-model")
    monkeypatch.setenv("ACADEMY_TUTOR_KEY", "secret-token")
    sent = []

    class Response:
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def read(self, count):
            return json.dumps({"choices": [{"message": {"content": "Explain the invariant in your own words."}}]}).encode()

    class Opener:
        def open(self, request, timeout):
            assert timeout == 20
            sent.append(request)
            return Response()

    monkeypatch.setattr("dsa_api.urllib.request.build_opener", lambda *args: Opener())
    api = client(content)
    api.get("/api/dsa/lessons/binary-search")
    assert sent == []
    result = api.post("/api/dsa/tutor", json={"lessonId": "binary-search", "question": "Why?", "mode": "socratic", "context": {"frame": {"lo": 0}, "code": "print(1)"}})
    assert result.status_code == 200
    assert result.json()["provider"] == "model"
    assert "secret-token" not in result.text
    payload = json.loads(sent[0].data)
    context = json.loads(payload["messages"][1]["content"])
    assert context["context"]["frame"] == {"lo": 0}
    assert context["mode"] == "socratic"


def test_external_provider_failure_redacts_secrets(content, monkeypatch):
    monkeypatch.setenv("ACADEMY_TUTOR_URL", "https://example.invalid/v1/chat/completions")
    monkeypatch.setenv("ACADEMY_TUTOR_MODEL", "model")

    def failed(*args):
        raise OSError("secret URL or credential")

    monkeypatch.setattr("dsa_api.urllib.request.build_opener", failed)
    response = client(content).post("/api/dsa/tutor", json={"lessonId": "binary-search", "question": "Why?"})
    assert response.status_code == 502
    assert "secret" not in response.text
