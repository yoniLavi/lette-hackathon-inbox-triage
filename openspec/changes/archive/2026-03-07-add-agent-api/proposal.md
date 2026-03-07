# Change: Add agent API with persistent SDK session

## Why
The agent needs to support both autonomous triage work and interactive Q&A from the frontend. A one-shot `claude -p` per request has ~4s cold start and no context continuity. A persistent session via the Agent SDK eliminates startup cost and lets the agent accumulate knowledge across interactions — the "agent on shift" model.

## What Changes
- New `agent/api.py` — FastAPI server using `ClaudeSDKClient` with EspoMCP configured via SDK options
- New `agent/requirements.txt` — Python dependencies (fastapi, uvicorn, claude-agent-sdk)
- Updated `agent/Dockerfile` — add Python, install deps, run the API server
- Updated `agent/entrypoint.sh` — start the FastAPI server (replaces one-shot claude -p)
- Updated `docker-compose.yml` — agent service runs persistently (not one-shot), exposes API port
- Updated `scripts/agent.py` — calls HTTP API instead of `docker compose run`

## Impact
- Affected specs: new `agent-api` capability, modifies `agent-container`
- Affected code: `agent/`, `scripts/agent.py`, `docker-compose.yml`
