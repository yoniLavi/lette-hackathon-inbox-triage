## ADDED Requirements

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
The agent SHALL maintain a single persistent session that accumulates context across prompts, with the ability to restart with fresh context.

#### Scenario: Context continuity
- **WHEN** a client sends a prompt mentioning "the email from John"
- **AND** a previous prompt in the same session listed emails including one from John
- **THEN** the agent uses the accumulated context to understand the reference

#### Scenario: Session restart
- **WHEN** a client sends `POST /session/restart`
- **THEN** the current session is terminated
- **AND** a new empty session is created
- **AND** subsequent prompts start with no prior context

#### Scenario: Session status
- **WHEN** a client sends `GET /session/status`
- **THEN** the API returns whether a session is active and whether a prompt is currently being processed

### Requirement: Health Check
The agent API SHALL expose a health endpoint for Docker and monitoring.

#### Scenario: Healthy service
- **WHEN** a client sends `GET /health`
- **THEN** the API returns `200 OK`

## MODIFIED Requirements

### Requirement: Agent Container
The agent container SHALL run a persistent FastAPI server instead of one-shot CLI invocations, while keeping the EspoMCP integration and Bedrock authentication.

#### Scenario: Persistent service
- **WHEN** the agent container starts via `docker compose up`
- **THEN** the FastAPI server starts and is accessible on port 8001
- **AND** EspoMCP is available as an MCP tool via the Agent SDK

#### Scenario: Ad-hoc prompt via CLI
- **WHEN** a user runs `scripts/agent.py "List all emails"`
- **THEN** the script sends the prompt to the HTTP API
- **AND** returns the response to stdout
