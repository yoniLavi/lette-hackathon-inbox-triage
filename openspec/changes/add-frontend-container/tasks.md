## 1. Dockerfile
- [x] 1.1 Create `frontend/Dockerfile` — multi-stage build (install deps, build, serve with `next start`)
- [x] 1.2 Add `.dockerignore` in `frontend/` to exclude `node_modules`, `.next`, etc.

## 2. Docker Compose
- [x] 2.1 Add `frontend` service to `docker-compose.yml` — build from `./frontend`, expose port 3000, pass env vars
- [ ] 2.2 Add env vars to `.env.example`: `NEXT_PUBLIC_AGENT_URL`, `ESPOCRM_URL`, `ESPOCRM_API_KEY`

## 3. Next.js Config
- [x] 3.1 Update `frontend/next.config.ts` — set `output: "standalone"` for Docker-optimized builds

## 4. Validation
- [x] 4.1 Test: `docker compose up frontend` builds and serves the app on port 3000
- [x] 4.2 Test: frontend can reach EspoCRM API internally (for server-side data fetching)
