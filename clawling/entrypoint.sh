#!/bin/sh
set -e

# Install CRM CLI if available (bind-mounted in dev compose)
if [ -d /opt/crm-cli ]; then
  # Make the crm CLI available on PATH via npx tsx
  mkdir -p /usr/local/bin
  cat > /usr/local/bin/crm << 'WRAPPER'
#!/bin/sh
exec npx tsx /opt/crm-cli/src/index.ts "$@"
WRAPPER
  chmod +x /usr/local/bin/crm
  # Install crm-cli dependencies if needed
  if [ -f /opt/crm-cli/package.json ] && [ ! -d /opt/crm-cli/node_modules ]; then
    cd /opt/crm-cli && npm install --production 2>/dev/null || true
    cd /app
  fi
fi

# Start clawling via tsx (TypeScript execution without build step)
cd /app && exec npx tsx src/index.ts
