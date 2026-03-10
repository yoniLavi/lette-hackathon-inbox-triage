# Project Context

## Purpose
Hackathon project (2026-03-07) for Lette AI's PropTech challenge. Build an agentic AI system that helps property managers process high-volume tenant/landlord/contractor communications by triaging emails, assessing urgency, linking related threads, and surfacing recommended actions — all through a real CRM rather than isolated AI analysis.

## Tech Stack
- Docker Compose (orchestration for the full stack)
- CRM API — custom FastAPI + PostgreSQL with full-text search (port 8002)
- CRM CLI — `crm` command-line tool for agent ↔ CRM interaction (no MCP overhead)
- Claude Code + Anthropic Agent SDK (agentic AI layer)
- Python (seed scripts, utilities)
- Next.js frontend (port 3000)

## Project Conventions

### Code Style
- Hackathon-pragmatic: working > polished
- Prefer simple scripts over frameworks
- Keep dependencies minimal

### Scripts
- All Python scripts in `scripts/` use a `uv` shebang (`#!/usr/bin/env -S uv run --script`) so they can be run directly: `scripts/agent.py "prompt"` (no `uv run` prefix needed)
- Key scripts: `scripts/agent.py` (run agent prompts), `scripts/seed.py`, `scripts/reset.py`, `scripts/reseed.py`

### Architecture Patterns
- **Agentic loop**: Claude processes email threads one at a time from the CRM, using the `crm` CLI via Bash, as part of shift work sessions
- **Session-based processing**: threads processed in shifts; drafts prepared during session, "sent" (status change) at end of session
- **CRM as system of record**: all state lives in PostgreSQL via CRM API — contacts, cases, email drafts, notes, threads, cross-references
- **Docker Compose stack**: PostgreSQL + CRM API + Agent + Frontend

### Testing Strategy
- Manual testing and demo-driven validation (hackathon context)
- Seed script with 100 test emails from challenge dataset

### Git Workflow
- Simple: main branch, commit as we go

## Domain Context
- **BTR/PRS property management** in Ireland (Build-to-Rent / Private Rented Sector)
- (in the demo data) 5 properties, 6 sender types (tenant, landlord, contractor, prospect, internal, legal)
- 4 urgency levels (critical, high, medium, low)
- Key concerns: maintenance emergencies, RTB disputes, lease renewals, rent arrears, fire/safety compliance, corporate lets, noise complaints
- Irish regulatory context: RTB (Residential Tenancies Board), RPZ (Rent Pressure Zones), gas safety certs, fire safety regulations
- Property managers referenced by first name in emails (but names don't always match — e.g., "Sarah Brennan" signs as "Tara")

## Frontend Integration
Next.js frontend in `frontend/` (port 3000). Proxies CRM API calls via `/api/crm` route. Includes AI assistant chat widget connected to the agent API via SSE streaming.

## Important Constraints
- Hackathon time constraint: must be demoable quickly
- 100 test emails provided as JSON (challenge-definition/proptech-test-data.json)
- Agent must process emails sequentially, building context as it goes
- Draft responses held until end of session, updated as new context arrives
- Claude account (we could use Claude Max for the development, and will switch to API key later)

## External Dependencies
- PostgreSQL Docker image
- Anthropic Claude API (via AWS Bedrock)
