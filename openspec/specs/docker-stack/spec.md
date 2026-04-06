# docker-stack Specification

## Purpose
Docker Compose orchestration for the full stack: PostgreSQL, CRM API, clawling agent framework, and Next.js frontend.
## Requirements
### Requirement: Docker Compose Stack
The project SHALL provide a `docker-compose.yml` that starts the full stack with a single `docker compose up -d` command.

The stack SHALL include:
- **PostgreSQL** — database backend
- **CRM API** — Hono + Drizzle TypeScript REST service, exposed on port 8002
- **clawling** — TypeScript agent orchestration framework, exposed on port 8001
- **Frontend** — Next.js dashboard, exposed on port 3000

All application containers SHALL use Node.js base images. No Python runtime SHALL be required.

#### Scenario: Stack starts successfully
- **WHEN** `docker compose up -d` is run from the project root
- **THEN** all services (postgres, crm-api, clawling, frontend) start without errors
- **AND** the CRM API becomes accessible at http://localhost:8002 within 30 seconds
- **AND** clawling becomes accessible at http://localhost:8001
- **AND** the frontend becomes accessible at http://localhost:3000

#### Scenario: Data persists across restarts
- **WHEN** the stack is stopped with `docker compose down` and restarted with `docker compose up -d`
- **THEN** all CRM data is preserved via named PostgreSQL volumes

#### Scenario: Single language runtime
- **WHEN** all application containers are running
- **THEN** only Node.js and PostgreSQL processes exist
- **AND** no Python interpreter is installed or required in any container

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

