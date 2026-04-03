# agent-api Specification

## Purpose
HTTP API for interacting with the PropTech email triage agent, providing persistent sessions with CRM access via the `crm` CLI.
## Requirements
### Requirement: Agent HTTP API
The agent container SHALL expose an HTTP API for sending prompts and managing the agent session.

#### Scenario: Send a prompt
- **WHEN** a client sends `POST /prompt` with `{"message": "List all emails"}`
- **THEN** the agent processes the prompt using the CRM CLI
- **AND** returns `{"response": "...", "session_id": "..."}` with the agent's response

#### Scenario: Reject concurrent prompts
- **WHEN** a prompt is already being processed
- **AND** a second `POST /prompt` arrives
- **THEN** the API returns `409 Conflict`

#### Scenario: Reject prompt during shift
- **WHEN** a shift is in progress
- **AND** a `POST /prompt` arrives
- **THEN** the API returns `409 Conflict`

### Requirement: Session Management
The agent SHALL maintain a single persistent session that accumulates context across prompts, with the ability to restart with fresh context. Multi-turn conversations (multiple prompts on the same session) SHALL work reliably.

#### Scenario: Context continuity
- **WHEN** a client sends a prompt mentioning "the email from John"
- **AND** a previous prompt in the same session listed emails including one from John
- **THEN** the agent uses the accumulated context to understand the reference

#### Scenario: Multi-turn reliability
- **WHEN** a client sends a second prompt on the same session after the first prompt completes
- **THEN** the SDK produces response messages for the second prompt
- **AND** the response completes with a `done` event within a reasonable timeout

#### Scenario: Session restart
- **WHEN** a client sends `POST /session/restart`
- **THEN** the current session is terminated and `busy` flag is cleared
- **AND** a new empty session is created
- **AND** subsequent prompts start with no prior context

#### Scenario: Session status
- **WHEN** a client sends `GET /session/status`
- **THEN** the API returns whether a session is active, whether a prompt is currently being processed, and the message count

#### Scenario: Response timeout
- **WHEN** the SDK does not produce any messages within 90 seconds during `receive_response()`
- **THEN** the API tears down the client session
- **AND** emits an error event to the client
- **AND** resets the busy flag so subsequent requests can proceed

### Requirement: Health Check
The agent API SHALL expose a health endpoint for Docker and monitoring.

#### Scenario: Healthy service
- **WHEN** a client sends `GET /health`
- **THEN** the API returns `200 OK`

### Requirement: CORS Support
The agent API SHALL allow cross-origin requests from the frontend so the browser-based chat widget can call endpoints directly.

#### Scenario: Browser request from frontend
- **WHEN** the frontend at `http://localhost:3000` sends a `POST /prompt/stream` request to the agent API at `http://localhost:8001`
- **THEN** the agent API includes appropriate CORS headers in the response
- **AND** the request succeeds without being blocked by the browser

### Requirement: SSE Streaming Endpoint
The agent API SHALL expose `POST /prompt/stream` that returns a Server-Sent Events stream with granular progress events.

#### Scenario: Streaming a prompt with tool calls
- **WHEN** a client sends `POST /prompt/stream` with `{"message": "Count all emails"}`
- **THEN** the API returns `Content-Type: text/event-stream`
- **AND** emits `event: status` with `{"status": "connecting"}` immediately (before SDK initialization)
- **AND** emits `event: status` with `{"status": "thinking"}` once the SDK session is ready
- **AND** emits `event: tool_use` with `{"tool": "<name>"}` for each tool call
- **AND** emits `event: text` with `{"text": "<content>"}` for each text block
- **AND** emits `event: done` with `{"response": "<full text>"}` when complete

#### Scenario: Stream error
- **WHEN** an error occurs during streaming
- **THEN** the API emits `event: error` with `{"detail": "<message>"}`
- **AND** tears down the SDK client for recovery

### Requirement: Agent Shift
The agent API SHALL expose an endpoint that triggers batch processing of active emails, where the agent triages each thread and takes appropriate CRM actions. The endpoint SHALL be asynchronous — returning immediately with a shift identifier while processing runs in the background.

#### Scenario: Start a shift (async)
- **WHEN** a client sends `POST /shift`
- **THEN** the agent creates a Shift record in the CRM with status "in_progress"
- **AND** starts processing in the background
- **AND** returns `{"shift_id": N}` immediately

#### Scenario: Shift progress via CRM polling
- **WHEN** a shift is running in the background
- **THEN** the client polls `GET /api/shifts/{id}` on the CRM API for status
- **AND** when `status` changes to "completed" or "failed", the shift is done
- **AND** the Shift record contains final metrics and summary

#### Scenario: Per-thread processing
- **WHEN** the agent processes a thread during a shift
- **THEN** it receives the full thread with all emails, sender contact, and case context in one call via `crm shift next`
- **AND** reasons about the entire thread conversation at once
- **AND** classifies the thread by urgency (emergency, urgent, routine, low)
- **AND** takes CRM actions: drafting a reply to the latest email, creating tasks, adding notes

#### Scenario: Draft replies without sending
- **WHEN** the agent drafts a reply to a thread
- **THEN** the reply is created in the CRM with status "draft"
- **AND** the draft uses the correct `manager_email` from the thread's associated property
- **AND** the draft is never automatically sent

#### Scenario: Task creation for follow-up actions
- **WHEN** the agent identifies a follow-up action that requires human intervention
- **THEN** it creates a Task in the CRM with a description, priority, and due date
- **AND** links the task to the relevant Contact and Case

#### Scenario: Shift journal via Case
- **WHEN** the agent starts a shift
- **THEN** it creates a Case (e.g., "Agent Shift — 2026-03-09 10:30") with status "in_progress"
- **AND** links the Case to the Shift record via `case_id`
- **AND** as it processes each thread, it adds a Note to the Case summarizing the actions taken
- **AND** when the shift completes, it updates the Case status to "closed" with a final summary

#### Scenario: Shift completion updates records
- **WHEN** the agent finishes processing all available threads (or pacing limit reached)
- **THEN** it updates the Shift record with `status: "completed"`, `completed_at`, thread/email/draft/task counts, and a text summary

#### Scenario: Shift failure updates records
- **WHEN** the agent encounters an unrecoverable error during a shift
- **THEN** it updates the Shift record with `status: "failed"` and a summary describing what was processed before the failure

#### Scenario: Shift completion marks threads read
- **WHEN** the agent finishes processing a thread
- **THEN** it calls `crm shift complete` to batch-mark all emails in the thread as read

#### Scenario: Context-aware shift pacing
- **WHEN** the agent finishes processing all unread threads for the current case
- **AND** the agent estimates its context usage exceeds 50%
- **THEN** the shift stops and reports the summary for threads processed so far
- **AND** remaining unread threads are left for the next shift

#### Scenario: Always finish the current case
- **WHEN** the agent is processing threads belonging to a case
- **AND** context usage exceeds 50% mid-case
- **THEN** the agent continues processing remaining unread threads for that case before wrapping up
- **AND** does not start a new case

#### Scenario: Reject concurrent shifts
- **WHEN** a shift is already in progress
- **AND** a second `POST /shift` arrives
- **THEN** the API returns `409 Conflict`

#### Scenario: Shift via CLI
- **WHEN** a user runs `npx tsx scripts/agent.ts --shift`
- **THEN** the script calls `POST /shift`, receives the `shift_id`
- **AND** polls `GET /api/shifts/{id}` on the CRM API until complete
- **AND** prints the summary to stdout

#### Scenario: Insight capture during shift
- **WHEN** the agent discovers an operational pattern, gotcha, or effective technique while processing threads
- **THEN** it appends the insight to `learnings.md` in its workspace

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

### Requirement: Direct API Frontend AI
The Frontend AI SHALL call the Anthropic/Bedrock Messages API directly via the TypeScript `@anthropic-ai/bedrock-sdk`, bypassing the Claude Code CLI subprocess. It SHALL maintain conversation history in-process and define delegation tools as native tool definitions.

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

### Requirement: Worker Status Endpoint
The `GET /worker/status` endpoint SHALL return the current state of background worker tasks.

#### Scenario: Worker running
- **WHEN** a worker task is in progress
- **THEN** the endpoint returns `{busy: true, result: null, task_id: "..."}`

#### Scenario: Worker complete
- **WHEN** a worker task has finished
- **THEN** the endpoint returns `{busy: false, result: "...", task_id: "..."}`
- **AND** the result is cleared after being consumed (one-time read)

