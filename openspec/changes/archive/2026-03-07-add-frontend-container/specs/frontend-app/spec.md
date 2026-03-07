## ADDED Requirements

### Requirement: Frontend Container
The frontend SHALL be containerized as a Next.js standalone build, served via `next start` inside Docker.

#### Scenario: Production build in Docker
- **WHEN** the `frontend` service is built via `docker compose build frontend`
- **THEN** the Next.js app is built with `output: "standalone"`
- **AND** the resulting image serves the app on port 3000

#### Scenario: Environment configuration
- **WHEN** the frontend container starts
- **THEN** it reads `NEXT_PUBLIC_AGENT_URL` for client-side agent API calls
- **AND** it reads `ESPOCRM_URL` and `ESPOCRM_API_KEY` for server-side CRM data fetching
