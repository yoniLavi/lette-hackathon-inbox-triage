## Context

EspoCRM + EspoMCP is the performance bottleneck. Profiling shows 109 tool calls / 7 min for one email. We need a CRM layer that supports sub-second CRUD from both the AI agent and the frontend, with zero MCP overhead.

## Goals / Non-Goals

**Goals:**
- Sub-second CRUD operations for all entities
- Single API surface for frontend and agent
- CLI tool for agent to use via Bash (no MCP)
- Seed the same 100 test emails from challenge dataset
- Keep the existing frontend data contracts (same response shapes)

**Non-Goals:**
- Full CRM feature set (workflows, roles, portals)
- Email sending/receiving (we only store and draft)
- User authentication/authorization (single API key for the hackathon)
- Migration from EspoCRM data (we re-seed from the challenge dataset)

## Decisions

### FastAPI + PostgreSQL over Supabase
- **Decision**: Build a minimal FastAPI service with SQLAlchemy + asyncpg
- **Why**: Full control over the API shape, no external dependency, runs in Docker like everything else. Supabase would add PostgREST configuration complexity and a heavier Docker footprint for the same result.
- **Alternative considered**: Supabase local — adds PostgREST + GoTrue + Studio containers. Overkill for 6 tables.

### CLI over MCP
- **Decision**: Python CLI (`crm-cli`) using click/typer, calling the CRM API via httpx
- **Why**: The agent calls it via Bash — always available, no ToolSearch overhead, structured JSON output. Inspired by Google Workspace CLI (`gws`) pattern.
- **Alternative considered**: Custom MCP server wrapping the CRM API. Rejected because MCP tool discovery adds ~18 ToolSearch calls per shift, and MCP's stdio transport adds latency.

### Single container for API + CLI
- **Decision**: CRM API runs in its own container. CLI is a Python package installed in the agent container.
- **Why**: API needs to be accessible from both frontend and agent. CLI is an agent-side convenience.

### Direct FKs over polymorphic relationships
- **Decision**: `email.case_id`, `task.case_id`, `note.case_id` instead of `parentType`/`parentId`
- **Why**: Simpler queries, proper FK constraints, no need to filter by type.

## Risks / Trade-offs

- **Risk**: Rewriting CRM layer is a lot of code during a hackathon
  - Mitigation: The data model is simple (6 tables). FastAPI + SQLAlchemy is well-trodden. Most of the work is porting seed.py.
- **Risk**: Frontend needs updating to call new API
  - Mitigation: Frontend already uses a proxy route (`/api/crm`). We change the proxy target and adapt the type mappings.
- **Trade-off**: Losing EspoCRM's UI for manual data inspection
  - Acceptable: We have the frontend dashboard. For debugging, the CLI and `psql` are sufficient.

## Open Questions

- Should the CLI support `--format table` for human-readable output in addition to JSON? (Nice to have, not blocking.)
- Do we need full-text search on email body, or is filtering by status/date/subject enough for now?
