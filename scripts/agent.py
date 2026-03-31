#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///
"""Run a prompt against the CRM agent via clawling.

Usage:
    uv run scripts/agent.py "List all emails in the CRM"
    uv run scripts/agent.py "Find contacts related to Riverside Apartments"
    echo "Summarise urgent emails" | uv run scripts/agent.py

Commands:
    uv run scripts/agent.py --status     Show gateway health
    uv run scripts/agent.py --shift      Start a batch email processing shift
"""

import sys

import httpx

AGENT_URL = "http://localhost:8001"


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--shift":
        import time
        print("Starting shift (batch email processing)...")
        try:
            resp = httpx.post(
                f"{AGENT_URL}/v1/wake/worker",
                json={"prompt": "/shift"},
                timeout=30.0,
            )
        except httpx.ConnectError:
            print("Error: cannot connect to clawling at", AGENT_URL, file=sys.stderr)
            print("Is clawling running? Try: docker compose up -d", file=sys.stderr)
            sys.exit(1)
        if resp.status_code == 409:
            print("Error: agent is busy with another request", file=sys.stderr)
            sys.exit(1)
        resp.raise_for_status()
        task_id = resp.json()["taskId"]
        print(f"Task {task_id} started. Polling CRM for shift completion...")

        crm_url = "http://localhost:8002"
        # Wait for shift record to appear, then poll for completion
        shift_id = None
        for _ in range(10):
            time.sleep(2)
            try:
                shifts_resp = httpx.get(f"{crm_url}/api/shifts", params={"status": "in_progress", "limit": "1"}, timeout=10.0)
                shifts = shifts_resp.json().get("list", [])
                if shifts:
                    shift_id = shifts[0]["id"]
                    break
            except Exception:
                pass

        if not shift_id:
            print("Warning: could not find in-progress shift record, polling task status instead")
            # Fall back to polling clawling task status
            while True:
                time.sleep(3)
                try:
                    status_resp = httpx.get(f"{AGENT_URL}/v1/status/{task_id}", timeout=10.0)
                    data = status_resp.json()
                    if data.get("status") in ("completed", "failed"):
                        print(f"\nTask {data['status']}.")
                        if data.get("result"):
                            print(data["result"])
                        break
                    print(".", end="", flush=True)
                except Exception as e:
                    print(f"\nPolling error: {e}", file=sys.stderr)
                    break
            return

        print(f"Shift {shift_id} in progress. Polling...")
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
        resp = httpx.get(f"{AGENT_URL}/health")
        resp.raise_for_status()
        print(resp.json())
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
            f"{AGENT_URL}/v1/chat/completions",
            json={
                "model": "clawling/frontend",
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=300.0,
        )
    except httpx.ConnectError:
        print("Error: cannot connect to clawling at", AGENT_URL, file=sys.stderr)
        print("Is clawling running? Try: docker compose up -d", file=sys.stderr)
        sys.exit(1)

    if resp.status_code == 409:
        print("Error: agent is busy processing another prompt", file=sys.stderr)
        sys.exit(1)

    resp.raise_for_status()
    data = resp.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    print(content)


if __name__ == "__main__":
    main()
