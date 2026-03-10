# Change: Async CRM delegation for responsive chat

## Why
CRM tool calls (search_entity, get_entity) take 5-30s each. Multi-tool queries can take minutes. This is unacceptable for user-facing AI — the chatbot should respond instantly and delegate CRM-heavy work asynchronously.

The core principle: **the user-facing AI should never make synchronous CRM calls.** It should be immediately responsive to the user at all times.

## What Changes
Two architectural approaches (to be decided during investigation):

### Option A: Claude Code spawns background subagents
The Claude Code agent is instructed (via CLAUDE.md / system prompt) to never block on CRM tool calls. Instead, it spawns background subagent tasks for all MCP operations, responds to the user immediately with its plan, and streams results as subagent tasks complete.

- Pro: Single agent architecture, leverages Claude Code SDK's built-in capabilities
- Con: Relies on the model following instructions; need to verify Claude Code supports subagent spawning via SDK
- Investigation needed: Does ClaudeSDKClient support the Agent tool / task spawning? Can we observe subagent progress via receive_response()?

### Option B: Separate conversational AI + Claude Code worker
A lightweight AI (e.g., direct Claude API call within the FastAPI process) handles the user conversation — it's fast, has no tools, and responds instantly. When CRM data is needed, it dispatches async requests to the Claude Code worker (existing ClaudeSDKClient), and streams results back to the user as they arrive.

- Pro: Guaranteed responsiveness — conversational AI never blocks on tools. Clean separation of concerns.
- Con: Two AI layers to coordinate. The conversational AI needs enough context to know what to ask the worker for.
- Architecture: FastAPI → conversational AI (Claude API, no tools, instant) → async queue → Claude Code worker (MCP tools, slow) → results streamed back

### Learnings from chat widget work
- Option B (intercepting SDK tool calls in api.py) from the original proposal is **not feasible** — tool execution happens inside the Claude Code CLI subprocess, not in our Python code. We only observe ToolUseBlock/ToolResultBlock after the fact.
- The streaming SSE infrastructure is already in place (asyncio.Queue bridge, tool_use/text/done events). Either approach can build on this.
- Prompt engineering has high impact: the agent currently over-queries (4-6 sequential searches when 1 would suffice). Better CLAUDE.md guidance should be part of any approach.
- The reasoning trace filtering (text_parts.clear() on ToolUseBlock) already improves perceived quality, but latency remains unacceptable for interactive use.

### Page context as AI context
The chat widget already passes a `context` field with each prompt (from `usePageContext()` in AIAssistant.tsx). Currently this is a static text description of the page. We should enrich it with **actual on-screen data** — the case object, tasks, property, contacts, stats — so the conversational AI can answer many questions instantly from what the user already sees, without any CRM calls.

For example, on `/situations/42` the context would include the case name, priority, property name, task count, draft status, and contact names. "What's the status of this case?" or "who's involved?" could be answered in <1s from context alone.

This directly serves the <3s response goal and reduces CRM load for the most common queries (asking about what's already on screen).

## Impact
- Affected specs: `agent-api` (response latency, streaming behavior, possibly new worker architecture), `frontend-app` (page context enrichment)
- Affected code: `agent/api.py`, `agent/workspace/CLAUDE.md`, `frontend/src/components/dashboard/AIAssistant.tsx`, possibly new conversational AI module
- Depends on: `add-chat-widget` (multi-turn fix, SSE streaming — both done), `update-frontend-data-model` (archived — provides rich CRM types and include params)
