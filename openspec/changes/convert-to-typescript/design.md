## Context
The project currently splits between Python (CRM API, CLI, scripts, tests) and TypeScript (clawling, frontend). After the clawling migration, Python only serves the data layer. This design covers converting that data layer to TypeScript while keeping clawling independent and publishable.

## Goals / Non-Goals
- **Goals**: Single language, shared types, fewer containers possible, unified toolchain
- **Non-Goals**: Changing the CRM API's REST interface (must remain backward-compatible), modifying clawling internals, changing the PostgreSQL schema

## Package Structure

```
packages/
  crm-schema/           # Drizzle schema + inferred types (shared)
    src/schema.ts       # Single source of truth for all 8 entities
    src/types.ts        # Re-exports inferred Select/Insert types
    package.json        # "@repo/crm-schema"
  crm-api/              # Hono REST API (replaces crm/)
    src/index.ts        # Server entry point
    src/routes.ts       # Generic CRUD + shift endpoints
    src/includes.ts     # ?include= resolver
    src/threads.ts      # Thread upsert logic
    src/db.ts           # Drizzle client + connection
    package.json        # depends on @repo/crm-schema
  crm-cli/              # CLI tool (replaces crm-cli/)
    src/index.ts        # Commander/yargs CLI
    package.json        # depends on @repo/crm-schema for types
clawling/               # UNCHANGED — independent framework
frontend/               # Next.js — imports @repo/crm-schema for types
scripts/                # TypeScript scripts (npx tsx scripts/seed.ts)
tests/                  # vitest + Playwright
```

### Why `crm-schema` as a separate package
- clawling must remain independent (publishable to npm, no project-specific imports)
- Frontend and CRM API both need the types
- The CRM CLI needs the types for its HTTP client
- A shared package avoids duplication without coupling clawling

### Why NOT merge CRM API into clawling
- clawling is a general-purpose agent framework; CRM is domain-specific
- Keeping them separate means clawling can be extracted without carrying CRM baggage
- The CRM CLI needs an HTTP endpoint regardless

## Decisions

### ORM: Drizzle over Prisma
- Drizzle is schema-as-code (TypeScript, not a DSL) — types are inferred, not generated
- Lighter weight, no binary engine, faster cold starts
- Better fit for the generic CRUD pattern (raw SQL escape hatch via `sql` template)
- Prisma would work but adds a code generation step and heavier runtime

### HTTP framework: Hono (same as clawling)
- Already a dependency in the project
- Lightweight, fast, good middleware ecosystem
- Consistent developer experience across CRM API and clawling

### Monorepo tooling: pnpm workspaces
- Simple, no build orchestrator needed (no turborepo)
- `pnpm` is faster than `npm` for workspaces and deduplicates better
- Each package has its own `package.json`; scripts run via `pnpm --filter`

### Test framework: vitest
- Near-zero config, native TypeScript, fast
- Compatible with Playwright for E2E tests
- Replaces pytest for CRM + agent API integration tests

### CRM CLI: Commander over Click
- Commander is the standard Node CLI library (like Click is for Python)
- The CLI is thin — ~80 lines wrapping HTTP calls

### Scripts: npx tsx
- Same execution model as clawling (`npx tsx scripts/seed.ts`)
- No build step, no compilation
- Scripts import from `@repo/crm-schema` for types

## Risks / Trade-offs

- **Generic CRUD verbosity**: SQLAlchemy's `__table__.columns` reflection is very concise. Drizzle's equivalent (`getTableColumns()`) exists but is less ergonomic. The generic CRUD handler may be slightly longer.
- **Full-text search**: PostgreSQL `tsvector` works identically, but Drizzle uses `sql` template literals which are a bit more manual than SQLAlchemy's `text()`.
- **Migration from lightweight ALTER TABLE**: The current `database.py` uses inline ALTER TABLE for schema evolution. Drizzle Kit provides proper migration files — better long-term but different workflow.
- **pnpm vs npm**: The project currently uses npm. Switching to pnpm is optional but recommended for workspace support.

## Migration Plan

1. Create `packages/crm-schema` with Drizzle schema mirroring current SQLAlchemy models
2. Create `packages/crm-api` with Hono routes matching current FastAPI endpoints
3. Run existing Python tests against new TS CRM API to verify compatibility
4. Rewrite CRM CLI in TypeScript
5. Update `docker-compose.yml` to use new TS CRM API container
6. Rewrite scripts (seed, reset, reseed, agent) in TypeScript
7. Rewrite tests in vitest
8. Update frontend `crm.ts` to import types from `@repo/crm-schema`
9. Remove Python code (`crm/*.py`, `crm-cli/crm_cli/`, old `scripts/*.py`)
10. Update openspec specs to reflect new stack

## Open Questions
- Should we use `pnpm` workspaces or keep `npm` with path references? (Recommendation: pnpm)
- Should `crm-cli` be installed via `pnpm` in the clawling container, or remain a bind-mounted standalone? (Recommendation: keep bind-mount pattern for dev, install in Docker build for prod)
