# docker-stack Specification

## Purpose
TBD - created by archiving change setup-docker-stack. Update Purpose after archive.
## Requirements
### Requirement: Docker Compose Stack
The project SHALL provide a `docker-compose.yml` that starts the full EspoCRM stack with a single `docker compose up -d` command.

The stack SHALL include:
- **MariaDB** — database backend for EspoCRM
- **EspoCRM** — the CRM application, exposed on a configurable local port
- **EspoCRM Daemon** — background job processor (cron, scheduled tasks, email fetching)

#### Scenario: Stack starts successfully
- **WHEN** `docker compose up -d` is run from the project root
- **THEN** all three services (mariadb, espocrm, espocrm-daemon) start without errors
- **AND** EspoCRM becomes accessible via HTTP within 60 seconds

#### Scenario: Data persists across restarts
- **WHEN** the stack is stopped with `docker compose down` and restarted with `docker compose up -d`
- **THEN** all CRM data (contacts, emails, cases) is preserved via named volumes

### Requirement: EspoCRM API Access
EspoCRM SHALL be accessible via its REST API from the host machine for use by seed scripts and the MCP bridge.

#### Scenario: API responds to authenticated request
- **WHEN** a GET request is made to `/api/v1/App/user` with valid admin credentials
- **THEN** a 200 response with the admin user details is returned

### Requirement: Default Credentials Configuration
The stack SHALL use environment variables (via `.env` file) for database and admin credentials, with sensible defaults for local development.

#### Scenario: Stack uses .env defaults
- **WHEN** the `.env` file contains default credentials
- **AND** `docker compose up -d` is run
- **THEN** EspoCRM is configured with those credentials and admin login works

