"""DSA state must round-trip through the existing authenticated account API."""
import json

import pytest
from fastapi.testclient import TestClient

import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(app, 'DB_PATH', str(tmp_path / 'account.db'))
    app._BUCKETS.clear()
    with TestClient(app.app) as client:
        yield client


def test_dsa_notes_library_mastery_roundtrip_with_revision_conflict(client):
    assert client.post('/api/register', json={'username': 'learner', 'email': 'learner@example.com', 'password': 'testpassword'}).status_code == 201
    data = {'martinium:dsa:v1': json.dumps({'version': 1, 'notes': {'topic:binary-search': 'Half-open intervals'}, 'library': {'resource': {'status': 'Learning'}}, 'evidence': {'binary-search:Trace:prediction': {'passed': True}}})}
    first = client.put('/api/state', json={'data': data, 'expectedUpdated': None, 'owner': 'learner'})
    assert first.status_code == 200
    assert client.get('/api/state').json()['data'] == data
    assert client.put('/api/state', json={'data': {}, 'expectedUpdated': None, 'owner': 'learner'}).status_code == 409
    assert client.put('/api/state', json={'data': {}, 'expectedUpdated': first.json()['updated'], 'owner': 'someone-else'}).status_code == 409
    assert client.get('/api/state').json()['data'] == data


def test_external_tutor_requires_login(client, monkeypatch):
    monkeypatch.setenv('ACADEMY_TUTOR_URL', 'https://provider.invalid/v1/chat/completions')
    monkeypatch.setenv('ACADEMY_TUTOR_MODEL', 'configured-model')
    response = client.post('/api/dsa/tutor', json={'lessonId': 'binary-search', 'question': 'Explain the invariant'})
    assert response.status_code == 401


def test_guided_tutor_is_available_without_model_or_account(client, monkeypatch):
    monkeypatch.delenv('ACADEMY_TUTOR_URL', raising=False)
    monkeypatch.delenv('ACADEMY_TUTOR_MODEL', raising=False)
    response = client.post('/api/dsa/tutor', json={'lessonId': 'binary-search', 'mode': 'socratic', 'question': 'Why logarithmic?'})
    assert response.status_code == 200
    assert response.json()['provider'] == 'guided'
