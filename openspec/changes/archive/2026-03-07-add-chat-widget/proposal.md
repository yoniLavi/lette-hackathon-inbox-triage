# Change: Wire the AI chat widget to the agent API with SSE streaming

## Why
The frontend has a floating chat assistant (`AIAssistant.tsx`) that needs to be a real conversational interface to the CRM-connected agent. Long-running tool calls (10-60s) require streaming progress so users aren't left staring at "Thinking...". Multi-turn conversations are essential for useful chat but currently hang due to a Claude Code SDK issue.

## What Changes
- `AIAssistant.tsx` calls `POST /prompt/stream` (SSE) instead of the non-streaming `/prompt`
- Live status updates: tool names shown as the agent works, markdown rendering for responses
- "New Chat" button resets the session; messages persist via sessionStorage
- Agent API: `POST /prompt/stream` yields SSE events (`status`, `tool_use`, `text`, `done`, `error`)
- Agent API: early SSE yields before slow SDK calls to flush HTTP headers immediately
- **Bug fix needed:** Claude Code SDK `receive_response()` hangs on second turn — needs investigation and fix
- **Bug fix needed:** per-request timeout to prevent silent hangs

## Impact
- Affected specs: `frontend-app` (chat widget), `agent-api` (streaming endpoint, session management)
- Affected code: `frontend/src/components/dashboard/AIAssistant.tsx`, `agent/api.py`
- Key risk: Claude Code SDK multi-turn sessions may require a different API pattern than currently used
