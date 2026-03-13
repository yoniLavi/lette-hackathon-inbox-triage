## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: CRM Data Types
The frontend SHALL define TypeScript types that accurately reflect the CRM API's data model, in a module named `crm.ts`.

#### Scenario: Type coverage
- **WHEN** frontend code imports CRM types
- **THEN** types are available for all CRM entities: Property, Contact, Email, Task, Case, Note, Thread, and Shift
- **AND** each type includes all fields returned by the CRM API (including `manager_email` on Property, `is_important` on Email, all Thread fields, all Shift fields)

#### Scenario: Include response typing
- **WHEN** a fetch function uses `?include=` parameters
- **THEN** the response type reflects the included nested data (e.g., `emails: CrmEmail[]`, `contact: CrmContact | null`, `property: CrmProperty | null`, `case: CrmCase | null`)
