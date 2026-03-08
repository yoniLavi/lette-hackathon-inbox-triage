#!/bin/sh
set -e

# Ensure uv tool bin is on PATH
export PATH="$HOME/.local/bin:$PATH"

# Install CRM CLI if available (bind-mounted in dev compose)
if [ -d /opt/crm-cli ]; then
  uv tool install /opt/crm-cli 2>/dev/null || true
fi

# If arguments are passed, run one-shot CLI mode (backwards compat)
if [ $# -gt 0 ]; then
  exec claude -p "$*" \
    --dangerously-skip-permissions
fi

# Default: start the FastAPI server
cd /app && exec uv run uvicorn api:app --host 0.0.0.0 --port 8001
