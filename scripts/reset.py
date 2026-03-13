#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "httpx",
# ]
# ///
"""Reset CRM by deleting all data via the API."""

import os

import httpx

CRM_API_URL = os.environ.get("CRM_API_URL", "http://localhost:8002")
client = httpx.Client(base_url=CRM_API_URL, timeout=30)

# Order matters: delete children before parents (FK constraints)
ENTITIES = ["notes", "tasks", "shifts", "threads", "emails", "cases", "contacts", "properties"]


def delete_all(entity: str):
    resp = client.delete(f"/api/{entity}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"  Deleted {data.get('count', '?')} {entity}")
    elif resp.status_code == 404:
        pass  # no data
    else:
        print(f"  Error deleting {entity}: {resp.status_code} {resp.text}")


def main():
    print("Resetting CRM...")
    for entity in ENTITIES:
        delete_all(entity)
    print("Reset complete.")


if __name__ == "__main__":
    main()
