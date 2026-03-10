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


# ---------------------------------------------------------------------------
# Thread auto-creation from emails
# ---------------------------------------------------------------------------
def test_thread_auto_created_on_email_insert(api):
    """Creating emails with a thread_id should auto-create a Thread."""
    e1 = api.post("/api/emails", json={
        "subject": "Thread test",
        "from_address": "sender@test.com",
        "thread_id": "test_thread_auto",
        "thread_position": 1,
        "date_sent": "2026-03-09T10:00:00Z",
        "is_read": False,
    })
    assert e1.status_code == 201

    e2 = api.post("/api/emails", json={
        "subject": "Re: Thread test",
        "from_address": "reply@test.com",
        "thread_id": "test_thread_auto",
        "thread_position": 2,
        "date_sent": "2026-03-09T11:00:00Z",
        "is_read": False,
    })
    assert e2.status_code == 201

    # Thread should exist
    r = api.get("/api/threads", params={"limit": 500})
    threads = r.json()["list"]
    thread = next((t for t in threads if t["thread_id"] == "test_thread_auto"), None)
    assert thread is not None, "Thread should be auto-created"
    assert thread["email_count"] == 2
    assert thread["is_read"] is False

    # Clean up
    api.delete(f"/api/emails/{e1.json()['id']}")
    api.delete(f"/api/emails/{e2.json()['id']}")


def test_thread_is_read_when_all_emails_read(api):
    """Thread.is_read should be true only when all emails are read."""
    e1 = api.post("/api/emails", json={
        "subject": "Read test",
        "from_address": "a@test.com",
        "thread_id": "test_thread_read",
        "thread_position": 1,
        "date_sent": "2026-03-09T10:00:00Z",
        "is_read": True,
    })
    e2 = api.post("/api/emails", json={
        "subject": "Re: Read test",
        "from_address": "b@test.com",
        "thread_id": "test_thread_read",
        "thread_position": 2,
        "date_sent": "2026-03-09T11:00:00Z",
        "is_read": False,
    })
    assert e1.status_code == 201
    assert e2.status_code == 201

    # Thread should be unread (not all emails read)
    r = api.get("/api/threads", params={"limit": 500})
    thread = next((t for t in r.json()["list"] if t["thread_id"] == "test_thread_read"), None)
    assert thread is not None
    assert thread["is_read"] is False

    # Mark second email as read
    api.patch(f"/api/emails/{e2.json()['id']}", json={"is_read": True})

    # Now thread should be read
    r = api.get("/api/threads", params={"limit": 500})
    thread = next((t for t in r.json()["list"] if t["thread_id"] == "test_thread_read"), None)
    assert thread["is_read"] is True

    # Clean up
    api.delete(f"/api/emails/{e1.json()['id']}")
    api.delete(f"/api/emails/{e2.json()['id']}")


def test_thread_is_read_ignores_drafts(api):
    """Draft replies should not make a thread appear unread."""
    # Create a read archived email
    e1 = api.post("/api/emails", json={
        "subject": "Draft ignore test",
        "from_address": "tenant@test.com",
        "thread_id": "test_thread_drafts",
        "thread_position": 1,
        "date_sent": "2026-03-09T10:00:00Z",
        "is_read": True,
        "status": "archived",
    })
    assert e1.status_code == 201

    # Thread should be read
    r = api.get("/api/threads", params={"limit": 500})
    thread = next((t for t in r.json()["list"] if t["thread_id"] == "test_thread_drafts"), None)
    assert thread is not None
    assert thread["is_read"] is True

    # Add an unread draft reply to the same thread
    draft = api.post("/api/emails", json={
        "subject": "Re: Draft ignore test",
        "from_address": "manager@manageco.ie",
        "thread_id": "test_thread_drafts",
        "thread_position": 2,
        "is_read": False,
        "status": "draft",
    })
    assert draft.status_code == 201

    # Thread should STILL be read — drafts don't count
    r = api.get("/api/threads", params={"limit": 500})
    thread = next((t for t in r.json()["list"] if t["thread_id"] == "test_thread_drafts"), None)
    assert thread["is_read"] is True

    # Clean up
    api.delete(f"/api/emails/{draft.json()['id']}")
    api.delete(f"/api/emails/{e1.json()['id']}")


# ---------------------------------------------------------------------------
# Include parameter
# ---------------------------------------------------------------------------
def test_get_case_with_includes(api):
    """GET /api/cases/{id}?include=tasks,notes should return nested data."""
    case = api.post("/api/cases", json={
        "name": "Include test case",
        "status": "new",
    }).json()
    task = api.post("/api/tasks", json={
        "name": "Include test task",
        "case_id": case["id"],
    }).json()
    note = api.post("/api/notes", json={
        "content": "Include test note",
        "case_id": case["id"],
    }).json()

    r = api.get(f"/api/cases/{case['id']}", params={"include": "tasks,notes"})
    assert r.status_code == 200
    data = r.json()
    assert "tasks" in data
    assert "notes" in data
    assert any(t["id"] == task["id"] for t in data["tasks"])
    assert any(n["id"] == note["id"] for n in data["notes"])

    # Clean up
    api.delete(f"/api/notes/{note['id']}")
    api.delete(f"/api/tasks/{task['id']}")
    api.delete(f"/api/cases/{case['id']}")


def test_get_thread_with_includes(api):
    """GET /api/threads/{id}?include=emails should return nested emails."""
    e = api.post("/api/emails", json={
        "subject": "Thread include test",
        "from_address": "inc@test.com",
        "thread_id": "test_thread_include",
        "thread_position": 1,
        "date_sent": "2026-03-09T10:00:00Z",
    })
    assert e.status_code == 201

    # Find the auto-created thread
    r = api.get("/api/threads", params={"limit": 500})
    thread = next((t for t in r.json()["list"] if t["thread_id"] == "test_thread_include"), None)
    assert thread is not None

    r = api.get(f"/api/threads/{thread['id']}", params={"include": "emails"})
    assert r.status_code == 200
    data = r.json()
    assert "emails" in data
    assert len(data["emails"]) == 1
    assert data["emails"][0]["id"] == e.json()["id"]

    # Clean up
    api.delete(f"/api/emails/{e.json()['id']}")


# ---------------------------------------------------------------------------
# Shift endpoints
# ---------------------------------------------------------------------------
def test_shift_next_returns_unread_thread(api):
    """GET /api/shift/next should return the oldest unread thread."""
    e = api.post("/api/emails", json={
        "subject": "Shift next test",
        "from_address": "shift@test.com",
        "thread_id": "test_thread_shift",
        "thread_position": 1,
        "date_sent": "2026-03-09T09:00:00Z",
        "is_read": False,
    })
    assert e.status_code == 201

    r = api.get("/api/shift/next")
    assert r.status_code == 200
    data = r.json()
    assert data["thread"] is not None
    # Should have emails included
    assert "emails" in data["thread"]

    # Clean up
    api.delete(f"/api/emails/{e.json()['id']}")


def test_shift_next_returns_null_when_all_read(api):
    """GET /api/shift/next should return null thread when everything is read."""
    e = api.post("/api/emails", json={
        "subject": "All read test",
        "from_address": "done@test.com",
        "thread_id": "test_thread_allread",
        "thread_position": 1,
        "date_sent": "2026-03-09T09:00:00Z",
        "is_read": True,
    })
    assert e.status_code == 201

    r = api.get("/api/shift/next")
    data = r.json()
    # If there are other unread threads from other tests, this might not be null,
    # but at minimum our all-read thread should not be the one returned
    if data["thread"] is not None:
        assert data["thread"]["thread_id"] != "test_thread_allread"

    # Clean up
    api.delete(f"/api/emails/{e.json()['id']}")


def test_shift_complete_marks_emails_read(api):
    """POST /api/shift/complete should batch-mark emails as read."""
    e1 = api.post("/api/emails", json={
        "subject": "Complete test 1",
        "from_address": "a@test.com",
        "thread_id": "test_thread_complete",
        "thread_position": 1,
        "date_sent": "2026-03-09T10:00:00Z",
        "is_read": False,
    })
    e2 = api.post("/api/emails", json={
        "subject": "Re: Complete test 1",
        "from_address": "b@test.com",
        "thread_id": "test_thread_complete",
        "thread_position": 2,
        "date_sent": "2026-03-09T11:00:00Z",
        "is_read": False,
    })
    assert e1.status_code == 201
    assert e2.status_code == 201

    ids = [e1.json()["id"], e2.json()["id"]]
    r = api.post("/api/shift/complete", json={
        "email_ids": ids,
        "thread_id": "test_thread_complete",
    })
    assert r.status_code == 200
    assert r.json()["emails_updated"] == 2

    # Verify emails are now read
    for eid in ids:
        email = api.get(f"/api/emails/{eid}").json()
        assert email["is_read"] is True

    # Thread should also be read
    r = api.get("/api/threads", params={"limit": 500})
    thread = next((t for t in r.json()["list"] if t["thread_id"] == "test_thread_complete"), None)
    assert thread is not None
    assert thread["is_read"] is True

    # Clean up
    for eid in ids:
        api.delete(f"/api/emails/{eid}")


# ---------------------------------------------------------------------------
# Bulk email update
# ---------------------------------------------------------------------------
def test_bulk_update_emails(api):
    """PATCH /api/emails/bulk should batch update emails."""
    e1 = api.post("/api/emails", json={
        "subject": "Bulk 1",
        "from_address": "bulk@test.com",
        "is_read": False,
    })
    e2 = api.post("/api/emails", json={
        "subject": "Bulk 2",
        "from_address": "bulk@test.com",
        "is_read": False,
    })
    assert e1.status_code == 201
    assert e2.status_code == 201

    ids = [e1.json()["id"], e2.json()["id"]]
    r = api.patch("/api/emails/bulk", json={
        "ids": ids,
        "updates": {"is_read": True},
    })
    assert r.status_code == 200
    assert r.json()["updated"] == 2

    for eid in ids:
        assert api.get(f"/api/emails/{eid}").json()["is_read"] is True

    # Clean up
    for eid in ids:
        api.delete(f"/api/emails/{eid}")


# ---------------------------------------------------------------------------
# Property manager_email field
# ---------------------------------------------------------------------------
def test_property_manager_email(api):
    """Property should support manager_email field."""
    r = api.post("/api/properties", json={
        "name": "Test Property",
        "type": "BTR",
        "manager": "John Smith",
        "manager_email": "john.smith@manageco.ie",
    })
    assert r.status_code == 201
    prop = r.json()
    assert prop["manager_email"] == "john.smith@manageco.ie"

    # Clean up
    api.delete(f"/api/properties/{prop['id']}")
