#!/bin/sh
set -e

# Ensure uv tool bin is on PATH
export PATH="$HOME/.local/bin:$PATH"

# Install CRM CLI if available (bind-mounted in dev compose)
if [ -d /opt/crm-cli ]; then
  uv tool install /opt/crm-cli 2>/dev/null || true
fi

# Start clawling via tsx (TypeScript execution without build step)
cd /app && exec npx tsx src/index.ts
