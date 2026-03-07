## 1. API User Provisioning
- [ ] 1.1 Create `scripts/create_api_user.py` — idempotent script that creates an EspoCRM API user via REST API and prints the API key
- [ ] 1.2 Integrate API user creation into the seed workflow (call from `seed.py` or `reseed.py`)

## 2. Agent Container
- [ ] 2.1 Create `agent/Dockerfile` — node:20-slim base, install Claude Code + EspoMCP
- [ ] 2.2 Create `agent/mcp.json` — EspoMCP stdio config with env var references
- [ ] 2.3 Create `agent/entrypoint.sh` — wrapper that runs `claude -p` with MCP config and permission flags

## 3. Docker Compose Integration
- [ ] 3.1 Add `agent` service to `docker-compose.yml` with Bedrock env vars, network access to espocrm, and volume mounts
- [ ] 3.2 Update `.env.example` with Bedrock credential placeholders and EspoCRM API key

## 4. Validation
- [ ] 4.1 Test: `docker compose build agent` succeeds
- [ ] 4.2 Test: `docker compose run agent "List all emails"` returns CRM data
