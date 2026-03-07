#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests",
#     "python-dotenv",
# ]
# ///
"""Seed EspoCRM with challenge dataset: properties → Accounts, senders → Contacts, emails → Emails."""

import json
from pathlib import Path

from espo_api import EspoAPI

DATA_PATH = Path(__file__).resolve().parent.parent / "challenge-definition" / "proptech-test-data.json"


def load_data():
    return json.loads(DATA_PATH.read_text())


def seed_accounts(api, properties):
    """Create an Account per property. Returns {property_id: espo_account_id}."""
    account_map = {}
    for prop in properties:
        desc = f"Type: {prop['type']}\nUnits: {prop['units']}\nManager: {prop['manager']}"
        account = api.post("Account", {"name": prop["name"], "description": desc})
        account_map[prop["id"]] = account["id"]
        print(f"  Account: {prop['name']} → {account['id']}")
    return account_map


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


def seed_contacts(api, senders, account_map):
    """Create a Contact per unique sender. Returns {email_addr: espo_contact_id}."""
    contact_map = {}
    for sender in senders:
        first, last = split_name(sender["name"])
        desc_parts = [f"Type: {sender['type']}"]
        if "role" in sender:
            desc_parts.append(f"Role: {sender['role']}")
        if "company" in sender:
            desc_parts.append(f"Company: {sender['company']}")
        if "unit" in sender:
            desc_parts.append(f"Unit: {sender['unit']}")

        payload = {
            "firstName": first,
            "lastName": last,
            "emailAddress": sender["email"],
            "description": "\n".join(desc_parts),
        }
        prop_id = sender.get("property_id")
        if prop_id and prop_id in account_map:
            payload["accountId"] = account_map[prop_id]

        contact = api.post("Contact", payload)
        contact_map[sender["email"].lower()] = contact["id"]
        print(f"  Contact: {sender['name']} <{sender['email']}> → {contact['id']}")
    return contact_map


def parse_addresses(field):
    if not field:
        return []
    return [a.strip() for a in field.split(",") if a.strip()]


def seed_emails(api, emails):
    """Create Emails with threading. Sorts by thread/position to seed parents first."""
    sorted_emails = sorted(emails, key=lambda e: (e["thread_id"], e["thread_position"]))

    # thread_id → list of espo email ids (ordered by position)
    thread_map = {}

    for email in sorted_emails:
        to_addrs = parse_addresses(email["to"])
        cc_addrs = parse_addresses(email.get("cc"))

        payload = {
            "subject": email["subject"],
            "body": email["body"],
            "bodyPlain": email["body"],
            "isHtml": False,
            "dateSent": email["timestamp"],
            "status": "Archived",
            "isRead": email["read"],
            "from": email["from"]["email"],
            "to": ";".join(to_addrs),
            "messageId": f"<{email['id']}@proptech-challenge>",
        }

        if cc_addrs:
            payload["cc"] = ";".join(cc_addrs)

        # Link reply to parent in same thread
        if email["thread_position"] > 1 and email["thread_id"] in thread_map:
            parent_idx = email["thread_position"] - 2
            parent_ids = thread_map[email["thread_id"]]
            if parent_idx < len(parent_ids):
                # Find parent email's original id for inReplyTo
                parent_original = next(
                    (e for e in sorted_emails
                     if e["thread_id"] == email["thread_id"]
                     and e["thread_position"] == email["thread_position"] - 1),
                    None,
                )
                payload["repliedId"] = parent_ids[parent_idx]
                if parent_original:
                    payload["inReplyTo"] = f"<{parent_original['id']}@proptech-challenge>"

        created = api.post("Email", payload)

        thread_map.setdefault(email["thread_id"], []).append(created["id"])
        print(f"  Email: {email['id']} \"{email['subject'][:50]}\" → {created['id']}")

    print(f"Seeded {len(sorted_emails)} emails")


def main():
    api = EspoAPI()
    data = load_data()
    print("Seeding EspoCRM...\n")

    print("Creating Accounts...")
    account_map = seed_accounts(api, data["metadata"]["properties"])
    print(f"\nCreated {len(account_map)} accounts\n")

    print("Creating Contacts...")
    senders = extract_senders(data["emails"])
    seed_contacts(api, senders, account_map)
    print(f"\nCreated {len(senders)} contacts\n")

    print("Creating Emails...")
    seed_emails(api, data["emails"])

    print("\nSeed complete.")


if __name__ == "__main__":
    main()
