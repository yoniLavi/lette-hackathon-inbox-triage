#!/bin/sh
set -e

# Install CRM CLI if available (bind-mounted in dev compose)
if [ -d /opt/crm-cli ]; then
  # Make the crm CLI available on PATH via npx tsx
  mkdir -p "$HOME/.local/bin"
  cat > "$HOME/.local/bin/crm" << 'WRAPPER'
#!/bin/sh
exec npx tsx /opt/crm-cli/src/index.ts "$@"
WRAPPER
  chmod +x "$HOME/.local/bin/crm"
  export PATH="$HOME/.local/bin:$PATH"
  # Install crm-cli dependencies if needed (crm-cli is a standalone HTTP client
  # with no workspace deps, so plain npm install is sufficient).
  # Check for broken pnpm symlinks (bind-mounted from host workspace) by testing
  # if commander is actually resolvable, not just if node_modules/ exists.
  if [ -f /opt/crm-cli/package.json ]; then
    if ! node -e "require.resolve('commander', {paths:['/opt/crm-cli']})" 2>/dev/null; then
      echo "[entrypoint] Installing crm-cli dependencies..."
      (cd /opt/crm-cli && rm -rf node_modules && npm install --omit=dev --no-audit --no-fund)
      # Verify install succeeded — fail loudly if not
      if ! node -e "require.resolve('commander', {paths:['/opt/crm-cli']})" 2>/dev/null; then
        echo "[entrypoint] FATAL: crm-cli dependencies failed to install" >&2
        exit 1
      fi
    fi
  fi
fi

# Start clawling via tsx (TypeScript execution without build step)
cd /app && exec npx tsx src/index.ts
