# docker-stack Specification

## Purpose
Docker Compose orchestration for the full stack: PostgreSQL, CRM API, clawling agent framework, and Next.js frontend.

## Requirements

### Requirement: Docker Compose Stack
The project SHALL provide a `docker-compose.yml` that starts the full stack with a single `docker compose up -d` command.

The stack SHALL include:
- **postgres** — PostgreSQL 16 database backend
- **crm-api** — Hono REST API built from the pnpm monorepo (`packages/crm-api`)
- **clawling** — TypeScript agent orchestration framework on port 8001
- **frontend** — Next.js 16 dashboard on port 3000

#### Scenario: Stack starts successfully
- **WHEN** `docker compose up -d` is run from the project root
- **THEN** all services start without errors
- **AND** the CRM API health endpoint (`GET /health`) returns `{"status":"ok"}` within 30 seconds
- **AND** the frontend becomes accessible at http://localhost:3000

#### Scenario: Data persists across restarts
- **WHEN** the stack is stopped with `docker compose down` and restarted
- **THEN** all CRM data is preserved via the `postgres-data` named volume

#### Scenario: Services communicate via Docker network
- **WHEN** clawling needs to call the CRM API
- **THEN** it resolves `http://crm-api:8002` on the Docker internal network
- **AND** the frontend server-side proxy calls `http://crm-api:8002` for CRM data

### Requirement: Development Bind Mounts
Dev compose SHALL use bind mounts for hot-reloading without container rebuilds.

#### Scenario: clawling source hot-reload
- **WHEN** TypeScript files under `clawling/src/` are edited
- **THEN** the running container picks up changes via `tsx` without a rebuild

#### Scenario: agent-workspace bind mount
- **WHEN** agent skills in `agent-workspace/.claude/commands/` are edited
- **THEN** the worker agent sees the updated skills immediately (no rebuild required)

### Requirement: CRM API Migrations on Startup
The CRM API SHALL run Drizzle migrations automatically on startup before accepting requests.

#### Scenario: Fresh database
- **WHEN** the CRM API starts against an empty PostgreSQL database
- **THEN** all 8 entity tables are created via Drizzle migrations
- **AND** the API is ready to accept requests
