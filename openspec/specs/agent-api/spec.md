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

