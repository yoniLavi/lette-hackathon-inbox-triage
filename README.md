# PropTech Email Triage Agent

Hackathon project for Lette AI's PropTech challenge (2026-03-07). An agentic AI system that helps property managers process high-volume tenant, landlord, and contractor communications.

## What It Does

- Triages incoming emails by urgency and sender type
- Links related threads and builds context across messages
- Surfaces recommended actions for the property manager
- Drafts responses within a real CRM (not isolated AI analysis)

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────────┐
│ Claude Agent │────▶│ EspoMCP  │────▶│   EspoCRM    │
│ (Agent SDK)  │◀────│ (bridge) │◀────│ (system of   │
└─────────────┘     └──────────┘     │   record)    │
                                      └──────────────┘
```

The agent processes emails sequentially in work sessions, using EspoCRM as its read/write tool via MCP. All state — contacts, cases, email drafts, notes, cross-references — lives in the CRM.

## Tech Stack

- **Docker Compose** — orchestrates the full stack
- **EspoCRM** — open-source CRM with email integration and REST API
- **EspoMCP** — MCP server bridging Claude to EspoCRM
- **Claude Code + Anthropic Agent SDK** — agentic AI layer
- **Python** — seed scripts and utilities

## Getting Started

Prerequisites: Docker, [uv](https://docs.astral.sh/uv/)

```bash
# Start the stack
docker compose up -d

# Seed test data (100 emails from challenge dataset)
uv run scripts/seed.py

# Reset CRM to blank state
uv run scripts/reset.py

# Reset + re-seed in one step
uv run scripts/reseed.py

# Run the agent
# TBD
```

## Domain Context

Built for **BTR/PRS property management** in Ireland (Build-to-Rent / Private Rented Sector). The test dataset covers 5 properties with communications spanning maintenance emergencies, RTB disputes, lease renewals, rent arrears, fire/safety compliance, and more.

## Project Structure

```
challenge-definition/   # Challenge brief and test data (100 emails JSON)
openspec/               # Spec-driven development (proposals, specs, tasks)
```

## Challenge

Property managers deal with large volumes of communication from tenants, landlords, contractors, and prospects. The system must:

1. Identify who messages are from
2. Understand context across threads
3. Assess urgency
4. Surface clear recommended actions
