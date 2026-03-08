# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27", "pytest>=8"]
# ///
"""Integration tests for the CRM API.

Requires the Docker Compose stack to be running:
    docker compose up -d

Run via:
    ./scripts/test.sh
"""

import httpx
import pytest

CRM_URL = "http://localhost:8002"


@pytest.fixture(scope="module")
def api():
    with httpx.Client(base_url=CRM_URL, timeout=30) as c:
        yield c


def test_health(api):
    r = api.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_counts(api):
    r = api.get("/api/counts")
    assert r.status_code == 200
    data = r.json()
    assert "emails" in data
    assert "open_tasks" in data
    assert "closed_cases" in data


def test_list_properties(api):
    r = api.get("/api/properties")
    assert r.status_code == 200
    data = r.json()
    assert "list" in data
    assert "total" in data


def test_crud_lifecycle(api):
    # Create
    r = api.post("/api/cases", json={
        "name": "Test Case",
        "status": "new",
        "priority": "medium",
    })
    assert r.status_code == 201
    case = r.json()
    case_id = case["id"]
    assert case["name"] == "Test Case"

    # Read
    r = api.get(f"/api/cases/{case_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "Test Case"

    # Update
    r = api.patch(f"/api/cases/{case_id}", json={"status": "closed"})
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    # Delete
    r = api.delete(f"/api/cases/{case_id}")
    assert r.status_code == 200

    # Verify deleted
    r = api.get(f"/api/cases/{case_id}")
    assert r.status_code == 404


def test_list_with_filters(api):
    # Create two emails with different statuses
    e1 = api.post("/api/emails", json={
        "subject": "Test Draft",
        "status": "draft",
        "from_address": "test@test.com",
    })
    e2 = api.post("/api/emails", json={
        "subject": "Test Archived",
        "status": "archived",
        "from_address": "test@test.com",
    })
    assert e1.status_code == 201
    assert e2.status_code == 201

    # Filter by status
    r = api.get("/api/emails", params={"status": "draft"})
    data = r.json()
    assert all(e["status"] == "draft" for e in data["list"])

    # Clean up
    api.delete(f"/api/emails/{e1.json()['id']}")
    api.delete(f"/api/emails/{e2.json()['id']}")


def test_full_text_search(api):
    # Create an email with searchable content
    e = api.post("/api/emails", json={
        "subject": "URGENT water leak in bedroom",
        "body": "Water is coming through the ceiling and damaging the floor",
        "status": "archived",
        "from_address": "tenant@test.com",
    })
    assert e.status_code == 201
    email_id = e.json()["id"]

    # Search should find it
    r = api.get("/api/emails", params={"search": "water leak"})
    data = r.json()
    assert data["total"] >= 1
    found = any(em["id"] == email_id for em in data["list"])
    assert found, "Full-text search should find the email"

    # Clean up
    api.delete(f"/api/emails/{email_id}")


def test_unknown_entity_404(api):
    r = api.get("/api/nonexistent")
    assert r.status_code == 404
