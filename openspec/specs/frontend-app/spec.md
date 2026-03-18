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
- **AND** it reads `CRM_API_URL` for server-side CRM data fetching (default: `http://crm-api:8002`)

### Requirement: CRM Data Layer
The frontend SHALL fetch data from the CRM API on the server side, using Next.js server components and API routes via a `/api/crm` proxy.

#### Scenario: Fetch cases for dashboard work queue
- **WHEN** the dashboard page loads
- **THEN** the server fetches Cases from the CRM API ordered by priority and updated date, with `?include=property`
- **AND** for each case, fetches linked task and draft email counts to derive action status
- **AND** renders them as a work queue with action-oriented status badges

#### Scenario: Fetch case detail
- **WHEN** a user navigates to `/situations/[id]`
- **THEN** the server fetches the Case by ID with `?include=emails,tasks,notes,property`
- **AND** displays recommended actions (tasks) and draft responses first, then AI summary and communications as supporting context

#### Scenario: Full-text email search
- **WHEN** a user enters a query on the search page
- **THEN** the frontend calls `GET /api/emails?search={query}` with `?include=contact`
- **AND** displays matching emails with subject, sender contact info, date, and body snippet

#### Scenario: Live stats
- **WHEN** the dashboard page loads
- **THEN** QuickStats shows work-centric counts: pending tasks (not completed), drafts to review (emails with status "draft"), and resolved cases (status "closed")

### Requirement: Simplified Situation Detail
The situation detail page SHALL display CRM-backed data in a task-first layout, leading with actionable items and using communications as supporting context.

#### Scenario: Task-first content hierarchy
- **WHEN** a situation detail page renders
- **THEN** it shows in order: Case name and priority badge, AI summary (from Case description), recommended actions (Tasks) with completion status, draft responses for review/sending, then communications timeline grouped by thread as expandable context
- **AND** it does NOT show hardcoded financial exposure breakdowns, urgency rationale boxes, or tag pills

#### Scenario: Agent notes display
- **WHEN** a case has linked Notes
- **THEN** they are displayed in a dedicated section on the right panel showing note content and timestamp
- **AND** ordered chronologically (oldest first)

#### Scenario: Related contacts display
- **WHEN** a case has emails from known Contacts
- **THEN** a "Related Contacts" section on the right panel shows each contact's name and type badge (tenant, landlord, contractor, etc.), grouped by contact type

### Requirement: Simplified Properties Page
The properties page SHALL display Properties from the CRM API with aggregate context.

#### Scenario: Property cards with context
- **WHEN** the properties page loads
- **THEN** each property card shows the property name, type, units, manager name, and counts of linked Cases and Contacts
- **AND** does NOT show fabricated occupancy rates or response time stats

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

### Requirement: CRM Data Types
The frontend SHALL define TypeScript types that accurately reflect the CRM API's data model, in a module named `crm.ts`.

#### Scenario: Type coverage
- **WHEN** frontend code imports CRM types
- **THEN** types are available for all CRM entities: Property, Contact, Email, Task, Case, Note, Thread, and Shift
- **AND** each type includes all fields returned by the CRM API (including `manager_email` on Property, `is_important` on Email, all Thread fields, all Shift fields)

#### Scenario: Include response typing
- **WHEN** a fetch function uses `?include=` parameters
- **THEN** the response type reflects the included nested data (e.g., `emails: CrmEmail[]`, `contact: CrmContact | null`, `property: CrmProperty | null`, `case: CrmCase | null`)

### Requirement: Contact Resolution
The frontend SHALL resolve email senders to Contact records and display contact name and type instead of raw email addresses.

#### Scenario: Contact on email/thread display
- **WHEN** an email or thread is displayed anywhere in the UI
- **THEN** the sender's full name (`first_name last_name`) and contact type are shown
- **AND** the contact type is rendered as a colored badge (tenant, landlord, contractor, prospect, internal, legal)

#### Scenario: Unknown contact fallback
- **WHEN** an email's `from_address` does not match any Contact in the CRM
- **THEN** the frontend falls back to displaying the raw email address

### Requirement: Action-Oriented Case Status
SituationCards on the dashboard SHALL display an action-oriented status text derived from the case's linked tasks and emails, providing at-a-glance next-action context.

#### Scenario: Draft ready for review
- **WHEN** a case has at least one email with `status: "draft"`
- **THEN** the SituationCard shows "Draft ready" as the action status

#### Scenario: Needs triage
- **WHEN** a case has no tasks and no draft emails
- **THEN** the SituationCard shows "Needs triage" as the action status

#### Scenario: Tasks pending
- **WHEN** a case has tasks with `status != "completed"` and no draft emails
- **THEN** the SituationCard shows the count of pending tasks (e.g. "3 actions pending")

### Requirement: Work-Centric Dashboard
The dashboard SHALL present a work-item-focused view oriented around case review, rather than raw email display. The human user reviews AI-triaged work — they do not process raw emails.

#### Scenario: Work queue replaces email feed
- **WHEN** the dashboard loads
- **THEN** the center column shows a work queue of all open cases with action status, ordered by priority then recency
- **AND** does NOT show a flat list of recent emails

#### Scenario: Work-centric stats
- **WHEN** the dashboard loads
- **THEN** QuickStats shows: count of pending tasks, count of draft responses awaiting review, and count of resolved (closed) cases
- **AND** does NOT show total email count as a primary metric

### Requirement: Shifts Page
The frontend SHALL include a `/shifts` page that gives operators full visibility into the AI's batch email processing — past shifts, current backlog, and the ability to trigger and monitor new shifts.

#### Scenario: Shift history list
- **WHEN** the shifts page loads
- **THEN** it displays a reverse-chronological list of all past shifts fetched from `GET /api/shifts?order_by=started_at&order=desc`
- **AND** each shift shows: started_at timestamp, duration (started_at → completed_at), status badge, threads/emails processed counts, and a summary snippet

#### Scenario: Expand shift details
- **WHEN** the operator clicks on a shift in the history list
- **THEN** it expands to show the full summary text, detailed metrics (drafts created, tasks created), and a link to the shift's journal Case (situation detail page)

#### Scenario: Incoming email backlog
- **WHEN** the shifts page loads
- **THEN** it shows the count of unread threads (the backlog that the next shift would process)
- **AND** lists unread thread subjects with sender info as a preview

#### Scenario: Trigger a new shift
- **WHEN** the operator clicks "Start Shift"
- **THEN** the frontend calls `POST /shift` on the agent API
- **AND** receives a `shift_id` in the response
- **AND** the button becomes disabled with a "Shift running..." state

#### Scenario: Follow shift progress
- **WHEN** a shift is running (triggered from UI or detected as in_progress on page load)
- **THEN** the frontend polls `GET /api/shifts/{id}` every 3 seconds
- **AND** displays the current status and any updated metrics
- **AND** when the shift completes, refreshes the history list and backlog count

#### Scenario: Shift already running on page load
- **WHEN** the shifts page loads and there is a shift with status "in_progress"
- **THEN** the page shows the active shift's progress indicator
- **AND** the "Start Shift" button is disabled
- **AND** polling begins automatically

#### Scenario: No shifts yet
- **WHEN** the shifts page loads and no shifts exist
- **THEN** it shows an empty state encouraging the operator to start their first shift

#### Scenario: Navigation
- **WHEN** the shifts page is available
- **THEN** it is accessible from the main navigation as "Shifts"

