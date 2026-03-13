## MODIFIED Requirements

### Requirement: Two-Layer AI Architecture
The agent SHALL run two AI sessions: a Frontend AI (direct Anthropic/Bedrock API, user-facing, with delegation and page action tools) and a Worker AI (Claude Code SDK session with crm CLI access). The Frontend AI SHALL never block on CRM operations. The Frontend AI MAY return at most one UI action per response to control page elements.

#### Scenario: Frontend AI responds instantly from page context
- **WHEN** a user asks about data already in the page context (e.g., "what's the status of this case?" or "what do you think of this draft?")
- **THEN** the Frontend AI answers directly from context within 3 seconds
- **AND** no delegation to the Worker occurs

#### Scenario: Frontend AI delegates CRM work (non-blocking)
- **WHEN** a user asks a question requiring CRM data not in the page context
- **THEN** the Frontend AI calls `delegate_to_worker(prompt)` which spawns a background worker task
- **AND** the Frontend AI sends a brief acknowledgment to the user (e.g., "Checking the CRM...")
- **AND** the SSE stream closes immediately — the user can continue chatting
- **AND** the worker result is delivered via `GET /worker/status` polling
- **AND** the worker result is injected into conversation history for follow-up context

#### Scenario: Frontend AI triggers page action
- **WHEN** the user asks to find, show, or focus on a specific element (e.g., "show me the draft" or "find the email about the leak")
- **THEN** the Frontend AI calls `page_action` with the appropriate action type and target
- **AND** the action is emitted as an `event: action` SSE event before the `done` event
- **AND** the Frontend AI's text response acknowledges the action naturally (e.g., "Here's the draft — ..." rather than "I'm using page_action to scroll to...")

#### Scenario: At most one action per turn
- **WHEN** the Frontend AI processes a user message
- **THEN** it calls `page_action` at most once per turn
- **AND** may combine the action with a text response but not with a delegation

#### Scenario: User chats during worker execution
- **WHEN** a worker task is running in the background
- **THEN** the user can send new messages to the Frontend AI
- **AND** the Frontend AI responds from context or conversation history
- **AND** if the user requests another delegation, it fails gracefully ("Worker is busy")

#### Scenario: General conversation
- **WHEN** a user asks a conversational question (e.g., "what can you help me with?")
- **THEN** the Frontend AI responds directly within 3 seconds with no delegation

### Requirement: SSE Streaming (Non-Blocking)
The `/prompt/stream` endpoint SHALL stream SSE events for the Frontend AI response only, then close immediately. Worker results are delivered separately via polling. UI actions are delivered as `event: action` SSE events.

#### Scenario: Stream with action event
- **WHEN** the Frontend AI returns a page action
- **THEN** the SSE stream emits `event: action` with `{"action": "scrollTo"|"expand", "target": {"type": "...", "id": "..."}}`
- **AND** emits the `done` event with the text response
- **AND** the stream closes

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
