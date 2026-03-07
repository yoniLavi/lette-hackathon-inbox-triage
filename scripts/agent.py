#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Run a prompt against the CRM agent.

Usage:
    uv run scripts/agent.py "List all emails in the CRM"
    uv run scripts/agent.py "Find contacts related to Riverside Apartments"
    echo "Summarise urgent emails" | uv run scripts/agent.py
"""

import subprocess
import sys


def main():
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

    result = subprocess.run(
        ["docker", "compose", "run", "--rm", "agent", prompt],
        cwd=subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], text=True
        ).strip(),
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
