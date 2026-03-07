#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests",
#     "python-dotenv",
# ]
# ///
"""Reset EspoCRM by deleting all Emails, Contacts, and Accounts."""

from espo_api import EspoAPI

ENTITIES = ["Email", "Contact", "Account"]


def delete_all(api, entity_type):
    deleted = 0
    while True:
        result = api.get(entity_type, {"maxSize": 200, "select": "id"})
        items = result.get("list", [])
        if not items:
            break
        for item in items:
            api.delete(f"{entity_type}/{item['id']}")
            deleted += 1
    print(f"  Deleted {deleted} {entity_type} records")


def main():
    api = EspoAPI()
    print("Resetting EspoCRM...")
    for entity in ENTITIES:
        delete_all(api, entity)
    print("Reset complete.")


if __name__ == "__main__":
    main()
