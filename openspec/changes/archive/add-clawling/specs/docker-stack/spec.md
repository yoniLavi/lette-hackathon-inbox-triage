## MODIFIED Requirements

### Requirement: Docker Compose Stack
The project SHALL provide a `docker-compose.yml` that starts the full stack with a single `docker compose up -d` command.

The stack SHALL include:
- **PostgreSQL** — database backend for the CRM API
- **CRM API** — FastAPI REST service, exposed on port 8002
- **Clawling** — agent orchestration framework (Node.js), exposed on port 8001
- **Frontend** — Next.js dashboard, exposed on port 3000

#### Scenario: Stack starts successfully
- **WHEN** `docker compose up -d` is run from the project root
- **THEN** all services (postgres, crm-api, clawling, frontend) start without errors
- **AND** the CRM API becomes accessible at http://localhost:8002 within 30 seconds
- **AND** clawling becomes accessible at http://localhost:8001 within 10 seconds
- **AND** the frontend becomes accessible at http://localhost:3000

#### Scenario: Data persists across restarts
- **WHEN** the stack is stopped with `docker compose down` and restarted with `docker compose up -d`
- **THEN** all CRM data is preserved via named volumes
- **AND** clawling session state persists via a mounted data directory

#### Scenario: Frontend connects to backend services
- **WHEN** the frontend container starts
- **THEN** it can reach the CRM API at `http://crm-api:8002` on the Docker network for server-side API calls
- **AND** it can reach clawling at `http://clawling:8001` on the Docker network

#### Scenario: Clawling mounts workspace and skills
- **WHEN** the clawling container starts
- **THEN** `config.json`, `skills/`, and `workspace/` are bind-mounted from the host
- **AND** the `crm` CLI binary is available in the container's PATH
- **AND** changes to skill files are reflected without container rebuild
