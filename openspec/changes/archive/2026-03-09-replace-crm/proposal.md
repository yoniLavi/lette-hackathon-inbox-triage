# Change: Replace EspoCRM with lightweight CRM API + CLI

## Why
Profiling a single-email shift revealed EspoCRM + EspoMCP is unworkable:
- **109 tool calls / 7+ minutes** to process ONE email
- MCP `create_entity` fails for Email and Task (permission/validation errors in EspoMCP)
- EspoMCP returns summarized results, forcing a two-step search→get pattern that doubles every read
- 18 `ToolSearch` calls just to discover MCP tools — pure overhead
- Agent spirals into Bash/curl fallbacks when MCP create operations fail

Property managers receive 100+ emails/hour. We need sub-second CRUD operations, not 7-minute round-trips per email.

## What Changes

Replace the entire EspoCRM + EspoMCP layer with:

1. **`crm/` — a minimal FastAPI service** (new container, port 8002)
   - PostgreSQL-backed (via SQLAlchemy + asyncpg)
   - REST API for all entities: properties, contacts, emails, tasks, cases, notes
   - Consistent JSON responses, proper filtering, no summarization quirks
   - Shared by the frontend and the agent

2. **`crm-cli` — a gws-style CLI** (Python, installed in agent container)
   - `crm emails list --status archived --limit 10 --order-by date_sent`
   - `crm emails get <id>`
   - `crm emails create --json '{"subject": "Re: ...", "status": "draft"}'`
   - `crm cases create --json '{"name": "Agent Shift — 2026-03-08", "status": "in_progress"}'`
   - Structured JSON output on stdout for AI agent consumption
   - The agent calls this via Bash — no MCP, no ToolSearch, no deferred tool overhead

3. **Remove EspoCRM, EspoMCP, MariaDB** from docker-compose
   - Replace with PostgreSQL + CRM API container
   - Frontend calls CRM API directly (same data shape, new base URL)

## Design: CLI over MCP

Inspired by Google's `gws` CLI pattern — "built for humans and AI agents":
- The agent uses Bash to call `crm <entity> <action>` commands
- Every response is structured JSON on stdout, errors on stderr
- No MCP server, no tool discovery overhead, no deferred loading
- The agent's CLAUDE.md teaches the CLI patterns (like gws ships agent skills)
- Skills (`.claude/commands/`) encode efficient multi-step workflows using the CLI

This eliminates the three biggest bottlenecks:
1. **No MCP overhead** — direct CLI calls, ~50ms each vs 3-5s per MCP round-trip
2. **No summarization** — full entity data returned by default, no search→get two-step
3. **No tool discovery** — Bash is always available, no ToolSearch calls needed

## Data Model

Six entities, matching what we currently use:

### Property (replaces Account)
- `id`, `name`, `type` (BTR/PRS), `units`, `manager`, `description`

### Contact
- `id`, `first_name`, `last_name`, `email`, `type` (tenant/landlord/contractor/prospect/internal/legal), `property_id`, `company`, `unit`, `role`

### Email
- `id`, `subject`, `from_address`, `to_addresses[]`, `cc_addresses[]`, `body`, `body_plain`
- `date_sent`, `status` (archived/draft/sent), `is_read`, `is_replied`, `is_important`
- `message_id`, `in_reply_to`, `thread_id`, `challenge_id`
- `case_id` (direct FK, replaces parentType/parentId pattern)
- Full-text search via PostgreSQL `tsvector` + GIN index on subject + body (queryable via `?search=<term>` on list endpoint)

### Case
- `id`, `name`, `status` (new/in_progress/closed), `priority` (critical/high/medium/low), `description`
- `property_id` (direct FK)

### Task
- `id`, `name`, `status` (not_started/in_progress/completed), `priority` (urgent/normal/low)
- `description`, `date_start`, `date_end`
- `case_id` (direct FK), `contact_id` (direct FK)

### Note
- `id`, `content` (markdown text)
- `case_id` (direct FK)

All entities have `created_at`, `updated_at` timestamps.

All Python tooling uses uv (pyproject.toml, no pip/requirements.txt).

Key simplifications from EspoCRM:
- Direct foreign keys instead of `parentType`/`parentId` polymorphism
- `thread_id` on Email for simple threading (no repliedId chain-walking)
- snake_case everywhere (no camelCase/PascalCase mixing)
- No separate User entity for API auth — use API key header on the CRM service

## Impact
- **BREAKING**: Removes EspoCRM, MariaDB, EspoMCP
- Affected specs: `docker-stack`, `agent-container`, `seed-scripts`, `agent-api`, `frontend-app`
- Affected code: everything that touches EspoCRM — `agent/`, `scripts/`, `frontend/src/lib/espo.ts`, `docker-compose.yml`
- Blocked changes: `add-agent-shift` (paused, will resume with new CRM), `add-async-mcp-delegation` (informed by this)
