#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests",
#     "python-dotenv",
# ]
# ///
"""CLI for EspoCRM REST API. Credentials loaded from .env automatically.

Usage:
    uv run scripts/espo_cli.py get "Email?maxSize=2&select=id,subject"
    uv run scripts/espo_cli.py post User '{"userName":"agent","type":"api"}'
    uv run scripts/espo_cli.py put "User/abc123" '{"isActive":true}'
    uv run scripts/espo_cli.py delete "User/abc123"
"""

import json
import sys

from espo_api import EspoAPI


def main():
    if len(sys.argv) < 3:
        print(__doc__.strip())
        sys.exit(1)

    method = sys.argv[1].upper()
    path = sys.argv[2]
    body = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None

    api = EspoAPI()

    if method == "GET":
        result = api.get(path)
    elif method == "POST":
        result = api.post(path, body or {})
    elif method == "PUT":
        result = api.put(path, body or {})
    elif method == "DELETE":
        api.delete(path)
        print("Deleted.")
        return
    else:
        print(f"Unknown method: {method}")
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
