## ADDED Requirements

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
