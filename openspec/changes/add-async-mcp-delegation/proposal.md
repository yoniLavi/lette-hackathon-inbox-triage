# Change: Async MCP delegation for faster chat responses

## Why
CRM tool calls (search_entity, get_entity) take 5-30s each. Multi-tool queries can take minutes. For a chatbot, this is too slow — users expect sub-10s responses for simple questions. The agent's thinking and tool orchestration should not block the response stream unnecessarily.

## What Changes
Two possible approaches (to be decided during investigation):

### Option A: Subagent delegation via system prompt
Instruct the main Claude Code agent (via `agent/workspace/CLAUDE.md`) to spawn background subagent tasks for MCP-heavy operations. The main agent responds immediately with a summary plan, then streams results as subagent tasks complete.

- Pro: No API code changes, leverages Claude Code SDK's built-in task/subagent capabilities
- Con: Relies on the model following instructions; may not always delegate

### Option B: Async tool wrapper in API layer
Wrap MCP tool calls in our `api.py` so they execute asynchronously. When the SDK emits a `ToolUseBlock`, intercept it and run the MCP call in an `asyncio.Task`, streaming partial results back to the client while the tool runs.

- Pro: Deterministic, guaranteed async behavior
- Con: Requires intercepting SDK internals; may not be possible with current SDK architecture

### Option C: Hybrid — timeout + parallel tool hints
Add per-request timeouts (from `add-chat-widget` task 3.4) and instruct the agent to batch/parallelize tool calls where possible. Simpler than full async delegation.

- Pro: Low complexity, pragmatic
- Con: Doesn't fundamentally change response latency

## Impact
- Affected specs: `agent-api` (response latency, streaming behavior)
- Affected code: `agent/api.py`, `agent/workspace/CLAUDE.md`
- Depends on: `add-chat-widget` task 3 (multi-turn fix) — async delegation is moot if sessions hang
- Note: This is a separate concern from the multi-turn hang bug. Even with working multi-turn, tool calls are inherently slow and need a UX strategy.
