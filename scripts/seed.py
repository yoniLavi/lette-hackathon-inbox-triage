#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "httpx",
# ]
# ///
"""Seed CRM API with challenge dataset: properties, contacts, emails, cases, tasks."""

import json
import os
import sys
from pathlib import Path

import httpx

DATA_PATH = Path(__file__).resolve().parent.parent / "challenge-definition" / "proptech-test-data.json"
CRM_API_URL = os.environ.get("CRM_API_URL", "http://localhost:8002")

client = httpx.Client(base_url=CRM_API_URL, timeout=30)


def api_post(entity: str, data: dict) -> dict:
    resp = client.post(f"/api/{entity}", json=data)
    if resp.status_code != 201:
        print(f"  ERROR creating {entity}: {resp.status_code} {resp.text}", file=sys.stderr)
        resp.raise_for_status()
    return resp.json()


def load_data():
    return json.loads(DATA_PATH.read_text())


def seed_properties(properties):
    """Create a Property per challenge property. Returns {challenge_id: crm_id}."""
    prop_map = {}
    for prop in properties:
        # Derive manager_email from manager name: "John Smith" → "john.smith@manageco.ie"
        manager_name = prop["manager"]
        manager_email = manager_name.lower().replace(" ", ".") + "@manageco.ie" if manager_name else None
        payload = {
            "name": prop["name"],
            "type": prop["type"],
            "units": prop["units"],
            "manager": manager_name,
            "challenge_id": prop["id"],
        }
        if manager_email:
            payload["manager_email"] = manager_email
        created = api_post("properties", payload)
        prop_map[prop["id"]] = created["id"]
        print(f"  Property: {prop['name']} → {created['id']}")
    return prop_map


def extract_senders(emails):
    """Return list of unique senders (first occurrence wins)."""
    seen = {}
    for email in emails:
        addr = email["from"]["email"].lower()
        if addr not in seen:
            seen[addr] = email["from"]
    return list(seen.values())


def split_name(full_name):
    parts = full_name.strip().split()
    if len(parts) == 1:
        return "", parts[0]
    return " ".join(parts[:-1]), parts[-1]


def seed_contacts(senders, prop_map):
    """Create a Contact per unique sender. Returns {email_addr: crm_id}."""
    contact_map = {}
    for sender in senders:
        first, last = split_name(sender["name"])
        payload = {
            "first_name": first,
            "last_name": last,
            "email": sender["email"],
            "type": sender["type"],
        }
        if "role" in sender:
            payload["role"] = sender["role"]
        if "company" in sender:
            payload["company"] = sender["company"]
        if "unit" in sender:
            payload["unit"] = sender["unit"]

        prop_id = sender.get("property_id")
        if prop_id and prop_id in prop_map:
            payload["property_id"] = prop_map[prop_id]

        created = api_post("contacts", payload)
        contact_map[sender["email"].lower()] = created["id"]
        print(f"  Contact: {sender['name']} <{sender['email']}> → {created['id']}")
    return contact_map


def parse_addresses(field):
    if not field:
        return []
    return [a.strip() for a in field.split(",") if a.strip()]


def seed_emails(emails):
    """Create Emails with threading. Returns {challenge_id: crm_id}."""
    sorted_emails = sorted(emails, key=lambda e: (e["thread_id"], e["thread_position"]))
    email_map = {}

    for email in sorted_emails:
        to_addrs = parse_addresses(email["to"])
        cc_addrs = parse_addresses(email.get("cc"))

        payload = {
            "subject": email["subject"],
            "body": email["body"],
            "body_plain": email["body"],
            "from_address": email["from"]["email"],
            "to_addresses": to_addrs,
            "date_sent": email["timestamp"],
            "status": "archived",
            "is_read": email["read"],
            "thread_id": email["thread_id"],
            "thread_position": email["thread_position"],
            "challenge_id": email["id"],
            "message_id": f"<{email['id']}@proptech-challenge>",
        }

        if cc_addrs:
            payload["cc_addresses"] = cc_addrs

        # Link reply to parent via in_reply_to
        if email["thread_position"] > 1:
            parent = next(
                (e for e in sorted_emails
                 if e["thread_id"] == email["thread_id"]
                 and e["thread_position"] == email["thread_position"] - 1),
                None,
            )
            if parent:
                payload["in_reply_to"] = f"<{parent['id']}@proptech-challenge>"

        created = api_post("emails", payload)
        email_map[email["id"]] = created["id"]
        print(f"  Email: {email['id']} \"{email['subject'][:50]}\" → {created['id']}")

    print(f"Seeded {len(sorted_emails)} emails")
    return email_map


def main():
    data = load_data()
    print("Seeding CRM...\n")

    print("Creating Properties...")
    prop_map = seed_properties(data["metadata"]["properties"])
    print(f"\nCreated {len(prop_map)} properties\n")

    print("Creating Contacts...")
    senders = extract_senders(data["emails"])
    contact_map = seed_contacts(senders, prop_map)
    print(f"\nCreated {len(contact_map)} contacts\n")

    print("Creating Emails...")
    seed_emails(data["emails"])

    print("\nSeed complete.")


if __name__ == "__main__":
    main()
