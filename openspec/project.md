# Project Context

## Purpose
Hackathon project (2026-03-07) for Lette AI's PropTech challenge. Build an agentic AI system that helps property managers process high-volume tenant/landlord/contractor communications by triaging emails, assessing urgency, linking related threads, and surfacing recommended actions — all through a real CRM rather than isolated AI analysis.

## Tech Stack
- Docker Compose (orchestration for the full stack)
- EspoCRM (open-source CRM with email integration, REST API)
- EspoMCP (MCP server bridging Claude to EspoCRM)
- Claude Code + Anthropic Agent SDK (agentic AI layer)
- Python (seed scripts, utilities)
- TBD: A webUI frontend

## Project Conventions

### Code Style
- Hackathon-pragmatic: working > polished
- Prefer simple scripts over frameworks
- Keep dependencies minimal

### Architecture Patterns
- **Agentic loop**: Claude processes emails one at a time from the CRM inbox, using EspoCRM as its read/write tool via MCP, as part of a work session
- **Session-based processing**: emails processed in work sessions (e.g. 100 emails per session), drafts prepared during session, "sent" (status change) at end of session
- **CRM as system of record**: all state lives in EspoCRM — contacts, cases, email drafts, notes, cross-references
- **Docker Compose stack**: EspoCRM (app + db + daemon) + seed container + agent container

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
A colleague is building a Next.js frontend in `frontend/`. Integration between the frontend and the agent/CRM backend is not yet in scope — current focus is on the email triage automation. Frontend integration will come later.

## Important Constraints
- Hackathon time constraint: must be demoable quickly
- 100 test emails provided as JSON (challenge-definition/proptech-test-data.json)
- Agent must process emails sequentially, building context as it goes
- Draft responses held until end of session, updated as new context arrives
- Claude account (we could use Claude Max for the development, and will switch to API key later)

## External Dependencies
- EspoCRM Docker image (espocrm/espocrm)
- MariaDB Docker image
- EspoMCP npm package (github.com/zaphod-black/espomcp)
- Anthropic Claude API (API key / Claude Max)
