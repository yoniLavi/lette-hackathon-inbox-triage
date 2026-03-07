# PropTech Email Triage Agent

Hackathon project for Lette AI's PropTech challenge (2026-03-07). An agentic AI system that helps property managers process high-volume tenant, landlord, and contractor communications.

## What It Does

- Triages incoming emails by urgency and sender type
- Links related threads and builds context across messages
- Surfaces recommended actions for the property manager
- Drafts responses within a real CRM (not isolated AI analysis)

## Architecture

```
                        ┌─── agent container ───────────────────┐
┌────────┐   HTTP API   │ ┌─────────────┐     ┌──────────┐     │     ┌──────────────┐
│ Client │─────────────▶│ │ FastAPI      │────▶│ EspoMCP  │─────│────▶│   EspoCRM    │
│        │◀─────────────│ │ (port 8001)  │◀────│ (stdio)  │◀────│────▶│ (system of   │
└────────┘              │ └─────────────┘     └──────────┘     │     │   record)    │
                        │       │                               │     └──────────────┘
                        │       ▼                               │
                        │  Claude Code SDK                      │
                        │  (persistent session via Bedrock)     │
                        └───────────────────────────────────────┘
```

The agent runs as a persistent HTTP service. Each prompt is processed within a long-lived Claude Code SDK session that accumulates context. EspoCRM is the system of record — all state lives in the CRM.

## Tech Stack

- **Docker Compose** — orchestrates the full stack
- **EspoCRM** — open-source CRM with email integration and REST API
- **EspoMCP** — MCP server bridging Claude to EspoCRM
- **Claude Code + Anthropic Agent SDK** — agentic AI layer
- **Python** — seed scripts and utilities

## Getting Started

Prerequisites: Docker, [uv](https://docs.astral.sh/uv/)

```bash
# 1. Start the stack
docker compose up -d

# 2. Wait for EspoCRM to finish initializing (~30s on first run)
#    Check with: docker compose logs -f espocrm

# 3. Seed test data (100 emails, 82 contacts, 5 accounts)
uv run scripts/seed.py

# 4. Open EspoCRM at http://localhost:8080
#    Login: admin / admin123
#    Emails are under the "All" folder: Emails → All
#    (direct link: http://localhost:8080/#Email/list/folder=all)
```

### Talking to the agent

The agent runs as a persistent API server inside Docker (port 8001). Use the CLI wrapper:

```bash
# Send a prompt
uv run scripts/agent.py "List all emails in the CRM"

# Check session status
uv run scripts/agent.py --status

# Restart session (clear context)
uv run scripts/agent.py --restart
```

Or call the API directly:

```bash
curl -X POST http://localhost:8001/prompt \
  -H 'Content-Type: application/json' \
  -d '{"message": "List all emails"}'
```

### Other commands

```bash
# Reset CRM to blank state (deletes all Emails, Contacts, Accounts)
uv run scripts/reset.py

# Reset + re-seed in one step
uv run scripts/reseed.py

# Run integration tests (stack must be running)
./scripts/test.sh
```

## Domain Context

Built for **BTR/PRS property management** in Ireland (Build-to-Rent / Private Rented Sector). The test dataset covers 5 properties with communications spanning maintenance emergencies, RTB disputes, lease renewals, rent arrears, fire/safety compliance, and more.

## Project Structure

```
agent/                  # Agent container (FastAPI + Claude Code SDK)
  api.py                # HTTP API server with session management
  pyproject.toml        # Python deps (managed by uv)
  Dockerfile            # Node.js + Python + EspoMCP
  entrypoint.sh         # Starts uvicorn (or one-shot CLI with args)
  mcp.json              # EspoMCP config for CLI fallback
scripts/                # Python scripts (run with uv)
  agent.py              # CLI wrapper for the agent API
  espo_api.py           # Shared EspoCRM API wrapper
  espo_cli.py           # General EspoCRM REST CLI
  seed.py               # Seed CRM with challenge dataset
  reset.py              # Delete all seeded data
  reseed.py             # Reset + seed in one step
  test.sh               # Run integration tests via pytest
tests/                  # Integration tests
  test_agent_api.py     # Agent API tests (health, session, CRM)
challenge-definition/   # Challenge brief and test data (100 emails JSON)
openspec/               # Spec-driven development (proposals, specs, tasks)
```

## Challenge

Property managers deal with large volumes of communication from tenants, landlords, contractors, and prospects. The system must:

1. Identify who messages are from
2. Understand context across threads
3. Assess urgency
4. Surface clear recommended actions
