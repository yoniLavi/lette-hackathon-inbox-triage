## ADDED Requirements

### Requirement: Shift Entity
The CRM API SHALL maintain Shifts as a first-class entity tracking each batch processing session's lifecycle, metrics, and outcome.

#### Scenario: Create a shift record
- **WHEN** a client sends `POST /api/shifts` with `{"status": "in_progress"}`
- **THEN** the API creates a Shift record with `started_at` set to the current timestamp
- **AND** returns it with status 201

#### Scenario: Shift fields
- **WHEN** a Shift record exists
- **THEN** it includes: `id`, `started_at`, `completed_at` (nullable), `status` (in_progress | completed | failed), `threads_processed` (default 0), `emails_processed` (default 0), `drafts_created` (default 0), `tasks_created` (default 0), `summary` (nullable text), `case_id` (nullable FK to Cases)

#### Scenario: Update shift on completion
- **WHEN** a client sends `PATCH /api/shifts/{id}` with metrics and summary
- **THEN** the API updates the Shift record with the provided fields

#### Scenario: List shifts
- **WHEN** a client sends `GET /api/shifts?order_by=started_at&order=desc`
- **THEN** the API returns `{"list": [...], "total": N}` with shifts in reverse chronological order

#### Scenario: Get shift with journal case
- **WHEN** a client sends `GET /api/shifts/{id}?include=case`
- **THEN** the response includes the Shift record plus a nested `case` object with its notes (the per-thread journal entries)
