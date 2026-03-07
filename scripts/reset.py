#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests",
#     "python-dotenv",
# ]
# ///
"""Reset EspoCRM by deleting all Emails, Contacts, and Accounts."""

import os
import subprocess

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


def cleanup_db():
    """Hard-delete soft-deleted records and orphaned pivot table rows."""
    db_user = os.environ.get("MYSQL_USER", "espocrm")
    db_pass = os.environ.get("MYSQL_PASSWORD", "espocrm_password")
    db_name = os.environ.get("MYSQL_DATABASE", "espocrm")
    sql = "; ".join([
        "DELETE FROM email_user",
        "DELETE FROM email_email_address",
        "DELETE FROM email WHERE deleted = 1",
        "DELETE FROM contact WHERE deleted = 1",
        "DELETE FROM account WHERE deleted = 1",
    ])
    subprocess.run(
        [
            "docker", "compose", "exec", "-T", "mariadb",
            "mariadb", f"-u{db_user}", f"-p{db_pass}", db_name,
            "-e", sql,
        ],
        check=True,
        capture_output=True,
    )
    print("  Cleaned up database")


def main():
    api = EspoAPI()
    print("Resetting EspoCRM...")
    for entity in ENTITIES:
        delete_all(api, entity)
    cleanup_db()
    print("Reset complete.")


if __name__ == "__main__":
    main()
