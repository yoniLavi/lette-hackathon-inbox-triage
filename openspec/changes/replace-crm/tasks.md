## 1. Database + CRM API
- [x] 1.1 Create `crm/` directory with FastAPI app, SQLAlchemy models, and database init
- [x] 1.2 Define models: Property, Contact, Email, Task, Case, Note with proper FKs and indexes
- [x] 1.3 Implement REST endpoints: list (with filtering/ordering/pagination), get, create, update, delete for each entity
- [x] 1.4 Add counts endpoint for dashboard (email count, open tasks, closed cases)
- [x] 1.5 Dockerize: `crm/Dockerfile`, add PostgreSQL + CRM API to docker-compose

## 2. CRM CLI
- [x] 2.1 Create `crm-cli/` Python package with click — `crm <entity> <action>` pattern
- [x] 2.2 Implement: list, get, create, update, delete subcommands for each entity
- [x] 2.3 Structured JSON output on stdout, errors on stderr, proper exit codes
- [x] 2.4 Install in agent container (bind-mount in dev, install via entrypoint)

## 3. Seed Scripts
- [x] 3.1 Port `scripts/seed.py` to seed CRM API (properties, contacts, emails from challenge dataset)
- [x] 3.2 Port `scripts/reset.py` to clear CRM data via API
- [x] 3.3 Update `scripts/reseed.py`

## 4. Agent Integration
- [x] 4.1 Remove EspoMCP from agent container and SDK options
- [x] 4.2 Install crm-cli in agent container
- [x] 4.3 Rewrite `agent/workspace/CLAUDE.md` — replace MCP tool docs with CLI usage patterns
- [x] 4.4 Rewrite `agent/workspace/.claude/commands/shift.md` — use CLI instead of MCP tools
- [x] 4.5 Update `agent/workspace/learnings.md` — reset for new CRM

## 5. Frontend Integration
- [x] 5.1 Update `frontend/src/lib/espo.ts` to call CRM API
- [x] 5.2 Adapt type mappings (snake_case API → frontend types)
- [x] 5.3 Update proxy route (`/api/crm`)

## 6. Docker Compose
- [x] 6.1 Remove mariadb, espocrm, espocrm-daemon services
- [x] 6.2 Add postgres, crm-api services
- [x] 6.3 Update agent service (remove EspoMCP env vars, add CRM API URL)
- [x] 6.4 Update .env.example

## 7. Cleanup
- [x] 7.1 Remove `scripts/create_api_user.py` (no longer needed)
- [x] 7.2 Remove `scripts/espo_api.py` and `scripts/espo_cli.py`
- [x] 7.3 Update README.md with new setup instructions
- [x] 7.4 Remove `agent/mcp.json`

## 8. Validation
- [x] 8.1 Add CRM API integration tests (health, CRUD, filters, full-text search)
- [ ] 8.2 Test: seed.py populates all 100 emails, contacts, properties
- [ ] 8.3 Test: agent shift completes in < 60s for 1 email (vs 7+ min with EspoCRM)
- [ ] 8.4 Test: frontend dashboard loads with data from new CRM API
- [ ] 8.5 Test: `scripts/agent.py --shift` works end-to-end with new CRM
