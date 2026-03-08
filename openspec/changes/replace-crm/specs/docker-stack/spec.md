## REMOVED Requirements

### Requirement: EspoCRM Stack
**Reason**: Replaced by lightweight CRM API + PostgreSQL. EspoCRM + EspoMCP too slow for AI agent use (109 tool calls / 7 min per email).
**Migration**: Re-seed challenge data into new CRM via seed scripts.

## ADDED Requirements

### Requirement: CRM API Service
The Docker Compose stack SHALL include a CRM API service (FastAPI) backed by PostgreSQL, replacing EspoCRM.

#### Scenario: CRM API starts with database
- **WHEN** `docker compose up -d` is run
- **THEN** PostgreSQL and the CRM API container start
- **AND** the CRM API is accessible at port 8002
- **AND** database migrations run automatically on startup

### Requirement: PostgreSQL Database
The Docker Compose stack SHALL use PostgreSQL as the database for the CRM API.

#### Scenario: Data persistence
- **WHEN** the stack is restarted
- **THEN** CRM data persists via a named Docker volume
