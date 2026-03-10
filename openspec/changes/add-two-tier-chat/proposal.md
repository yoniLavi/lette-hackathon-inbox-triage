# Change: Two-tier chat AI with async CRM delegation

## Why
CRM tool calls (via `crm` CLI) take 5-30s each. Multi-tool queries can take minutes. This is unacceptable for user-facing AI — the chatbot should respond instantly and delegate CRM-heavy work asynchronously.

The core principle: **the user-facing AI should never perform blocking operations.** It should be immediately responsive to the user at all times.

## What Changes

### Chosen approach: Two-layer Claude Code architecture

Two persistent Claude Code SDK sessions, each a full-capability AI:

1. **Frontend AI** (user-facing) — a Claude Code session with a custom MCP server for async worker delegation. This AI converses with the user, has rich page context, and is smart (Sonnet/Opus). It **never blocks** — its only tool for CRM work is an async delegation MCP tool that returns immediately.

2. **Worker AI** (CRM agent) — the existing Claude Code session with `crm` CLI access, CLAUDE.md domain knowledge, and shift skills. Unchanged from current implementation. Receives plain-text prompts from the Frontend AI via the delegation MCP.

### Delegation MCP server

A lightweight MCP server (runs in the agent container) with two tools:
- `delegate_to_worker(prompt)` — queues a prompt for the Worker AI, returns a task ID immediately (non-blocking)
- `get_worker_result(task_id)` — polls for the result; returns the response text when done, or a "still working" status

The Frontend AI calls `delegate_to_worker`, gets the task ID back instantly, can acknowledge the user, then calls `get_worker_result` to retrieve the CRM data when ready. From the user's perspective: immediate acknowledgment → tool progress → CRM results, all in one streaming turn.

### Page context enrichment

The chat widget passes structured JSON page context (actual on-screen data — cases, tasks, contacts, stats) with each message. The Frontend AI can answer many questions instantly from this context alone, without delegating to the worker at all.

### Why this approach

- **Zero changes to the worker** — proven CRM agent, shift processing, domain knowledge all preserved
- **Full-capability user-facing AI** — not a cheap/fast model, but a smart AI that simply doesn't block
- **Clean separation** — Frontend AI owns the conversation, Worker AI owns CRM operations
- **Reuses Claude Code SDK** — both layers use the same SDK, same auth (Bedrock), same infrastructure
- **Simple delegation** — the MCP server is just an async prompt relay, not a complex tool registry

### Current constraints

- **Single worker** — only one Worker AI session at a time. If the Worker is busy with a delegation, additional CRM requests must wait. The Frontend AI remains responsive regardless (it can still answer from context or conversation). Concurrent workers are a future enhancement.

### Learnings from earlier prototyping

- Tool execution happens inside the Claude Code CLI subprocess — we can't intercept mid-turn
- The streaming SSE infrastructure (asyncio.Queue bridge) works well and carries over
- Page context enrichment alone delivers huge value — most "what's on my screen" questions answered in < 2s
- The ClaudeSDKClient supports `model`, `system_prompt`, `max_turns`, and MCP server configuration

## Impact
- Affected specs: `agent-api` (two-session architecture, MCP server, new streaming flow), `frontend-app` (page context enrichment, streaming UX)
- Affected code: `agent/api.py` (two sessions, MCP coordination), new `agent/mcp_worker.py` (delegation MCP server), `agent/workspace/CLAUDE.md` (unchanged — worker instructions), new frontend AI system prompt, `frontend/src/components/dashboard/AIAssistant.tsx` (structured context, streaming), `frontend/src/lib/page-context.tsx` (new — context provider)
- Depends on: `add-chat-widget` (SSE streaming — done), `update-frontend-data-model` (archived — rich CRM types)
