## Context
The current agent server is ~1,339 lines of Python wrapping the Claude Code SDK (subprocess) and Anthropic Bedrock SDK. It implements a two-tier AI architecture (fast Frontend AI + slow Worker AI) with custom session management, delegation via asyncio futures, and SSE streaming. This works, but the orchestration pattern (delegation, session management, progress tracking) is reusable and would benefit from being a standalone framework.

The `@anthropic-ai/claude-agent-sdk` (v0.2.83) provides a native TypeScript programmatic API for Claude Code — persistent sessions, autonomous tool execution, hooks, cost tracking — without spawning a subprocess. This eliminates the main barrier to a TS rewrite.

## Goals
- Extract the delegation pattern into a reusable framework ("clawling")
- Use Claude Agent SDK as the primary agent backend (in-process, no subprocess)
- Keep the `AgentBackend` interface clean enough to add ACP support later (YAGNI for now)
- Run as a single Docker container configured via JSON + mounted files
- Preserve all current functionality: two-tier AI, shifts, SSE streaming, page actions

## Non-Goals
- Multi-provider support in v1 (ACP backend deferred)
- Porting the CRM API to TypeScript (separate decision)
- Changing the frontend architecture (minimal SSE event format changes only)
- Building a general-purpose agent platform (stay focused, NanoClaw-scale complexity)

## Decisions

### Decision: Claude Agent SDK as primary backend
The `@anthropic-ai/claude-agent-sdk` runs in-process (no subprocess), provides hooks for progress tracking (replacing regex parsing of CLI commands), and supports persistent sessions, cost tracking, and MCP tools natively. ACP support can be added later behind the same `AgentBackend` interface.

**Alternatives considered:**
- ACP SDK only — loses hooks, in-process MCP, structured cost tracking. YAGNI to support multiple providers now.
- Dual backend from day one — adds ~120 lines of ACP code that won't be used. Violates YAGNI.

Example config showing both backend types, with claw ecosystem conventions (OpenAI-compatible routing via `model` field, bearer token auth, SKILL.md format for skills):
```json
{
  "gateway": {
    "port": 8001,
    "cors": ["*"]
  },
  "agents": {
    "frontend": {
      "backend": "messages-api",
      "model": "claude-sonnet-4-6",
      "systemPrompt": "./skills/frontend.md",
      "tools": ["delegate_to_worker", "page_action"],
      "maxTurns": 5
    },
    "worker": {
      "backend": "claude-sdk",
      "model": "claude-sonnet-4-6",
      "cwd": "/workspace",
      "permissions": "bypass",
      "maxTurns": 200
    }
  },
  "delegation": {
    "maxDepth": 3,
    "defaultTimeout": 300
  },
  "sessions": {
    "storePath": "./data/sessions"
  }
}
```

Clients route to agents via the `model` field in OpenAI-compatible requests:
- `"model": "clawling/frontend"` → routes to the `frontend` agent
- `"model": "clawling/worker"` → routes to the `worker` agent

Session affinity via `x-clawling-session-id` header. Optional auth via `CLAWLING_GATEWAY_TOKEN` env var.
```

### Decision: Hono for HTTP server
Lightweight, native SSE support via `streamSSE()`, minimal API surface. Fastify would also work but is heavier.

### Decision: JSONL for session persistence
Simple, append-only, human-readable. The Agent SDK handles its own session persistence internally; clawling's JSONL store tracks framework-level state (delegation records, parent-child relationships, message metadata).

### Decision: Config-driven agent definitions
Each agent is defined in `config.json` with model, tools, permissions, system prompt, and cwd. No code changes needed to add/modify agents — just edit config and restart. Skills are mounted as markdown files.

### Decision: MCP bridge for custom tools
Custom tools (like the `crm` CLI) are registered in config with shell command templates, exposed to agents via a lightweight MCP server. For the Claude SDK backend, `createSdkMcpServer()` runs tools in-process. This replaces the need to install tools directly in the agent's environment (though the crm CLI is still mounted for direct bash access by the agent).

## Risks / Trade-offs
- **Agent SDK stability**: v0.2.83, actively developed. The v2 session API is marked unstable. Mitigation: use v1 `query()` with `resume` option for now, upgrade to v2 when stable.
- **Bedrock auth**: The Agent SDK uses the same env vars as Claude Code CLI (`CLAUDE_CODE_USE_BEDROCK`, `AWS_BEARER_TOKEN_BEDROCK`). Should work unchanged.
- **Frontend SSE adaptation**: The SSE event format changes slightly (custom events → OpenAI-compatible + extensions). `AIAssistant.tsx` needs updates. Mitigation: keep the event format close to current; changes are in the parser, not the UX.

### Decision: Both AI tiers go through clawling
Both the Frontend AI (fast chat) and Worker AI (batch processing) are clawling agents, configured in `config.json`. Delegation from frontend to worker is a clawling primitive, not custom wiring. This is the core architectural point — all agent orchestration, including what model to use and how tiers interact, is configurable.

To handle the latency difference, clawling supports two backend types:
- **`messages-api`** — thin wrapper around the Anthropic/Bedrock Messages API. Maintains conversation history in-process, executes framework-defined tools (delegate, page_action) directly. No CLAUDE.md loading, no file/bash tools. Optimized for <3s responses. Used by the frontend agent.
- **`claude-sdk`** — full Claude Agent SDK with autonomous tool execution, hooks, cost tracking, persistent sessions. Used by the worker agent.

Both implement the same `AgentBackend` interface. The framework routes prompts to the right backend based on config. Delegation from a `messages-api` agent to a `claude-sdk` agent is a standard clawling `spawn()` call.

### Decision: Monorepo
Clawling lives in this project's monorepo for now. Extract to a standalone package when the interface stabilizes.

## Risks / Trade-offs
