# clawling

A lightweight TypeScript framework for orchestrating multiple Claude AI agents behind a single HTTP gateway. Provides OpenAI-compatible streaming, agent delegation, and session management with minimal configuration.

## Features

- **Multi-agent routing** — define agents in `config.json`, route requests via the `model` field (`clawling/frontend`, `clawling/worker`)
- **Two backend types** — Messages API (fast, stateless-ish) and Claude Agent SDK (autonomous, tool-using)
- **OpenAI-compatible API** — `POST /v1/chat/completions` with SSE streaming, drop-in for any OpenAI client
- **Agent delegation** — parent agents spawn child tasks; results delivered automatically or polled via `/v1/status/:taskId`
- **Session continuity** — Messages API sessions maintain conversation history in-process; Claude SDK sessions persist natively
- **Framework-defined tools** — tools like `delegate_to_worker` and `page_action` execute within the framework, not the agent
- **Bedrock auth** — supports both IAM credentials and bearer token auth (with `skipAuth` for SigV4 bypass)

## Quick Start

```bash
npm install
npx tsx src/index.ts
```

Set `CLAWLING_CONFIG` to point to your config file (defaults to `./config.json`).

## Configuration

```json
{
  "gateway": {
    "port": 8001,
    "cors": ["*"]
  },
  "agents": {
    "frontend": {
      "backend": "messages-api",
      "model": "eu.anthropic.claude-sonnet-4-20250514-v1:0",
      "systemPrompt": "./skills/frontend.md",
      "tools": ["delegate_to_worker", "page_action"],
      "maxTurns": 5
    },
    "worker": {
      "backend": "claude-sdk",
      "model": "eu.anthropic.claude-sonnet-4-20250514-v1:0",
      "cwd": "/workspace",
      "permissions": "bypass",
      "maxTurns": 200
    }
  },
  "delegation": {
    "maxDepth": 3,
    "defaultTimeout": 600
  }
}
```

### Agent backends

| Backend | Use case | How it works |
|---------|----------|-------------|
| `messages-api` | Fast chat, structured tools | Wraps Bedrock Messages API. Conversation history in-process. Framework executes tool calls (delegation, UI actions). |
| `claude-sdk` | Autonomous work, Bash/file access | Wraps Claude Agent SDK. Full agentic loop with tool execution, persistent sessions, cost tracking. |

### Config fields

| Field | Description |
|-------|-------------|
| `backend` | `"messages-api"` or `"claude-sdk"` |
| `model` | Bedrock model ID (e.g., `eu.anthropic.claude-sonnet-4-20250514-v1:0`) |
| `systemPrompt` | Inline string or path (starting with `./`) resolved relative to config dir |
| `cwd` | Working directory for Claude SDK sessions |
| `permissions` | `"bypass"`, `"auto-approve"`, or `"default"` (Claude SDK only) |
| `maxTurns` | Max API turns per prompt (prevents runaway loops) |
| `tools` | Framework-defined tools to register (Messages API only) |

## API

### `POST /v1/chat/completions`

OpenAI-compatible chat endpoint. Routes to agents via the `model` field.

```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "clawling/frontend",
    "stream": true,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

SSE events follow the OpenAI format with an optional `clawling` extension field for framework events (delegation, tool calls, actions, progress).

Pass `x-clawling-session-id` header to resume an existing session.

### `POST /v1/wake/:agent`

Trigger autonomous work (e.g., batch processing). Returns a task ID immediately.

```bash
curl -X POST http://localhost:8001/v1/wake/worker \
  -H "Content-Type: application/json" \
  -d '{"prompt": "/shift"}'
# => {"taskId": "abc123"}
```

### `GET /v1/status/:taskId`

Poll for delegation/wake task results.

```bash
curl http://localhost:8001/v1/status/abc123
# => {"status": "completed", "result": "...", "taskId": "abc123"}
```

### `GET /health`

Returns `{"status": "ok"}`.

## Delegation

Agents can delegate work to other agents. The Messages API backend supports a `delegate_to_worker` tool that spawns a child Claude SDK session. The flow:

1. Frontend agent calls `delegate_to_worker` with a prompt
2. Framework spawns a background worker session
3. Worker runs autonomously, result stored in announcer
4. Result injected into parent session (for conversation continuity) and available via `/v1/status/:taskId` (for polling)

Delegation depth is configurable (`delegation.maxDepth`) with automatic timeout detection.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAWLING_CONFIG` | Path to config.json (default: `./config.json`) |
| `CLAWLING_GATEWAY_TOKEN` | Optional bearer token for gateway auth |
| `AWS_REGION` | AWS region for Bedrock (default: `eu-west-1`) |
| `AWS_BEARER_TOKEN_BEDROCK` | Bearer token for Bedrock auth (skips SigV4) |
| `CLAUDE_CODE_USE_BEDROCK` | Set to `1` to use Bedrock for Claude SDK backend |

## Architecture

```
src/
├── index.ts              # Entry point — config, registry, server startup
├── config.ts             # Zod schema validation for config.json
├── gateway.ts            # Hono HTTP gateway with SSE streaming
├── log.ts                # Structured logger
├── agents/
│   ├── types.ts          # AgentBackend, AgentSession, AgentEvent interfaces
│   ├── registry.ts       # Agent lifecycle management
│   ├── claude-backend.ts # Claude Agent SDK wrapper
│   └── messages-backend.ts # Bedrock Messages API wrapper
├── delegation/
│   ├── tracker.ts        # Parent-child bookkeeping
│   ├── spawner.ts        # Background task spawning
│   └── announcer.ts      # Result delivery + polling store
├── sessions/
│   └── store.ts          # Framework-level session tracking
└── tools/
    └── mcp-bridge.ts     # Custom tool registration via MCP
```

## Dependencies

- **[hono](https://hono.dev/)** — HTTP framework with SSE streaming
- **[zod](https://zod.dev/)** v4 — config validation
- **[@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)** — Claude Code SDK for autonomous agents
- **[@anthropic-ai/bedrock-sdk](https://www.npmjs.com/package/@anthropic-ai/bedrock-sdk)** — Bedrock Messages API client

## Docker

```dockerfile
FROM node:20-slim
# ... install git, claude-code CLI, npm deps
COPY src/ /app/src/
ENTRYPOINT ["/app/entrypoint.sh"]
```

The `entrypoint.sh` installs any bind-mounted tools (e.g., CRM CLI via uv) and starts the server with `npx tsx src/index.ts`.
