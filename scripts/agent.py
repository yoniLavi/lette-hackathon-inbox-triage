#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///
"""Run a prompt against the CRM agent.

Usage:
    uv run scripts/agent.py "List all emails in the CRM"
    uv run scripts/agent.py "Find contacts related to Riverside Apartments"
    echo "Summarise urgent emails" | uv run scripts/agent.py

Commands:
    uv run scripts/agent.py --restart    Restart the agent session
    uv run scripts/agent.py --status     Show session status
    uv run scripts/agent.py --shift      Start a batch email processing shift
"""

import sys

import httpx

AGENT_URL = "http://localhost:8001"


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--restart":
        resp = httpx.post(f"{AGENT_URL}/session/restart")
        resp.raise_for_status()
        print("Session restarted.")
        return

    if len(sys.argv) > 1 and sys.argv[1] == "--shift":
        import time
        print("Starting shift (batch email processing)...")
        try:
            resp = httpx.post(f"{AGENT_URL}/shift", timeout=30.0)
        except httpx.ConnectError:
            print("Error: cannot connect to agent API at", AGENT_URL, file=sys.stderr)
            print("Is the agent running? Try: docker compose up -d", file=sys.stderr)
            sys.exit(1)
        if resp.status_code == 409:
            print("Error: agent is busy with another request", file=sys.stderr)
            sys.exit(1)
        resp.raise_for_status()
        shift_id = resp.json()["shift_id"]
        print(f"Shift {shift_id} started. Polling for completion...")

        crm_url = "http://localhost:8002"
        while True:
            time.sleep(3)
            try:
                status_resp = httpx.get(f"{crm_url}/api/shifts/{shift_id}", timeout=10.0)
                status_resp.raise_for_status()
                shift_data = status_resp.json()
                status = shift_data.get("status", "unknown")
                if status in ("completed", "failed"):
                    print(f"\nShift {status}.")
                    if shift_data.get("summary"):
                        print(shift_data["summary"])
                    break
                print(".", end="", flush=True)
            except Exception as e:
                print(f"\nPolling error: {e}", file=sys.stderr)
                break
        return

    if len(sys.argv) > 1 and sys.argv[1] == "--status":
        resp = httpx.get(f"{AGENT_URL}/session/status")
        resp.raise_for_status()
        data = resp.json()
        print(f"Active: {data['active']}")
        print(f"Session ID: {data['session_id']}")
        print(f"Messages: {data['message_count']}")
        print(f"Busy: {data['busy']}")
        return

    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    elif not sys.stdin.isatty():
        prompt = sys.stdin.read().strip()
    else:
        print(__doc__.strip())
        sys.exit(1)

    if not prompt:
        print("Error: empty prompt", file=sys.stderr)
        sys.exit(1)

    try:
        resp = httpx.post(
            f"{AGENT_URL}/prompt",
            json={"message": prompt},
            timeout=300.0,
        )
    except httpx.ConnectError:
        print("Error: cannot connect to agent API at", AGENT_URL, file=sys.stderr)
        print("Is the agent running? Try: docker compose up -d", file=sys.stderr)
        sys.exit(1)

    if resp.status_code == 409:
        print("Error: agent is busy processing another prompt", file=sys.stderr)
        sys.exit(1)

    resp.raise_for_status()
    data = resp.json()
    print(data["response"])


if __name__ == "__main__":
    main()
