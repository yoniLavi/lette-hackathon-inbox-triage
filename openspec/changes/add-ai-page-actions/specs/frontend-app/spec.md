## MODIFIED Requirements

### Requirement: Live Chat Widget
The frontend SHALL include a floating chat widget that sends messages to the agent API via SSE streaming and displays real responses with live progress updates. Each message SHALL include structured page context containing actual on-screen data so the AI can answer questions without CRM lookups. The widget SHALL execute UI actions (scrollTo, expand) returned by the AI and apply a visual highlight to targeted elements.

#### Scenario: Send a message to the agent
- **WHEN** a user types a message in the chat widget and presses send
- **THEN** the widget sends `POST /prompt/stream` to the agent API with the message and structured page context
- **AND** displays a loading indicator with live status text (tool names, "Thinking...", etc.)
- **AND** renders the agent's markdown response when the `done` event arrives

#### Scenario: Page context on dashboard
- **WHEN** the user sends a message from the dashboard
- **THEN** the context includes: case count, top cases with names, action status, descriptions, pending task names, and draft subjects; stats (pending tasks, drafts to review, resolved cases)

#### Scenario: Page context on situation detail
- **WHEN** the user sends a message from a situation detail page
- **THEN** the context includes: full case details (name, priority, status, description), property info (name, manager, manager_email), full email list (id, subject, from/to, body text, date, status, thread structure), draft details (id, subject, to, full body), task details (name, status, priority, description, due date), note contents, and contact details (name, type, email, company)

#### Scenario: Page context on search
- **WHEN** the user sends a message from the search page
- **THEN** the context includes: query, result count, top results with subject, sender, date, body snippet (first 200 chars), and case_id if linked

#### Scenario: Page context on properties
- **WHEN** the user sends a message from the properties page
- **THEN** the context includes: properties with name, type, units, manager, manager_email, description, case count, and contact count

#### Scenario: Context-aware responses
- **WHEN** the user asks about data already visible on screen (e.g. "what's the status of this case?" or "what do you think of this draft?")
- **THEN** the AI answers from the provided page context without making CRM tool calls
- **AND** the response arrives within 3 seconds

#### Scenario: AI scrollTo action
- **WHEN** the AI response includes a scrollTo action targeting a page element
- **THEN** the widget scrolls the element into view using `scrollIntoView`
- **AND** applies a temporary CSS highlight effect (prominent border/glow) to the element
- **AND** the highlight fades after approximately 2 seconds

#### Scenario: AI expand action
- **WHEN** the AI response includes an expand action targeting a collapsed thread group
- **THEN** the widget expands the targeted thread group to show all emails
- **AND** scrolls the expanded thread into view

#### Scenario: AI action targets
- **WHEN** the situation detail page renders emails, threads, tasks, drafts, and notes
- **THEN** each element has a `data-ai-target` attribute with format `{type}-{id}` (e.g. `email-42`, `thread-abc`, `task-7`, `draft-15`, `note-3`)
- **AND** the AIAssistant can locate these elements to execute scrollTo and expand actions

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
