# Change: Containerize the Next.js frontend into Docker Compose

## Why
The frontend currently runs standalone via `npm run dev`. To match the rest of the stack (EspoCRM, agent) and enable one-command startup, we need to containerize it and add it to `docker-compose.yml`.

## What Changes
- New `frontend/Dockerfile` for building and serving the Next.js app
- New `frontend` service in `docker-compose.yml` (port 3000)
- Environment variables for backend URLs (`NEXT_PUBLIC_AGENT_URL`, `ESPOCRM_URL`, `ESPOCRM_API_KEY`)
- New `frontend-app` capability spec (the frontend has no spec yet)

## Impact
- Affected specs: `docker-stack` (new service), `frontend-app` (new capability)
- Affected code: `docker-compose.yml`, `frontend/Dockerfile`, `frontend/next.config.ts`
