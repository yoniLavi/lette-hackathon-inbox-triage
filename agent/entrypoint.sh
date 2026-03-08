#!/bin/sh
set -e

# If arguments are passed, run one-shot CLI mode (backwards compat)
if [ $# -gt 0 ]; then
  exec claude -p "$*" \
    --mcp-config /app/mcp.json \
    --dangerously-skip-permissions
fi

# Default: start the FastAPI server
cd /app && exec uv run uvicorn api:app --host 0.0.0.0 --port 8001
