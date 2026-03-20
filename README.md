# PropTech Email Triage Agent

Hackathon project for Lette AI's PropTech challenge (2026-03-07). An agentic AI system that helps property managers process high-volume tenant, landlord, and contractor communications.

## Demo

<div>
  <a href="https://www.loom.com/share/9943acded24142d4a77b64440f464457">
    <p>Give(a)Lette - Part 1: Running a shift - Watch Video</p>
  </a>
  <a href="https://www.loom.com/share/9943acded24142d4a77b64440f464457">
    <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/9943acded24142d4a77b64440f464457-7c09c766192a55e9-full-play.gif#t=0.1">
  </a>
</div>

<div>
  <a href="https://www.loom.com/share/a7f1ee550f384a27a8f95c30695b3431">
    <p>Give(a)Lette - Part 2: UI and conversational AI overview - Watch Video</p>
  </a>
  <a href="https://www.loom.com/share/a7f1ee550f384a27a8f95c30695b3431">
    <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/a7f1ee550f384a27a8f95c30695b3431-c2d845a5d665b2c5-full-play.gif#t=0.1">
  </a>
</div>

## What It Does

- Triages incoming emails by urgency and sender type
- Links related threads and builds context across messages
- Surfaces recommended actions for the property manager
- Drafts responses within a real CRM (not isolated AI analysis)

## Architecture

```
                        ┌─── agent container ───────────────────┐
┌────────┐   HTTP API   │ ┌─────────────┐                       │
│ Client │─────────────▶│ │ FastAPI      │     crm CLI           │     ┌──────────────┐
│        │◀─────────────│ │ (port 8001)  │────(via Bash)─────────│────▶│   CRM API    │
└────────┘              │ └─────────────┘                       │     │ (port 8002)  │
                        │       │                               │     │ + PostgreSQL │
                        │       ▼                               │     └──────────────┘
                        │  Claude Code SDK                      │
                        │  (persistent session via Bedrock)     │
                        └───────────────────────────────────────┘
```

The agent runs as a persistent HTTP service. Each prompt is processed within a long-lived Claude Code SDK session that accumulates context. The CRM API (FastAPI + PostgreSQL) is the system of record — all state lives there.

## Tech Stack

- **Docker Compose** — orchestrates the full stack
- **CRM API** — FastAPI + PostgreSQL with full-text search
- **CRM CLI** — `crm` command-line tool for agent ↔ CRM interaction (no MCP overhead)
- **Claude Code + Anthropic Agent SDK** — agentic AI layer
- **Python** — seed scripts and utilities

## Getting Started

Prerequisites: Docker, [uv](https://docs.astral.sh/uv/)

```bash
# 1. Start the stack
docker compose up -d

# 2. Wait for CRM API to be ready (~10s)
#    Check with: docker compose logs -f crm-api

# 3. Seed test data (100 emails, contacts, 5 properties)
uv run scripts/seed.py

# 4. Open the frontend at http://localhost:3000
#    CRM API is at http://localhost:8002
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
# Reset CRM to blank state
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
crm/                    # CRM API service (FastAPI + PostgreSQL)
  main.py               # REST API with generic CRUD + full-text search
  models.py             # SQLAlchemy models (8 entities)
  database.py           # Async engine and session
  Dockerfile            # Python + uv
crm-cli/                # CRM CLI tool (installed in agent container)
  crm_cli/main.py       # Click-based CLI: crm <entity> <action>
agent/                  # Agent container (FastAPI + Claude Code SDK)
  api.py                # HTTP API server with session management
  frontend_ai.py        # Frontend AI (fast Haiku-powered chat)
  mcp_worker.py         # Async worker dispatch for CRM queries
  pyproject.toml        # Python deps (managed by uv)
  Dockerfile            # Node.js + Python + Claude Code
  entrypoint.sh         # Installs crm-cli, starts uvicorn
  workspace/            # Agent skills and CLAUDE.md for shift sessions
frontend/               # Next.js 16 frontend (port 3000)
  src/app/              # Pages: dashboard, situations, shifts, properties, search
  src/lib/crm.ts        # CRM data types and fetch functions
  src/components/        # Dashboard cards, AI chat widget, UI primitives
scripts/                # Python scripts (run with uv)
  agent.py              # CLI wrapper for the agent API
  seed.py               # Seed CRM with challenge dataset
  reset.py              # Delete all seeded data
  reseed.py             # Reset + seed in one step
  test.sh               # Run integration tests via pytest
tests/                  # Integration + E2E tests
  test_agent_api.py     # Agent API tests (health, session, CRM)
  test_crm_api.py       # CRM API CRUD + search tests
  test_frontend_e2e.py  # Playwright E2E tests (dashboard, chat, delegation)
challenge-definition/   # Challenge brief and test data (100 emails JSON)
openspec/               # Spec-driven development (proposals, specs, tasks)
```

## Challenge

Property managers deal with large volumes of communication from tenants, landlords, contractors, and prospects. The system must:

1. Identify who messages are from
2. Understand context across threads
3. Assess urgency
4. Surface clear recommended actions
