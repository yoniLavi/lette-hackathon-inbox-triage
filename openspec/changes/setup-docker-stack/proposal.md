# Change: Setup Docker Compose stack

## Why
Everything depends on having EspoCRM running locally — the agent, the seed scripts, and the demo. This is the foundation for the entire hackathon project.

## What Changes
- Add `docker-compose.yml` with EspoCRM, MariaDB, and EspoCRM daemon services
- Configure persistent volumes for database and EspoCRM data
- Expose EspoCRM on a local port for API and UI access
- Include environment variables for CRM admin setup

## Impact
- Affected specs: new `docker-stack` capability
- Affected code: new `docker-compose.yml` at project root
