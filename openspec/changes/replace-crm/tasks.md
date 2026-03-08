## 1. Database + CRM API
- [ ] 1.1 Create `crm/` directory with FastAPI app, SQLAlchemy models, and Alembic migrations
- [ ] 1.2 Define models: Property, Contact, Email, Task, Case, Note with proper FKs and indexes
- [ ] 1.3 Implement REST endpoints: list (with filtering/ordering/pagination), get, create, update, delete for each entity
- [ ] 1.4 Add counts endpoint for dashboard (email count, open tasks, closed cases)
- [ ] 1.5 Dockerize: `crm/Dockerfile`, add PostgreSQL + CRM API to docker-compose

## 2. CRM CLI
- [ ] 2.1 Create `crm-cli/` Python package with click/typer — `crm <entity> <action>` pattern
- [ ] 2.2 Implement: list, get, create, update, delete subcommands for each entity
- [ ] 2.3 Structured JSON output on stdout, errors on stderr, proper exit codes
- [ ] 2.4 Install in agent container (add to agent Dockerfile or bind-mount in dev)

## 3. Seed Scripts
- [ ] 3.1 Port `scripts/seed.py` to seed CRM API (properties, contacts, emails from challenge dataset)
- [ ] 3.2 Port `scripts/reset.py` to clear CRM data via API
- [ ] 3.3 Update `scripts/reseed.py`

## 4. Agent Integration
- [ ] 4.1 Remove EspoMCP from agent container and SDK options
- [ ] 4.2 Install crm-cli in agent container
- [ ] 4.3 Rewrite `agent/workspace/CLAUDE.md` — replace MCP tool docs with CLI usage patterns
- [ ] 4.4 Rewrite `agent/workspace/.claude/commands/shift.md` — use CLI instead of MCP tools
- [ ] 4.5 Update `agent/workspace/learnings.md` — reset for new CRM

## 5. Frontend Integration
- [ ] 5.1 Update `frontend/src/lib/espo.ts` (or replace) to call CRM API
- [ ] 5.2 Adapt type mappings (snake_case API → frontend types)
- [ ] 5.3 Update proxy route if needed

## 6. Docker Compose
- [ ] 6.1 Remove mariadb, espocrm, espocrm-daemon services
- [ ] 6.2 Add postgres, crm-api services
- [ ] 6.3 Update agent service (remove EspoMCP env vars, add CRM API URL)
- [ ] 6.4 Update .env.example

## 7. Cleanup
- [ ] 7.1 Remove `scripts/create_api_user.py` (no longer needed)
- [ ] 7.2 Remove `scripts/espo_api.py` and `scripts/espo_cli.py`
- [ ] 7.3 Update README.md with new setup instructions

## 8. Validation
- [ ] 8.1 Test: seed.py populates all 100 emails, contacts, properties
- [ ] 8.2 Test: CRM CLI can list, get, create, update entities
- [ ] 8.3 Test: agent shift completes in < 60s for 1 email (vs 7+ min with EspoCRM)
- [ ] 8.4 Test: frontend dashboard loads with data from new CRM API
- [ ] 8.5 Test: `scripts/agent.py --shift` works end-to-end with new CRM
