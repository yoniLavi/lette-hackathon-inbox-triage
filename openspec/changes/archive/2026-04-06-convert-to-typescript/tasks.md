## 1. Monorepo Setup

- [x] 1.1 Initialize pnpm workspace: root `pnpm-workspace.yaml`, root `package.json` with shared dev deps (typescript, vitest, tsx)
- [x] 1.2 Create `packages/crm-schema/` package with `package.json` ("@repo/crm-schema"), `tsconfig.json`, Drizzle deps
- [x] 1.3 Create `packages/crm-api/` package with `package.json`, `tsconfig.json`, Hono + Drizzle deps
- [x] 1.4 Create `packages/crm-cli/` package with `package.json`, `tsconfig.json`, Commander dep
- [x] 1.5 Configure path references so frontend and packages can import `@repo/crm-schema`

## 2. CRM Schema (shared types)

- [x] 2.1 Write `packages/crm-schema/src/schema.ts` — Drizzle `pgTable` definitions for all 8 entities (Shift, Property, Contact, Case, Email, Task, Note, Thread) matching current PostgreSQL schema exactly
- [x] 2.2 Write `packages/crm-schema/src/types.ts` — export inferred `Select` and `Insert` types for each entity, plus entity registry map and filter/include definitions
- [x] 2.3 Write `packages/crm-schema/src/index.ts` — re-export schema and types
- [x] 2.4 Verify schema matches current database by running Drizzle Kit generate and inspecting migration SQL

## 3. CRM API (Hono + Drizzle)

- [x] 3.1 Write `packages/crm-api/src/db.ts` — Drizzle client with `node-postgres` pool, connection from `DATABASE_URL` env var
- [x] 3.2 Write `packages/crm-api/src/serialize.ts` — generic row serialization (Date → ISO string), equivalent to current `serialize()` + `_coerce_value()`
- [x] 3.3 Write `packages/crm-api/src/routes.ts` — generic CRUD routes: `GET /api/{entity}` (list with filters, ordering, pagination, date ranges, full-text search), `GET /api/{entity}/{id}`, `POST /api/{entity}`, `PATCH /api/{entity}/{id}`, `DELETE /api/{entity}/{id}`, `DELETE /api/{entity}`
- [x] 3.4 Write `packages/crm-api/src/includes.ts` — `?include=` resolver matching current behavior (cases→emails/tasks/notes/property, threads→emails/contact, emails→contact, shifts→case/notes)
- [x] 3.5 Write `packages/crm-api/src/threads.ts` — thread upsert logic (auto-create/update/delete on email changes, is_read computation excluding drafts, contact/property resolution)
- [x] 3.6 Write shift endpoints: `GET /api/shift/next`, `POST /api/shift/complete`, `GET /api/shift/incomplete` — matching current behavior exactly
- [x] 3.7 Write `GET /api/counts` and `GET /health` endpoints
- [x] 3.8 Write bulk email endpoint: `PATCH /api/emails/bulk`
- [x] 3.9 Write `packages/crm-api/src/index.ts` — Hono app assembly, CORS, Drizzle migrations on startup
- [x] 3.10 Write `packages/crm-api/Dockerfile` — pnpm workspace-aware multi-stage build
- [x] 3.11 Verify all 19 existing CRM API tests pass against new TS implementation (19/19 passing)

## 4. CRM CLI (TypeScript)

- [x] 4.1 Write `packages/crm-cli/src/index.ts` — Commander CLI matching current Click interface: `crm <entity> list|get|create|update|delete`, `crm shift next|complete|incomplete`, `crm emails bulk-update`
- [x] 4.2 Write `packages/crm-cli/src/client.ts` — HTTP client for CRM API (shared fetch wrapper)
- [x] 4.3 Typecheck passes

## 5. Docker Integration

- [x] 5.1 Update `docker-compose.yml` — replace Python CRM API service with TS CRM API, update build context and volumes
- [x] 5.2 Update clawling Dockerfile — remove Python/uv dependencies, install TS CRM CLI via npx tsx wrapper
- [x] 5.3 Update clawling entrypoint.sh — replace uv tool install with npx tsx wrapper for crm CLI

## 6. Scripts (TypeScript)

- [x] 6.1 Write `scripts/seed.ts` — port seed logic, TypeScript types for challenge data
- [x] 6.2 Write `scripts/reset.ts` — port reset logic
- [x] 6.3 Write `scripts/reseed.ts` — port reseed (reset + seed)
- [x] 6.4 Write `scripts/agent.ts` — port agent client for clawling API
- [x] 6.5 Update `scripts/test.sh` to run vitest instead of pytest

## 7. Frontend Type Integration

- [x] 7.1 Update `frontend/src/lib/crm.ts` — add `@repo/crm-schema` dependency, re-export Api* types from schema for reference; keep Crm* interface types for backward compatibility with frontend components
- [x] 7.2 Verify frontend typechecks with no errors

## 8. Tests (vitest + Playwright)

- [x] 8.1 Write `tests/crm-api.test.ts` — port all 19 CRM API integration tests to vitest (19/19 passing)
- [x] 8.2 Write `tests/agent-api.test.ts` — port all 11 agent API integration tests to vitest
- [x] 8.3 Write `tests/frontend-e2e.test.ts` — port Playwright E2E tests to vitest + Playwright (vitest as runner)
- [x] 8.4 CRM API tests verified: 19/19 passing

## 9. Cleanup

- [x] 9.1 Remove Python CRM API code: `crm/main.py`, `crm/models.py`, `crm/database.py`, `crm/Dockerfile`, `crm/pyproject.toml`
- [x] 9.2 Remove Python CRM CLI: `crm-cli/crm_cli/`, `crm-cli/pyproject.toml`
- [x] 9.3 Remove Python scripts: `scripts/seed.py`, `scripts/reset.py`, `scripts/reseed.py`, `scripts/agent.py`
- [x] 9.4 Remove Python tests: `tests/test_crm_api.py`, `tests/test_agent_api.py`, `tests/test_frontend_e2e.py`
- [x] 9.5 Update openspec specs, CLAUDE.md, and memory to reflect all-TypeScript stack
