# Change: Wire the AI chat widget to the agent API

## Why
The frontend has a floating chat assistant (`AIAssistant.tsx`) that currently returns hardcoded mock responses. Wiring it to the agent's `POST /prompt` endpoint makes it a real conversational interface to the CRM-connected agent.

## What Changes
- Update `AIAssistant.tsx` to call `POST /prompt` on the agent API instead of using `setTimeout` with fake responses
- Add loading/typing indicator while the agent is processing
- Handle 409 (agent busy) with a user-friendly message
- Add CORS support to the agent API so the browser can reach it directly
- Agent URL configured via `NEXT_PUBLIC_AGENT_URL` environment variable

## Impact
- Affected specs: `frontend-app` (chat widget behavior), `agent-api` (CORS)
- Affected code: `frontend/src/components/dashboard/AIAssistant.tsx`, `agent/api.py`
