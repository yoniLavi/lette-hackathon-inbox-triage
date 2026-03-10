# crm-api Specification

## Purpose
FastAPI + PostgreSQL CRM service providing REST endpoints for managing PropTech entities (Properties, Contacts, Emails, Tasks, Cases, Notes, Threads) with full-text search, filtering, and composite data loading.

## Requirements

### Requirement: CRM Entity CRUD
The CRM API SHALL expose REST endpoints for managing Properties, Contacts, Emails, Tasks, Cases, Notes, and Threads with consistent JSON responses, filtering, ordering, and pagination.

#### Scenario: List entities with filters
- **WHEN** a client sends `GET /api/emails?status=archived&is_read=false&limit=10&order_by=date_sent&order=asc`
- **THEN** the API returns `{"list": [...], "total": N}` with matching emails

#### Scenario: Get entity by ID
- **WHEN** a client sends `GET /api/emails/42`
- **THEN** the API returns the full email record as JSON

#### Scenario: Create entity
- **WHEN** a client sends `POST /api/emails` with a JSON body
- **THEN** the API creates the record and returns it with status 201

#### Scenario: Update entity
- **WHEN** a client sends `PATCH /api/emails/42` with partial JSON
- **THEN** the API updates only the provided fields and returns the updated record

#### Scenario: Delete entity
- **WHEN** a client sends `DELETE /api/emails/42`
- **THEN** the API deletes the record and returns `{"deleted": true}`

#### Scenario: Full-text search on emails
- **WHEN** a client sends `GET /api/emails?search=water+leak`
- **THEN** the API returns emails matching the search terms in subject or body via PostgreSQL full-text search

#### Scenario: Dashboard counts
- **WHEN** a client sends `GET /api/counts`
- **THEN** the API returns `{"emails": N, "open_tasks": N, "closed_cases": N}`

### Requirement: Thread Entity
The CRM API SHALL maintain Threads as a first-class entity, automatically derived from email `thread_id` values. A Thread aggregates related emails into a conversation view.

#### Scenario: Thread auto-creation
- **WHEN** an email is created with a `thread_id` that does not yet have a Thread record
- **THEN** the API creates a Thread with subject from the email, `email_count=1`, `is_read=false`

#### Scenario: Thread auto-update
- **WHEN** an email is created or updated with a `thread_id` that already has a Thread record
- **THEN** the API recomputes the Thread's `last_activity_at`, `email_count`, and `is_read` from its emails

#### Scenario: Thread is_read semantics
- **WHEN** all emails in a thread have `is_read=true`
- **THEN** the Thread's `is_read` SHALL be `true`
- **AND** if any email in the thread has `is_read=false`, the Thread's `is_read` SHALL be `false`

#### Scenario: List threads
- **WHEN** a client sends `GET /api/threads?is_read=false&order_by=last_activity_at&order=asc`
- **THEN** the API returns threads matching the filters with `{"list": [...], "total": N}`

#### Scenario: Get thread by ID
- **WHEN** a client sends `GET /api/threads/42`
- **THEN** the API returns the thread record including its computed fields

### Requirement: Include Parameter
The CRM API SHALL support a `?include=` query parameter on GET endpoints that returns related records nested in the response, reducing round-trips for composite data needs.

#### Scenario: Case with related records
- **WHEN** a client sends `GET /api/cases/14?include=emails,tasks,notes,property`
- **THEN** the response includes the case record plus nested `emails`, `tasks`, `notes` arrays and a `property` object

#### Scenario: Thread with emails and contact
- **WHEN** a client sends `GET /api/threads/42?include=emails,contact`
- **THEN** the response includes the thread record plus nested `emails` array (ordered by `thread_position`) and a `contact` object resolved from the latest email's `from_address`

#### Scenario: Email with contact
- **WHEN** a client sends `GET /api/emails/42?include=contact`
- **THEN** the response includes the email record plus a nested `contact` object resolved by matching `from_address` to a contact's `email` field

#### Scenario: Unknown include ignored
- **WHEN** a client sends `GET /api/cases/14?include=nonexistent`
- **THEN** the API returns the case record normally, ignoring the unknown include

### Requirement: Shift Work-Item Endpoint
The CRM API SHALL expose endpoints that provide pre-assembled work items for the agent's shift processing, returning the next unread thread with full case context in a single call.

#### Scenario: Fetch next work item
- **WHEN** a client sends `GET /api/shift/next`
- **THEN** the API returns the oldest unread thread with all its emails, the resolved sender contact, and if the thread is linked to a case, the case with all its tasks, notes, and property

#### Scenario: No unread threads
- **WHEN** a client sends `GET /api/shift/next` and all threads are read
- **THEN** the API returns `{"thread": null, "case": null}`

#### Scenario: Complete a work item
- **WHEN** a client sends `POST /api/shift/complete` with `{"thread_id": "thread_042", "email_ids": [1,2,3], "case_id": 14}`
- **THEN** the API marks the specified emails as read, links the thread to the case, and recomputes thread `is_read`

### Requirement: Batch Email Operations
The CRM API SHALL support batch updates to emails, reducing the number of API calls needed when processing multiple emails in a thread.

#### Scenario: Bulk update emails
- **WHEN** a client sends `PATCH /api/emails/bulk` with `{"ids": [1,2,3], "updates": {"is_read": true}}`
- **THEN** the API updates all specified emails and returns `{"updated": 3}`

#### Scenario: Empty or missing fields
- **WHEN** a client sends `PATCH /api/emails/bulk` with empty `ids` or `updates`
- **THEN** the API returns `400 Bad Request`

### Requirement: Property Manager Email
The Property model SHALL include a `manager_email` field so the agent can use the correct sender address when drafting replies for a property.

#### Scenario: Property with manager email
- **WHEN** a client sends `GET /api/properties/1`
- **THEN** the response includes `manager_email` alongside existing fields
