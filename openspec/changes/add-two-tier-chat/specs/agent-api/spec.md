## ADDED Requirements

### Requirement: Two-Layer AI Architecture
The agent SHALL run two persistent Claude Code SDK sessions: a Frontend AI (user-facing, smart model with MCP delegation tools) and a Worker AI (CRM agent with crm CLI access). The Frontend AI SHALL never block on CRM operations.

#### Scenario: Frontend AI responds instantly from page context
- **WHEN** a user asks about data already in the page context (e.g., "what's the status of this case?")
- **THEN** the Frontend AI answers directly from context within 3 seconds
- **AND** no delegation to the Worker occurs

#### Scenario: Frontend AI delegates CRM work
- **WHEN** a user asks a question requiring CRM data not in the page context
- **THEN** the Frontend AI calls `delegate_to_worker(prompt)` which returns a task ID immediately
- **AND** the Frontend AI sends a brief acknowledgment to the user (e.g., "Let me check the CRM for that.")
- **AND** the Frontend AI calls `get_worker_result(task_id)` to retrieve the result
- **AND** the worker's CRM results are streamed back to the user

#### Scenario: General conversation
- **WHEN** a user asks a conversational question (e.g., "what can you help me with?")
- **THEN** the Frontend AI responds directly within 3 seconds with no delegation

### Requirement: Delegation MCP Server
A lightweight MCP server SHALL run in the agent container, providing two tools to the Frontend AI for async worker delegation.

#### Scenario: delegate_to_worker
- **WHEN** the Frontend AI calls `delegate_to_worker(prompt)`
- **THEN** the MCP server queues the prompt for the Worker AI
- **AND** returns a task ID immediately (non-blocking)

#### Scenario: get_worker_result
- **WHEN** the Frontend AI calls `get_worker_result(task_id)`
- **THEN** the MCP server returns the Worker AI's response text if complete
- **OR** returns a "still working" status if the Worker is still processing

### Requirement: Worker AI Unchanged
The Worker AI SHALL be the existing Claude Code SDK session with crm CLI access, CLAUDE.md domain knowledge, and shift skills. It receives plain-text prompts from the Frontend AI via the delegation MCP.

#### Scenario: Worker receives delegated prompt
- **WHEN** a prompt is delegated via `delegate_to_worker`
- **THEN** the Worker AI processes it using its existing CRM tools and CLAUDE.md instructions
- **AND** the response is stored and made available via `get_worker_result`

### Requirement: SSE Streaming
The `/prompt/stream` endpoint SHALL stream SSE events showing Frontend AI text, delegation status, and Worker results as they arrive.

#### Scenario: Two-phase streaming
- **WHEN** the Frontend AI delegates to the Worker
- **THEN** the SSE stream first emits the Frontend AI's acknowledgment as a `text` event
- **AND** emits `tool_use` events as the Worker calls CRM tools
- **AND** emits the Worker's final response as a `text` event
- **AND** emits a `done` event with the complete response
