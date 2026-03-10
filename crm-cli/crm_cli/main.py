"""CRM CLI — command-line interface for the CRM API.

Usage:
    crm <entity> list [--limit N] [--order-by FIELD] [--status S] [--search Q] ...
    crm <entity> get <id> [--include emails,contact]
    crm <entity> create --json '{...}'
    crm <entity> update <id> --json '{...}'
    crm <entity> delete <id>
    crm shift next
    crm shift complete --json '{...}'
    crm emails bulk-update --json '{...}'
"""

import json
import os
import sys

import click
import httpx

CRM_API_URL = os.environ.get("CRM_API_URL", "http://localhost:8002")


def _url(path: str) -> str:
    return f"{CRM_API_URL}/api/{path}"


def _output(data):
    json.dump(data, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")


def _request(method: str, path: str, **kwargs):
    try:
        resp = httpx.request(method, _url(path), timeout=30, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail", str(e))
        except Exception:
            detail = str(e)
        click.echo(f"Error: {detail}", err=True)
        sys.exit(1)
    except httpx.ConnectError:
        click.echo(f"Error: cannot connect to CRM API at {CRM_API_URL}", err=True)
        sys.exit(1)


@click.group()
def cli():
    """CRM command-line interface."""


_entity_groups: dict[str, click.Group] = {}


def _add_entity_commands(entity_name: str):
    """Register list/get/create/update/delete commands for an entity."""

    @cli.group(entity_name)
    def group():
        pass

    _entity_groups[entity_name] = group

    @group.command("list")
    @click.option("--limit", "-l", default=20, type=int, help="Max results")
    @click.option("--offset", default=0, type=int)
    @click.option("--order-by", "-o", "order_by", default="created_at")
    @click.option("--order", default="desc", type=click.Choice(["asc", "desc"]))
    @click.option("--status")
    @click.option("--priority")
    @click.option("--property-id", "property_id", type=int)
    @click.option("--case-id", "case_id", type=int)
    @click.option("--contact-id", "contact_id", type=int)
    @click.option("--thread-id", "thread_id")
    @click.option("--email")
    @click.option("--type")
    @click.option("--search", "-s", help="Full-text search (emails)")
    @click.option("--is-read", "is_read")
    @click.option("--is-replied", "is_replied")
    @click.option("--challenge-id", "challenge_id")
    @click.option("--include", "include", help="Comma-separated related entities to include")
    def list_cmd(**kwargs):
        params = {k: v for k, v in kwargs.items() if v is not None}
        _output(_request("GET", entity_name, params=params))

    @group.command("get")
    @click.argument("item_id", type=int)
    @click.option("--include", "include", help="Comma-separated related entities to include")
    def get_cmd(item_id, include):
        params = {}
        if include:
            params["include"] = include
        _output(_request("GET", f"{entity_name}/{item_id}", params=params))

    @group.command("create")
    @click.option("--json", "json_str", required=True, help="JSON object to create")
    def create_cmd(json_str):
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            click.echo(f"Error: invalid JSON: {e}", err=True)
            sys.exit(1)
        _output(_request("POST", entity_name, json=data))

    @group.command("update")
    @click.argument("item_id", type=int)
    @click.option("--json", "json_str", required=True, help="JSON fields to update")
    def update_cmd(item_id, json_str):
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            click.echo(f"Error: invalid JSON: {e}", err=True)
            sys.exit(1)
        _output(_request("PATCH", f"{entity_name}/{item_id}", json=data))

    @group.command("delete")
    @click.argument("item_id", type=int)
    def delete_cmd(item_id):
        _output(_request("DELETE", f"{entity_name}/{item_id}"))


for _entity in ["properties", "contacts", "emails", "cases", "tasks", "notes", "threads"]:
    _add_entity_commands(_entity)


# ---------------------------------------------------------------------------
# Shift commands
# ---------------------------------------------------------------------------
@cli.group("shift")
def shift_group():
    """Shift work-item commands."""


@shift_group.command("next")
def shift_next():
    """Get the next unread thread with full case context."""
    _output(_request("GET", "shift/next"))


@shift_group.command("complete")
@click.option("--json", "json_str", required=True, help='{"email_ids": [...], "thread_id": "...", "case_id": N}')
def shift_complete(json_str):
    """Mark a thread as processed."""
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        click.echo(f"Error: invalid JSON: {e}", err=True)
        sys.exit(1)
    _output(_request("POST", "shift/complete", json=data))


# ---------------------------------------------------------------------------
# Bulk email update (added to the emails group after entity registration)
# ---------------------------------------------------------------------------
@_entity_groups["emails"].command("bulk-update")
@click.option("--json", "json_str", required=True, help='{"ids": [...], "updates": {...}}')
def bulk_update_emails(json_str):
    """Batch update emails by ID list."""
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        click.echo(f"Error: invalid JSON: {e}", err=True)
        sys.exit(1)
    _output(_request("PATCH", "emails/bulk", json=data))
