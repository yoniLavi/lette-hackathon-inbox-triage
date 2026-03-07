# Change: Add Claude Code agent container

## Why
The core value of this project is an AI agent that triages emails in EspoCRM. We need a containerised Claude Code instance that can connect to the CRM via the EspoMCP bridge and perform arbitrary operations — the foundation for the triage agent loop.

## What Changes
- New `agent/` directory with Dockerfile, MCP config, and entrypoint script
- New `agent` service in docker-compose.yml on the same network as EspoCRM
- New `scripts/create_api_user.py` to automatically provision an EspoCRM API user with full access
- Seed script updated to call API user creation automatically
- `.env` / `.env.example` updated with Bedrock credentials and EspoCRM API key
- Agent invocable via `docker compose run agent <prompt>` for ad-hoc CRM operations

## Impact
- Affected specs: new `agent-container` capability
- Affected code: `docker-compose.yml`, `scripts/`, `agent/` (new), `.env`
