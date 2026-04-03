# Project Context

## Purpose
Hackathon project (2026-03-07) for Lette AI's PropTech challenge. Build an agentic AI system that helps property managers process high-volume tenant/landlord/contractor communications by triaging emails, assessing urgency, linking related threads, and surfacing recommended actions — all through a real CRM rather than isolated AI analysis.

## Tech Stack
- Docker Compose (orchestration for the full stack)
- **pnpm monorepo** — unified package management for all TypeScript services
- **clawling** — TypeScript agent orchestration framework (Hono + Zod), OpenAI-compatible gateway on port 8001
- **`@repo/crm-api`** — Hono REST API with Drizzle ORM + PostgreSQL full-text search (port 8002)
- **`@repo/crm-schema`** — Drizzle ORM schema with inferred types, shared across packages
- **`@repo/crm-cli`** — TypeScript Commander CLI for agent ↔ CRM interaction (no MCP overhead)
- Claude Agent SDK + Anthropic Bedrock Messages API (two-tier AI backends)
- TypeScript — all services, scripts, and tests (vitest + Playwright for testing)
- Next.js 16 frontend (port 3000)

## Project Conventions

### Code Style
- Hackathon-pragmatic: working > polished
- Prefer simple scripts over frameworks
- Keep dependencies minimal

### Scripts
- All scripts in `scripts/` are TypeScript, run via pnpm aliases or `npx tsx`
- Key scripts: `scripts/agent.ts` (run agent prompts), `scripts/seed.ts`, `scripts/reset.ts`, `scripts/reseed.ts`
- Run via: `pnpm seed`, `pnpm reset`, `pnpm reseed`, `npx tsx scripts/agent.ts "prompt"`

### Architecture Patterns
- **Two-tier AI via clawling**: Frontend agent (Bedrock Messages API, fast) + Worker agent (Claude Agent SDK, autonomous). Routing via `model` field in OpenAI-compatible requests.
- **Agentic loop**: Worker processes email threads one at a time from the CRM, using the `crm` CLI via Bash, as part of shift work sessions
- **Agent delegation**: Frontend agent delegates to Worker via `delegate_to_worker` tool. Framework spawns background task, delivers result via announcer.
- **Session-based processing**: threads processed in shifts; drafts prepared during session, "sent" (status change) at end of session
- **CRM as system of record**: all state lives in PostgreSQL via CRM API — contacts, cases, email drafts, notes, threads, cross-references
- **Docker Compose stack**: PostgreSQL + CRM API + clawling + Frontend

### Testing Strategy
- Manual testing and demo-driven validation (hackathon context)
- Integration tests: CRM API (19 tests), clawling gateway API (11 tests)
- E2E tests: Playwright browser tests for frontend + AI chat (29 tests)
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
Next.js frontend in `frontend/` (port 3000). Proxies CRM API calls via `/api/crm` route. AI assistant chat widget connected to clawling gateway via OpenAI-compatible SSE streaming (`/v1/chat/completions`). Session continuity via `x-clawling-session-id` header.

## Important Constraints
- Hackathon time constraint: must be demoable quickly
- 100 test emails provided as JSON (challenge-definition/proptech-test-data.json)
- Agent must process emails sequentially, building context as it goes
- Draft responses held until end of session, updated as new context arrives

## External Dependencies
- PostgreSQL Docker image
- Anthropic Claude API (via AWS Bedrock)
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- Bedrock SDK (`@anthropic-ai/bedrock-sdk`)
