# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27", "pytest>=8"]
# ///
"""Integration tests for the agent API.

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


def test_session_inactive_initially(api):
    r = api.get("/session/status")
    assert r.status_code == 200
    data = r.json()
    assert data["active"] is False
    assert data["message_count"] == 0
    assert data["busy"] is False


def test_prompt_basic(api):
    r = api.post("/prompt", json={"message": "Say hello in exactly 3 words."})
    assert r.status_code == 200
    data = r.json()
    assert len(data["response"]) > 0
    assert "session_id" in data


def test_session_active_after_prompt(api):
    r = api.get("/session/status")
    data = r.json()
    assert data["active"] is True
    assert data["message_count"] >= 1


def test_restart_clears_session(api):
    api.post("/session/restart")
    r = api.get("/session/status")
    data = r.json()
    assert data["active"] is False
    assert data["message_count"] == 0


def test_prompt_works_after_restart(api):
    r = api.post("/prompt", json={"message": "What is 2 + 2? Reply with just the number."})
    assert r.status_code == 200
    assert "4" in r.json()["response"]


def test_crm_query_returns_data(api):
    r = api.post(
        "/prompt",
        json={"message": "Use the EspoCRM MCP tools to count how many Email records exist. Return ONLY the number."},
    )
    assert r.status_code == 200
    assert len(r.json()["response"]) > 0
