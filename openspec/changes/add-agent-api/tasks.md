## 1. API Server
- [ ] 1.1 Create `agent/api.py` — FastAPI app with session management and EspoMCP config
- [ ] 1.2 Create `agent/requirements.txt` — fastapi, uvicorn, claude-agent-sdk

## 2. Container Updates
- [ ] 2.1 Update `agent/Dockerfile` — add Python 3, install requirements, set entrypoint to uvicorn
- [ ] 2.2 Update `agent/entrypoint.sh` — start FastAPI server (keep CLI fallback)

## 3. Docker Compose
- [ ] 3.1 Update `docker-compose.yml` — agent runs persistently, expose port, remove profile gate

## 4. CLI Update
- [ ] 4.1 Update `scripts/agent.py` — call HTTP API instead of docker compose run

## 5. Validation
- [ ] 5.1 Test: agent container starts and API is healthy
- [ ] 5.2 Test: `scripts/agent.py "List all emails"` returns CRM data via API
- [ ] 5.3 Test: session restart clears context
