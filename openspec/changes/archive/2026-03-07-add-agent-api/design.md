## Context
We need a thin HTTP API in front of the Claude Agent SDK so the frontend (and our dev scripts) can send prompts to a persistent agent session that has EspoCRM tools available.

## Goals / Non-Goals
- Goals:
  - Persistent agent session with EspoCRM access via MCP
  - HTTP API for sending prompts and receiving responses
  - Session restart (fresh context) without container restart
  - Simple enough for hackathon — single session, synchronous responses
- Non-Goals:
  - Concurrent sessions / multi-tenancy
  - Streaming responses to the client (future enhancement)
  - Authentication on the API (internal network only)
  - Job queuing / background processing

## Decisions

### Synchronous request/response (not polling)
The evaluator uses background jobs + polling because evaluations take minutes. Our interactive prompts should complete in seconds. A synchronous `POST /prompt` that blocks until Claude responds is simpler and sufficient. If a request takes too long, the client can set a timeout.

### Single managed session
The API server holds one `ClaudeSDKClient` instance at a time. Multiple `query()` calls within the same client context share conversation history. `POST /session/restart` tears down the current client and creates a fresh one.

### MCP via SDK options (not config file)
The Agent SDK accepts `mcp_servers` in `ClaudeAgentOptions`, so we configure EspoMCP directly in Python:
```python
ClaudeAgentOptions(
    mcp_servers={
        "espocrm": {
            "type": "stdio",
            "command": "node",
            "args": ["/opt/espomcp/build/index.js"],
            "env": {
                "ESPOCRM_URL": os.environ["ESPOCRM_INTERNAL_URL"],
                "ESPOCRM_API_KEY": os.environ["ESPOCRM_API_KEY"],
                "ESPOCRM_AUTH_METHOD": "apikey",
            }
        }
    },
    permission_mode="bypassPermissions",
)
```
This eliminates the separate `mcp.json` file (though we keep it for one-shot CLI use).

### Dockerfile changes
The container needs both Node.js (for Claude Code + EspoMCP) and Python (for the API server + SDK). We add Python 3 to the existing node:20-slim image and install deps via pip.

### API shape
```
POST /prompt         — send a message, get a response
POST /session/restart — drop current session, start fresh
GET  /session/status  — check if session is active, message count
GET  /health          — liveness check
```

## Risks / Trade-offs
- Synchronous HTTP means long-running prompts (e.g. triage of 100 emails) will tie up the connection. Acceptable for hackathon; could add streaming later.
- Single session means no concurrent requests. The API should reject a second prompt while one is in-flight.
- No persistence across container restarts — session context is lost. Acceptable for PoC.
