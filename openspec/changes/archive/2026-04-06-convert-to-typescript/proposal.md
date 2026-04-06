# Change: Convert remaining Python services to TypeScript

## Why
The project uses two languages (Python for CRM API, CLI, scripts, tests; TypeScript for clawling + frontend). CRM entity types are manually duplicated across Python models and TypeScript interfaces, creating maintenance drift risk. Consolidating on TypeScript eliminates this duplication, unifies the toolchain (one package manager, one type checker, one test runner), and enables shared type imports from a single Drizzle schema.

## What Changes
- Rewrite CRM API from FastAPI + SQLAlchemy to Hono + Drizzle ORM (new `crm/` package)
- Define Drizzle schema as single source of truth; frontend imports inferred types directly
- Rewrite CRM CLI from Python Click to TypeScript (thin wrapper over shared HTTP client)
- Rewrite seed/reset/reseed scripts from Python to TypeScript
- Rewrite agent.py client script to TypeScript
- Rewrite all tests to vitest (CRM integration + agent API) and keep Playwright for E2E
- Remove Python from Docker stack entirely (no more uv, pip, or python base images)
- **clawling remains independent** — no shared code imported into clawling; shared types live in a separate package that both frontend and CRM API consume
- **BREAKING**: CRM API container changes from python:3.12-slim to node base image
- **BREAKING**: All `scripts/*.py` replaced with `scripts/*.ts` (run via `npx tsx`)
- **BREAKING**: Tests move from pytest to vitest

## Impact
- Affected specs: crm-api, docker-stack, seed-scripts
- Affected code: `crm/`, `crm-cli/`, `scripts/`, `tests/`, `frontend/src/lib/crm.ts`, `docker-compose.yml`
- Not affected: `clawling/` (remains independent, no code changes), `agent/workspace/` (skills unchanged), `frontend/` pages/components (only `crm.ts` types layer changes)
