#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests",
#     "python-dotenv",
# ]
# ///
"""Create an EspoCRM API user for the agent with full access. Idempotent."""

from espo_api import EspoAPI

USERNAME = "agent"
ROLE_NAME = "Agent Full Access"

# Scopes the agent needs access to
SCOPES = [
    "Email", "Contact", "Account", "Case", "Task",
    "Meeting", "Call", "Lead", "Opportunity", "Document",
]


def find_existing_user(api):
    users = api.get(f"User?where[0][type]=equals&where[0][attribute]=userName&where[0][value]={USERNAME}")
    for u in users.get("list", []):
        if u.get("type") == "api":
            return u
    return None


def find_existing_role(api):
    roles = api.get(f"Role?where[0][type]=equals&where[0][attribute]=name&where[0][value]={ROLE_NAME}")
    for r in roles.get("list", []):
        return r
    return None


def create_role(api):
    role = find_existing_role(api)
    if role:
        print(f"  Role '{ROLE_NAME}' already exists: {role['id']}")
        return role["id"]

    role = api.post("Role", {"name": ROLE_NAME})
    # Scope permissions can only be set via update
    scope_data = {scope: {"create": "yes", "read": "all", "edit": "all", "delete": "all"} for scope in SCOPES}
    api.put(f"Role/{role['id']}", {"data": scope_data})
    print(f"  Created role '{ROLE_NAME}': {role['id']}")
    return role["id"]


def create_api_user(api, role_id):
    user = find_existing_user(api)
    if user:
        print(f"  API user '{USERNAME}' already exists: {user['id']}")
        return user["apiKey"]

    user = api.post("User", {
        "userName": USERNAME,
        "type": "api",
        "authMethod": "ApiKey",
        "isActive": True,
        "rolesIds": [role_id],
    })
    print(f"  Created API user '{USERNAME}': {user['id']}")
    return user["apiKey"]


def main():
    api = EspoAPI()
    print("Creating agent API user...")
    role_id = create_role(api)
    api_key = create_api_user(api, role_id)
    print(f"\n  API Key: {api_key}")
    return api_key


if __name__ == "__main__":
    main()
