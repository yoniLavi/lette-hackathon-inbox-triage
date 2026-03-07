#!/bin/sh
set -e

if [ $# -eq 0 ]; then
  echo "Usage: docker compose run agent \"<prompt>\""
  echo "Example: docker compose run agent \"List all emails in the CRM\""
  exit 1
fi

exec claude -p "$*" \
  --mcp-config /app/mcp.json \
  --dangerously-skip-permissions
