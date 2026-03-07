## MODIFIED Requirements

### Requirement: Docker Compose Stack
The project SHALL provide a `docker-compose.yml` that starts the full stack with a single `docker compose up -d` command.

The stack SHALL include:
- **MariaDB** — database backend for EspoCRM
- **EspoCRM** — the CRM application, exposed on a configurable local port
- **EspoCRM Daemon** — background job processor (cron, scheduled tasks, email fetching)
- **Frontend** — Next.js dashboard, exposed on port 3000

#### Scenario: Stack starts successfully
- **WHEN** `docker compose up -d` is run from the project root
- **THEN** all services (mariadb, espocrm, espocrm-daemon, frontend) start without errors
- **AND** EspoCRM becomes accessible via HTTP within 60 seconds
- **AND** the frontend becomes accessible at http://localhost:3000

#### Scenario: Data persists across restarts
- **WHEN** the stack is stopped with `docker compose down` and restarted with `docker compose up -d`
- **THEN** all CRM data (contacts, emails, cases) is preserved via named volumes

#### Scenario: Frontend connects to backend services
- **WHEN** the frontend container starts
- **THEN** it can reach EspoCRM at `http://espocrm` on the Docker network for server-side API calls
- **AND** it can reach the agent API at `http://agent:8001` on the Docker network
