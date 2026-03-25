## REMOVED Requirements

### Requirement: Agent HTTP API
**Reason**: Replaced by clawling's HTTP Gateway (`POST /v1/chat`, `POST /v1/wake/:agent`, `GET /v1/status/:taskId`).
**Migration**: Frontend calls clawling endpoints instead of `/prompt`, `/prompt/stream`, `/shift`, `/worker/status`.

### Requirement: Session Management
**Reason**: Replaced by clawling's config-driven session management and Agent SDK's native session persistence.
**Migration**: Session restart → clawling session management. Status → `/health` + agent-level status.

### Requirement: Health Check
**Reason**: Replaced by clawling's `GET /health`.
**Migration**: Same endpoint, different implementation.

### Requirement: CORS Support
**Reason**: Replaced by clawling's Hono CORS middleware.
**Migration**: Identical behavior, configured in clawling.

### Requirement: SSE Streaming Endpoint
**Reason**: Replaced by clawling's `POST /v1/chat` with SSE streaming. Event format changes from custom (`event: text`, `event: done`) to OpenAI-compatible (`data: {"type": "text_delta"}`, `data: {"type": "done"}`).
**Migration**: Update `AIAssistant.tsx` SSE parser to handle new event format.

### Requirement: Agent Shift
**Reason**: Replaced by clawling's `POST /v1/wake/:agent` endpoint triggering the worker agent with the `/shift` skill. Shift CRM lifecycle (create record, update progress, mark complete) moves to Agent SDK hooks.
**Migration**: Frontend shift trigger → `POST /v1/wake/worker` with `{"prompt": "/shift"}`. CRM polling unchanged.

### Requirement: Two-Layer AI Architecture
**Reason**: Replaced by clawling's multi-level delegation. Frontend AI and Worker AI become two agent definitions in `config.json`. Delegation uses clawling's `spawn/track/announce` primitives instead of custom asyncio futures.
**Migration**: Same architectural pattern, different implementation.

### Requirement: Direct API Frontend AI
**Reason**: The Frontend AI becomes an agent definition in clawling with a direct Bedrock SDK backend (lightweight, no Agent SDK overhead). Tool definitions (delegate_to_worker, page_action) become part of the agent config.
**Migration**: System prompt and tool schemas move to config/skill files.

### Requirement: Worker AI Unchanged
**Reason**: The Worker AI becomes an agent definition in clawling using the Claude SDK backend. CLAUDE.md and skills mount into the workspace directory.
**Migration**: Same agent behavior, different orchestration layer.

### Requirement: SSE Streaming (Non-Blocking)
**Reason**: Replaced by clawling's SSE streaming with delegation events.
**Migration**: `worker_task_id` in done event → `delegation` event type. Polling endpoint changes from `/worker/status` to `/v1/status/:taskId`.

### Requirement: Worker Status Endpoint
**Reason**: Replaced by clawling's `GET /v1/status/:taskId`.
**Migration**: Same polling pattern, different URL and response shape.
