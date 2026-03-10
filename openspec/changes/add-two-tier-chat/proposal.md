# Change: Two-tier chat AI with async CRM delegation

## Why
CRM tool calls (via `crm` CLI) take 5-30s each. Multi-tool queries can take minutes. This is unacceptable for user-facing AI — the chatbot should respond instantly and delegate CRM-heavy work asynchronously.

The core principle: **the user-facing AI should never perform blocking operations.** It should be immediately responsive to the user at all times.

## What Changes

### Two-layer architecture

Two AI sessions with fundamentally different runtime characteristics:

1. **Frontend AI** (user-facing) — calls the Anthropic/Bedrock Messages API directly via `anthropic` Python SDK. No Claude Code CLI overhead. Has two tool definitions (`delegate_to_worker`, `get_worker_result`) for async CRM delegation. Converses with the user, has rich page context, and is smart (Sonnet). Maintains its own conversation history in-process. **Target: context-only responses in < 3s.**

2. **Worker AI** (CRM agent) — the existing Claude Code SDK session with `crm` CLI access, CLAUDE.md domain knowledge, and shift skills. Unchanged from current implementation. Receives plain-text prompts from the Frontend AI via the delegation tools.

### Why direct API for Frontend AI

The Claude Code SDK wraps a CLI subprocess — each `query()` + `receive_response()` cycle incurs:
- Subprocess spawn/IPC overhead
- Claude Code system prompt assembly, tool registration, CLAUDE.md scanning
- Multiple stdio JSON round-trips

This added ~5-8s to every Frontend AI response, even when no tools were used. Since the Frontend AI only needs two custom tools (no Bash, no file access), calling the Messages API directly eliminates all of this overhead. Measured fast-path times with SDK were 3.7-8.2s; direct API should be < 3s.

### Delegation tools

Two tool definitions in the Frontend AI's Messages API call:
- `delegate_to_worker(prompt)` — handled in-process, queues a prompt for the Worker AI, returns a task ID immediately (non-blocking)
- `get_worker_result(task_id)` — handled in-process, returns the response text when done, or a "still working" status

The Frontend AI calls `delegate_to_worker`, gets the task ID back instantly, can acknowledge the user, then calls `get_worker_result` to retrieve the CRM data when ready. From the user's perspective: immediate acknowledgment → tool progress → CRM results, all in one streaming turn.

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
- `anthropic` Python SDK with Bedrock auth: `AnthropicBedrock(aws_bearer_token=..., aws_region=...)`
- Bedrock model ID: `eu.anthropic.claude-sonnet-4-20250514-v1:0`
- In-process MCP server approach (via SDK) was correct for initial implementation but is now replaced by direct tool handling for the Frontend AI; the Worker still uses ClaudeSDKClient

## Impact
- Affected specs: `agent-api` (direct API for frontend, SDK for worker, tool handling, SSE streaming), `frontend-app` (page context enrichment, streaming UX)
- Affected code: `agent/api.py` (direct API client, conversation history, tool dispatch), `agent/mcp_worker.py` (simplified — worker dispatch only, no MCP), `agent/pyproject.toml` (add `anthropic` dep), `agent/workspace/CLAUDE.md` (unchanged — worker instructions), `frontend/src/components/dashboard/AIAssistant.tsx` (structured context, streaming), `frontend/src/lib/page-context.tsx` (context provider)
- Depends on: `add-chat-widget` (SSE streaming — done), `update-frontend-data-model` (archived — rich CRM types)
