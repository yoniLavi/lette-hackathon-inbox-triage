## MODIFIED Requirements
### Requirement: Live Chat Widget
The frontend SHALL include a floating chat widget that sends messages to the agent API via SSE streaming and displays real responses with live progress updates. Each message SHALL include structured page context containing actual on-screen data so the AI can answer questions without CRM lookups.

#### Scenario: Send a message to the agent
- **WHEN** a user types a message in the chat widget and presses send
- **THEN** the widget sends `POST /prompt/stream` to the agent API with the message and structured page context
- **AND** displays a loading indicator with live status text (tool names, "Thinking...", etc.)
- **AND** renders the agent's markdown response when the `done` event arrives

#### Scenario: Page context on dashboard
- **WHEN** the user sends a message from the dashboard
- **THEN** the context includes: case count, top cases with names and action status, stats (pending tasks, drafts to review, resolved cases)

#### Scenario: Page context on situation detail
- **WHEN** the user sends a message from a situation detail page
- **THEN** the context includes: full case details (name, priority, status, description), property name, task names and statuses, draft count, and related contact names with types

#### Scenario: Context-aware responses
- **WHEN** the user asks about data already visible on screen (e.g. "what's the status of this case?")
- **THEN** the AI answers from the provided page context without making CRM tool calls
- **AND** the response arrives within 3 seconds

#### Scenario: Non-blocking CRM delegation
- **WHEN** the Frontend AI delegates CRM work to the Worker
- **THEN** the widget shows the Frontend AI's acknowledgment and re-enables the input immediately
- **AND** shows a "Searching CRM..." indicator while the worker runs in the background
- **AND** the user can send new messages to the Frontend AI during this time
- **AND** the Worker's result appears as a new assistant message when it arrives (via polling `GET /worker/status`)

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
