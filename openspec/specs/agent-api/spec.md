# agent-api Specification

## Purpose
HTTP API for interacting with the PropTech email triage agent, providing persistent sessions with EspoCRM access.
## Requirements
### Requirement: Agent HTTP API
The agent container SHALL expose an HTTP API for sending prompts and managing the agent session.

#### Scenario: Send a prompt
- **WHEN** a client sends `POST /prompt` with `{"message": "List all emails"}`
- **THEN** the agent processes the prompt using EspoCRM tools
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
The agent API SHALL expose an endpoint that triggers batch processing of active emails, where the agent triages each email and takes appropriate CRM actions.

#### Scenario: Start a shift
- **WHEN** a client sends `POST /shift`
- **THEN** the agent starts a fresh session
- **AND** processes all active (unprocessed) emails in EspoCRM
- **AND** returns a structured summary of actions taken

#### Scenario: Per-email processing
- **WHEN** the agent processes an email during a shift
- **THEN** it reads the full email body and identifies the sender
- **AND** classifies the email by urgency (emergency, urgent, routine, low)
- **AND** takes one or more CRM actions: drafting a reply, updating contact/account details, or creating/updating a task

#### Scenario: Draft replies without sending
- **WHEN** the agent drafts a reply to an email
- **THEN** the reply is created in EspoCRM with status "Draft"
- **AND** the draft is never automatically sent
- **AND** the property manager can review and send it from the CRM UI

#### Scenario: Task creation for follow-up actions
- **WHEN** the agent identifies a follow-up action that requires human intervention
- **THEN** it creates a Task in EspoCRM with a description, priority, and due date
- **AND** links the task to the relevant Contact or Account

#### Scenario: Shift journal via Case
- **WHEN** the agent starts a shift
- **THEN** it creates a Case in EspoCRM (e.g., "Agent Shift — 2026-03-07 10:30") with status "In Progress"
- **AND** as it processes each email, it adds a Note to the Case summarizing the actions taken
- **AND** when the shift completes, it updates the Case status to "Closed" with a final summary

#### Scenario: Review previous shifts
- **WHEN** a property manager searches Cases in EspoCRM
- **THEN** they can find past shift Cases and browse their stream of notes to review what the agent did

#### Scenario: Reject concurrent shifts
- **WHEN** a shift is already in progress
- **AND** a second `POST /shift` arrives
- **THEN** the API returns `409 Conflict`

#### Scenario: Shift via CLI
- **WHEN** a user runs `scripts/agent.py --shift`
- **THEN** the script calls `POST /shift` and prints the summary to stdout

#### Scenario: Insight capture during shift
- **WHEN** the agent discovers an operational pattern, gotcha, or effective technique while processing emails
- **THEN** it appends the insight to `learnings.md` in its workspace
- **AND** each entry includes what was learned and why it matters for future processing

