# Change: Two-tier chat AI with async CRM delegation

## Why
CRM tool calls (via `crm` CLI) take 5-30s each. Multi-tool queries can take minutes. This is unacceptable for user-facing AI — the chatbot should respond instantly and delegate CRM-heavy work asynchronously.

The core principle: **the user-facing AI should never perform blocking operations.** It should be immediately responsive to the user at all times.

## What Changes

### Two-layer architecture

Two AI sessions with fundamentally different runtime characteristics:

1. **Frontend AI** (user-facing) — calls the Anthropic/Bedrock Messages API directly via `anthropic` Python SDK. No Claude Code CLI overhead. Has one tool (`delegate_to_worker`) for fire-and-forget CRM delegation. Converses with the user, has rich page context, and is smart (Sonnet). Maintains its own conversation history in-process. **Target: context-only responses in < 3s.** After delegating, the Frontend AI remains available for follow-up questions while the worker runs.

2. **Worker AI** (CRM agent) — the existing Claude Code SDK session with `crm` CLI access, CLAUDE.md domain knowledge, and shift skills. Unchanged from current implementation. Receives plain-text prompts from the Frontend AI via the delegation tools.

### Why direct API for Frontend AI

The Claude Code SDK wraps a CLI subprocess — each `query()` + `receive_response()` cycle incurs:
- Subprocess spawn/IPC overhead
- Claude Code system prompt assembly, tool registration, CLAUDE.md scanning
- Multiple stdio JSON round-trips

This added ~5-8s to every Frontend AI response, even when no tools were used. Since the Frontend AI only needs two custom tools (no Bash, no file access), calling the Messages API directly eliminates all of this overhead. Measured fast-path times with SDK were 3.7-8.2s; direct API should be < 3s.

### Delegation tool

One tool definition in the Frontend AI's Messages API call:
- `delegate_to_worker(prompt)` — handled in-process, queues a prompt for the Worker AI, returns a task ID immediately (non-blocking)

The Frontend AI calls `delegate_to_worker`, gets the task ID back, writes a brief acknowledgment, and **ends its turn immediately**. The SSE stream closes. The worker runs in the background. The user can continue chatting with the Frontend AI. The worker result is delivered via a separate polling endpoint (`GET /worker/status`) and appears as a new assistant message in the UI.

### Page context enrichment

The chat widget passes structured JSON page context (actual on-screen data — cases, tasks, contacts, stats) with each message. The Frontend AI can answer many questions instantly from this context alone, without delegating to the worker at all.

### Why this approach

- **Zero changes to the worker** — proven CRM agent, shift processing, domain knowledge all preserved
- **Fast user-facing AI** — direct API call, no CLI subprocess, < 3s for context answers
- **Full-capability model** — Sonnet with effort=low, not a cheap model
- **Clean separation** — Frontend AI owns the conversation, Worker AI owns CRM operations
- **Simple delegation** — tool handlers are just async functions, not a complex tool registry
- **Conversation history** — Frontend AI maintains messages in-process for multi-turn context

### Current constraints

- **Single worker** — only one Worker AI session at a time. If the Worker is busy with a delegation, additional CRM requests must wait. The Frontend AI remains responsive regardless (it can still answer from context or conversation). Concurrent workers are a future enhancement.

### Learnings from implementation

- Claude Code SDK adds ~5-8s overhead per query even with `effort=low` — CLI subprocess is the bottleneck
- The streaming SSE infrastructure (asyncio.Queue bridge) works well for both direct API and SDK paths
- Page context enrichment delivers huge value — most "what's on my screen" questions need no CRM access
- Bedrock ABSK auth: pass `AWS_BEARER_TOKEN_BEDROCK` as `Authorization: Bearer` header, skip SigV4 via `_BearerTokenBedrock` subclass
- Bedrock model ID: `eu.anthropic.claude-sonnet-4-20250514-v1:0`
- **Non-blocking delegation is critical**: the original `get_worker_result` tool blocked the Frontend AI for 30-60s. Removed it entirely — the API layer manages worker lifecycle independently. The Frontend AI only has `delegate_to_worker` (fire-and-forget). Worker results delivered via polling endpoint.
- **UI must not block**: even with a non-blocking backend, the SSE stream staying open caused the frontend to disable input. Solution: close the stream immediately after acknowledgment, deliver worker results via `/worker/status` polling.

## Impact
- Affected specs: `agent-api` (direct API for frontend, SDK for worker, tool handling, SSE streaming), `frontend-app` (page context enrichment, streaming UX)
- Affected code: `agent/api.py` (direct API client, conversation history, tool dispatch), `agent/mcp_worker.py` (simplified — worker dispatch only, no MCP), `agent/pyproject.toml` (add `anthropic` dep), `agent/workspace/CLAUDE.md` (unchanged — worker instructions), `frontend/src/components/dashboard/AIAssistant.tsx` (structured context, streaming), `frontend/src/lib/page-context.tsx` (context provider)
- Depends on: `add-chat-widget` (SSE streaming — done), `update-frontend-data-model` (archived — rich CRM types)
