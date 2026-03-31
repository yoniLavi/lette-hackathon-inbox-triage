# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27", "pytest>=8"]
# ///
"""Integration tests for the clawling gateway API.

Requires the full Docker Compose stack to be running:
    docker compose up -d

Run via:
    ./scripts/test.sh
"""

import httpx
import pytest

AGENT_URL = "http://localhost:8001"


@pytest.fixture(scope="module")
def api():
    with httpx.Client(base_url=AGENT_URL, timeout=300.0) as c:
        c.post("/session/restart")
        yield c
        c.post("/session/restart")


def test_health(api):
    r = api.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_session_status_idle(api):
    r = api.get("/session/status")
    assert r.status_code == 200
    data = r.json()
    assert data["active"] is False
    assert data["busy"] is False


def test_session_restart(api):
    r = api.post("/session/restart")
    assert r.status_code == 200
    assert r.json()["status"] == "restarted"


def test_chat_completions_unknown_agent(api):
    r = api.post("/v1/chat/completions", json={
        "model": "clawling/nonexistent",
        "messages": [{"role": "user", "content": "hello"}],
    })
    assert r.status_code == 404


def test_chat_completions_no_user_message(api):
    r = api.post("/v1/chat/completions", json={
        "model": "clawling/frontend",
        "messages": [],
    })
    assert r.status_code == 400


def test_chat_completions_streaming(api):
    """Frontend agent responds with SSE streaming."""
    with api.stream("POST", "/v1/chat/completions", json={
        "model": "clawling/frontend",
        "stream": True,
        "messages": [{"role": "user", "content": "Say hello in exactly 3 words."}],
    }) as r:
        assert r.status_code == 200
        got_data = False
        got_done = False
        for line in r.iter_lines():
            if line.startswith("data: "):
                got_data = True
                if line == "data: [DONE]":
                    got_done = True
                    break
        assert got_data, "Should have received SSE data events"
        assert got_done, "Should have received [DONE] terminator"


def test_chat_completions_non_streaming(api):
    """Frontend agent responds with a single JSON response."""
    r = api.post("/v1/chat/completions", json={
        "model": "clawling/frontend",
        "stream": False,
        "messages": [{"role": "user", "content": "Say hello in exactly 3 words."}],
    })
    assert r.status_code == 200
    data = r.json()
    assert data["object"] == "chat.completion"
    assert len(data["choices"]) == 1
    assert len(data["choices"][0]["message"]["content"]) > 0
    assert "clawling" in data
    assert "sessionId" in data["clawling"]


def test_wake_unknown_agent(api):
    r = api.post("/v1/wake/nonexistent", json={"prompt": "/shift"})
    assert r.status_code == 404


def test_wake_missing_prompt(api):
    r = api.post("/v1/wake/worker", json={})
    assert r.status_code == 400


def test_status_unknown_task(api):
    r = api.get("/v1/status/nonexistent-id")
    assert r.status_code == 404
    assert r.json()["status"] == "not_found"


def test_wake_worker_returns_task_id(api):
    """Wake the worker and verify a taskId is returned (worker may fail without CRM, that's ok)."""
    r = api.post("/v1/wake/worker", json={"prompt": "echo hello"})
    assert r.status_code == 200
    data = r.json()
    assert "taskId" in data
    assert len(data["taskId"]) > 0
