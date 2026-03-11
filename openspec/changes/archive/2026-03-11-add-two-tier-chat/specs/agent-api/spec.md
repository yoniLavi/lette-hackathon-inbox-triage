## ADDED Requirements

### Requirement: Two-Layer AI Architecture
The agent SHALL run two AI sessions: a Frontend AI (direct Anthropic/Bedrock API, user-facing, with delegation tools) and a Worker AI (Claude Code SDK session with crm CLI access). The Frontend AI SHALL never block on CRM operations.

#### Scenario: Frontend AI responds instantly from page context
- **WHEN** a user asks about data already in the page context (e.g., "what's the status of this case?")
- **THEN** the Frontend AI answers directly from context within 3 seconds
- **AND** no delegation to the Worker occurs

#### Scenario: Frontend AI delegates CRM work (non-blocking)
- **WHEN** a user asks a question requiring CRM data not in the page context
- **THEN** the Frontend AI calls `delegate_to_worker(prompt)` which spawns a background worker task
- **AND** the Frontend AI sends a brief acknowledgment to the user (e.g., "Checking the CRM...")
- **AND** the SSE stream closes immediately — the user can continue chatting
- **AND** the worker result is delivered via `GET /worker/status` polling
- **AND** the worker result is injected into conversation history for follow-up context

#### Scenario: User chats during worker execution
- **WHEN** a worker task is running in the background
- **THEN** the user can send new messages to the Frontend AI
- **AND** the Frontend AI responds from context or conversation history
- **AND** if the user requests another delegation, it fails gracefully ("Worker is busy")

#### Scenario: General conversation
- **WHEN** a user asks a conversational question (e.g., "what can you help me with?")
- **THEN** the Frontend AI responds directly within 3 seconds with no delegation

### Requirement: Direct API Frontend AI
The Frontend AI SHALL call the Anthropic/Bedrock Messages API directly via the `anthropic` Python SDK, bypassing the Claude Code CLI subprocess. It SHALL maintain conversation history in-process and define delegation tools as native tool definitions.

#### Scenario: No CLI subprocess overhead
- **WHEN** a user sends a message that can be answered from page context
- **THEN** the response is generated via a single Messages API call with no subprocess spawn
- **AND** the total response time is under 3 seconds

#### Scenario: Conversation history preserved
- **WHEN** a user sends a follow-up message in the same session
- **THEN** the Frontend AI has access to all previous messages in the conversation
- **AND** can reference earlier context without re-sending page data

#### Scenario: Tool execution handled in-process
- **WHEN** the Frontend AI returns a tool_use block for delegate_to_worker
- **THEN** the tool is executed in-process by the agent API (not by an external MCP server)
- **AND** the tool result is sent back in a subsequent Messages API call

### Requirement: Worker AI Unchanged
The Worker AI SHALL be the existing Claude Code SDK session with crm CLI access, CLAUDE.md domain knowledge, and shift skills. It receives plain-text prompts from the Frontend AI via the delegation tools.

#### Scenario: Worker receives delegated prompt
- **WHEN** a prompt is delegated via `delegate_to_worker`
- **THEN** the Worker AI processes it using its existing CRM tools and CLAUDE.md instructions
- **AND** the response is stored and made available via `GET /worker/status` polling

### Requirement: SSE Streaming (Non-Blocking)
The `/prompt/stream` endpoint SHALL stream SSE events for the Frontend AI response only, then close immediately. Worker results are delivered separately via polling.

#### Scenario: Stream closes after acknowledgment
- **WHEN** the Frontend AI delegates to the Worker
- **THEN** the SSE stream emits the Frontend AI's acknowledgment as a `text` event
- **AND** emits a `done` event with `worker_task_id` in the payload
- **AND** the stream closes — input re-enables immediately

#### Scenario: Worker result polling
- **WHEN** a `done` event includes `worker_task_id`
- **THEN** the client polls `GET /worker/status` every 2 seconds
- **AND** when `result` is non-null, it is displayed as a new assistant message
- **AND** the "Searching CRM..." indicator clears

### Requirement: Worker Status Endpoint
The `GET /worker/status` endpoint SHALL return the current state of background worker tasks.

#### Scenario: Worker running
- **WHEN** a worker task is in progress
- **THEN** the endpoint returns `{busy: true, result: null, task_id: "..."}`

#### Scenario: Worker complete
- **WHEN** a worker task has finished
- **THEN** the endpoint returns `{busy: false, result: "...", task_id: "..."}`
- **AND** the result is cleared after being consumed (one-time read)
