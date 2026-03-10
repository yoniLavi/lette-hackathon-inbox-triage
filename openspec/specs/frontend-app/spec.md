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
The frontend SHALL include a floating chat widget that sends messages to the agent API via SSE streaming and displays real responses with live progress updates.

#### Scenario: Send a message to the agent
- **WHEN** a user types a message in the chat widget and presses send
- **THEN** the widget sends `POST /prompt/stream` to the agent API with the message
- **AND** displays a loading indicator with live status text (tool names, "Thinking...", etc.)
- **AND** renders the agent's markdown response when the `done` event arrives

#### Scenario: Live tool updates
- **WHEN** the agent uses tools during processing
- **THEN** the widget displays the tool name in the status indicator as each `tool_use` SSE event arrives
- **AND** updates are visible within seconds of the tool being invoked

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

### Requirement: CRM Data Types
The frontend SHALL define TypeScript types that accurately reflect the CRM API's data model, in a module named `crm.ts`.

#### Scenario: Type coverage
- **WHEN** frontend code imports CRM types
- **THEN** types are available for all CRM entities: Property, Contact, Email, Task, Case, Note, and Thread
- **AND** each type includes all fields returned by the CRM API (including `manager_email` on Property, `is_important` on Email, all Thread fields)

#### Scenario: Include response typing
- **WHEN** a fetch function uses `?include=` parameters
- **THEN** the response type reflects the included nested data (e.g., `emails: CrmEmail[]`, `contact: CrmContact | null`, `property: CrmProperty | null`)

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

