## 1. Monorepo Setup

- [ ] 1.1 Initialize pnpm workspace: root `pnpm-workspace.yaml`, root `package.json` with shared dev deps (typescript, vitest, tsx)
- [ ] 1.2 Create `packages/crm-schema/` package with `package.json` ("@repo/crm-schema"), `tsconfig.json`, Drizzle deps
- [ ] 1.3 Create `packages/crm-api/` package with `package.json`, `tsconfig.json`, Hono + Drizzle deps
- [ ] 1.4 Create `packages/crm-cli/` package with `package.json`, `tsconfig.json`, Commander dep
- [ ] 1.5 Configure path references so frontend and packages can import `@repo/crm-schema`

## 2. CRM Schema (shared types)

- [ ] 2.1 Write `packages/crm-schema/src/schema.ts` — Drizzle `pgTable` definitions for all 8 entities (Shift, Property, Contact, Case, Email, Task, Note, Thread) matching current PostgreSQL schema exactly
- [ ] 2.2 Write `packages/crm-schema/src/types.ts` — export inferred `Select` and `Insert` types for each entity, plus entity registry map and filter/include definitions
- [ ] 2.3 Write `packages/crm-schema/src/index.ts` — re-export schema and types
- [ ] 2.4 Verify schema matches current database by running Drizzle Kit introspect against running PostgreSQL

## 3. CRM API (Hono + Drizzle)

- [ ] 3.1 Write `packages/crm-api/src/db.ts` — Drizzle client with `node-postgres` pool, connection from `DATABASE_URL` env var
- [ ] 3.2 Write `packages/crm-api/src/serialize.ts` — generic row serialization (Date → ISO string), equivalent to current `serialize()` + `_coerce_value()`
- [ ] 3.3 Write `packages/crm-api/src/routes.ts` — generic CRUD routes: `GET /api/{entity}` (list with filters, ordering, pagination, date ranges, full-text search), `GET /api/{entity}/{id}`, `POST /api/{entity}`, `PATCH /api/{entity}/{id}`, `DELETE /api/{entity}/{id}`, `DELETE /api/{entity}`
- [ ] 3.4 Write `packages/crm-api/src/includes.ts` — `?include=` resolver matching current behavior (cases→emails/tasks/notes/property, threads→emails/contact, emails→contact, shifts→case/notes)
- [ ] 3.5 Write `packages/crm-api/src/threads.ts` — thread upsert logic (auto-create/update/delete on email changes, is_read computation excluding drafts, contact/property resolution)
- [ ] 3.6 Write shift endpoints: `GET /api/shift/next`, `POST /api/shift/complete`, `GET /api/shift/incomplete` — matching current behavior exactly
- [ ] 3.7 Write `GET /api/counts` and `GET /health` endpoints
- [ ] 3.8 Write bulk email endpoint: `PATCH /api/emails/bulk`
- [ ] 3.9 Write `packages/crm-api/src/index.ts` — Hono app assembly, CORS, lifespan (create tables on startup)
- [ ] 3.10 Write `packages/crm-api/Dockerfile` — node:20-slim, install deps, entrypoint
- [ ] 3.11 Verify all 19 existing CRM API tests pass against new TS implementation (run Python tests against TS server)

## 4. CRM CLI (TypeScript)

- [ ] 4.1 Write `packages/crm-cli/src/index.ts` — Commander CLI matching current Click interface: `crm <entity> list|get|create|update|delete`, `crm shift next|complete|incomplete`, `crm emails bulk-update`
- [ ] 4.2 Write `packages/crm-cli/src/client.ts` — HTTP client for CRM API (shared fetch wrapper)
- [ ] 4.3 Verify CLI works in clawling container by testing against running CRM API

## 5. Docker Integration

- [ ] 5.1 Update `docker-compose.yml` — replace Python CRM API service with TS CRM API, update build context and volumes
- [ ] 5.2 Update clawling Dockerfile/entrypoint — install TS CRM CLI (via pnpm or npm) instead of Python crm-cli via uv
- [ ] 5.3 Verify full stack starts with `docker compose up -d` and all services healthy

## 6. Scripts (TypeScript)

- [ ] 6.1 Write `scripts/seed.ts` — port seed logic, import types from `@repo/crm-schema`
- [ ] 6.2 Write `scripts/reset.ts` — port reset logic
- [ ] 6.3 Write `scripts/reseed.ts` — port reseed (reset + seed)
- [ ] 6.4 Write `scripts/agent.ts` — port agent client for clawling API
- [ ] 6.5 Update `scripts/test.sh` to run vitest instead of pytest

## 7. Frontend Type Integration

- [ ] 7.1 Update `frontend/src/lib/crm.ts` — remove manual type definitions, import from `@repo/crm-schema`; keep fetch functions and UI helpers
- [ ] 7.2 Verify frontend builds and all pages render correctly with imported types

## 8. Tests (vitest + Playwright)

- [ ] 8.1 Write `tests/crm-api.test.ts` — port all 19 CRM API integration tests to vitest
- [ ] 8.2 Write `tests/agent-api.test.ts` — port all 11 agent API integration tests to vitest
- [ ] 8.3 Write `tests/frontend-e2e.test.ts` — port Playwright E2E tests to vitest + Playwright (vitest as runner)
- [ ] 8.4 Verify all tests pass: CRM 19/19, Agent 11/11, E2E 26+/29

## 9. Cleanup

- [ ] 9.1 Remove Python CRM API code: `crm/main.py`, `crm/models.py`, `crm/database.py`, `crm/Dockerfile`, `crm/pyproject.toml`
- [ ] 9.2 Remove Python CRM CLI: `crm-cli/crm_cli/`, `crm-cli/pyproject.toml`
- [ ] 9.3 Remove Python scripts: `scripts/seed.py`, `scripts/reset.py`, `scripts/reseed.py`, `scripts/agent.py`
- [ ] 9.4 Remove Python tests: `tests/test_crm_api.py`, `tests/test_agent_api.py`, `tests/test_frontend_e2e.py`
- [ ] 9.5 Update README.md, openspec/project.md, and CLAUDE.md to reflect all-TypeScript stack
- [ ] 9.6 Update memory files to reflect new architecture
