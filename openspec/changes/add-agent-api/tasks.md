## 1. API Server
- [x] 1.1 Create `agent/api.py` — FastAPI app with session management and EspoMCP config
- [x] 1.2 Create `agent/pyproject.toml` — fastapi, uvicorn, claude-code-sdk (managed by uv)

## 2. Container Updates
- [x] 2.1 Update `agent/Dockerfile` — add Python 3, install requirements, set entrypoint to uvicorn
- [x] 2.2 Update `agent/entrypoint.sh` — start FastAPI server (keep CLI fallback)

## 3. Docker Compose
- [x] 3.1 Update `docker-compose.yml` — agent runs persistently, expose port, remove profile gate

## 4. CLI Update
- [x] 4.1 Update `scripts/agent.py` — call HTTP API instead of docker compose run

## 5. Validation
- [x] 5.1 Test: agent container starts and API is healthy
- [x] 5.2 Test: CRM queries return data via EspoMCP (100 emails counted)
- [x] 5.3 Test: session restart clears context
- [x] 5.4 Created `scripts/test_agent_api.py` — 7 integration tests, all passing
