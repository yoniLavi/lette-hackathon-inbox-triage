#!/usr/bin/env bash
# Run all integration tests. Requires: docker compose up -d
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec pnpm vitest run "$@"
