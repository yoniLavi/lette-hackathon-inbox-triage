# frontend-app Specification

## Purpose
TBD - created by archiving change add-frontend-container. Update Purpose after archive.
## Requirements
### Requirement: Frontend Container
The frontend SHALL be containerized as a Next.js standalone build, served via `next start` inside Docker.

#### Scenario: Production build in Docker
- **WHEN** the `frontend` service is built via `docker compose build frontend`
- **THEN** the Next.js app is built with `output: "standalone"`
- **AND** the resulting image serves the app on port 3000

#### Scenario: Environment configuration
- **WHEN** the frontend container starts
- **THEN** it reads `NEXT_PUBLIC_AGENT_URL` for client-side agent API calls
- **AND** it reads `ESPOCRM_URL` and `ESPOCRM_API_KEY` for server-side CRM data fetching

### Requirement: CRM Data Layer
The frontend SHALL fetch data from EspoCRM's REST API on the server side, using Next.js server components and API routes.

#### Scenario: Fetch cases for dashboard
- **WHEN** the dashboard page loads
- **THEN** the server fetches Cases from EspoCRM ordered by priority and updated date
- **AND** renders them as situation cards grouped by urgency tier

#### Scenario: Fetch case detail
- **WHEN** a user navigates to `/situations/[id]`
- **THEN** the server fetches the Case by ID along with its linked Emails, Tasks, and Account
- **AND** displays the AI summary, communications timeline, recommended actions, and any draft replies

#### Scenario: Fetch accounts for properties page
- **WHEN** the properties page loads
- **THEN** the server fetches Accounts from EspoCRM with counts of linked Cases and Emails

#### Scenario: Activity stream from emails
- **WHEN** the dashboard page loads
- **THEN** the activity stream shows the most recent Emails from CRM, ordered by date

#### Scenario: Live stats
- **WHEN** the dashboard page loads
- **THEN** QuickStats shows live counts: total emails today, open tasks, and closed cases

### Requirement: Simplified Situation Detail
The situation detail page SHALL display CRM-backed data without hardcoded rich content that has no CRM backing.

#### Scenario: CRM-backed content only
- **WHEN** a situation detail page renders
- **THEN** it shows: Case name, priority badge, AI summary (from Case description), linked Emails as a timeline, linked Tasks as recommended actions, and any draft Email as a response template
- **AND** it does NOT show hardcoded financial exposure breakdowns, urgency rationale boxes, or tag pills

### Requirement: Simplified Properties Page
The properties page SHALL display Accounts from EspoCRM with aggregate counts, without fabricated property statistics.

#### Scenario: Account-based property view
- **WHEN** the properties page loads
- **THEN** each property card shows the Account name and counts of linked Cases and Emails
- **AND** does NOT show fabricated unit counts, occupancy rates, or response time stats

### Requirement: Live Chat Widget
The frontend SHALL include a floating chat widget that sends messages to the agent API via SSE streaming and displays real responses with live progress updates.

#### Scenario: Send a message to the agent
- **WHEN** a user types a message in the chat widget and presses send
- **THEN** the widget sends `POST /prompt/stream` to the agent API with the message
- **AND** displays a loading indicator with live status text (tool names, "Thinking...", etc.)
- **AND** renders the agent's markdown response when the `done` event arrives

#### Scenario: Live tool updates
- **WHEN** the agent uses MCP tools during processing
- **THEN** the widget displays the tool name in the status indicator as each `tool_use` SSE event arrives
- **AND** updates are visible within seconds of the tool being invoked (no long "Thinking..." gaps)

#### Scenario: Agent is busy
- **WHEN** a user sends a message while the agent is already processing another request
- **THEN** the agent API returns 409
- **AND** the widget automatically restarts the session and retries the message

#### Scenario: Network error
- **WHEN** the agent API is unreachable or returns a server error
- **THEN** the widget displays an error message
- **AND** allows the user to retry

#### Scenario: Start new chat
- **WHEN** the user clicks the "New Chat" button in the chat header
- **THEN** the widget calls `POST /session/restart` to reset the agent session
- **AND** clears the message history (except the welcome message)

#### Scenario: Markdown rendering
- **WHEN** the agent responds with markdown-formatted text (bold, lists, code blocks, etc.)
- **THEN** the widget renders the markdown as formatted HTML

#### Scenario: Message persistence
- **WHEN** the page is reloaded (e.g., via hot-reload during development)
- **THEN** previous chat messages are restored from sessionStorage

