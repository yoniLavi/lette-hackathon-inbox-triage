## MODIFIED Requirements

### Requirement: Agent Shift
The agent API SHALL expose an endpoint that triggers batch processing of active emails, where the agent triages each thread and takes appropriate CRM actions. The endpoint SHALL be asynchronous — returning immediately with a shift identifier while processing runs in the background.

#### Scenario: Start a shift (async)
- **WHEN** a client sends `POST /shift`
- **THEN** the agent creates a Shift record in the CRM with status "in_progress"
- **AND** starts processing in the background
- **AND** returns `{"shift_id": N}` immediately

#### Scenario: Shift progress via CRM polling
- **WHEN** a shift is running in the background
- **THEN** the client polls `GET /api/shifts/{id}` on the CRM API for status
- **AND** when `status` changes to "completed" or "failed", the shift is done
- **AND** the Shift record contains final metrics and summary

#### Scenario: Per-thread processing
- **WHEN** the agent processes a thread during a shift
- **THEN** it receives the full thread with all emails, sender contact, and case context in one call via `crm shift next`
- **AND** reasons about the entire thread conversation at once
- **AND** classifies the thread by urgency (emergency, urgent, routine, low)
- **AND** takes CRM actions: drafting a reply to the latest email, creating tasks, adding notes

#### Scenario: Draft replies without sending
- **WHEN** the agent drafts a reply to a thread
- **THEN** the reply is created in the CRM with status "draft"
- **AND** the draft uses the correct `manager_email` from the thread's associated property
- **AND** the draft is never automatically sent

#### Scenario: Task creation for follow-up actions
- **WHEN** the agent identifies a follow-up action that requires human intervention
- **THEN** it creates a Task in the CRM with a description, priority, and due date
- **AND** links the task to the relevant Contact and Case

#### Scenario: Shift journal via Case
- **WHEN** the agent starts a shift
- **THEN** it creates a Case (e.g., "Agent Shift — 2026-03-09 10:30") with status "in_progress"
- **AND** links the Case to the Shift record via `case_id`
- **AND** as it processes each thread, it adds a Note to the Case summarizing the actions taken
- **AND** when the shift completes, it updates the Case status to "closed" with a final summary

#### Scenario: Shift completion updates records
- **WHEN** the agent finishes processing all available threads (or pacing limit reached)
- **THEN** it updates the Shift record with `status: "completed"`, `completed_at`, thread/email/draft/task counts, and a text summary

#### Scenario: Shift failure updates records
- **WHEN** the agent encounters an unrecoverable error during a shift
- **THEN** it updates the Shift record with `status: "failed"` and a summary describing what was processed before the failure

#### Scenario: Shift completion marks threads read
- **WHEN** the agent finishes processing a thread
- **THEN** it calls `crm shift complete` to batch-mark all emails in the thread as read

#### Scenario: Context-aware shift pacing
- **WHEN** the agent finishes processing all unread threads for the current case
- **AND** the agent estimates its context usage exceeds 50%
- **THEN** the shift stops and reports the summary for threads processed so far
- **AND** remaining unread threads are left for the next shift

#### Scenario: Always finish the current case
- **WHEN** the agent is processing threads belonging to a case
- **AND** context usage exceeds 50% mid-case
- **THEN** the agent continues processing remaining unread threads for that case before wrapping up
- **AND** does not start a new case

#### Scenario: Reject concurrent shifts
- **WHEN** a shift is already in progress
- **AND** a second `POST /shift` arrives
- **THEN** the API returns `409 Conflict`

#### Scenario: Shift via CLI
- **WHEN** a user runs `scripts/agent.py --shift`
- **THEN** the script calls `POST /shift`, receives the `shift_id`
- **AND** polls `GET /api/shifts/{id}` on the CRM API until complete
- **AND** prints the summary to stdout

#### Scenario: Insight capture during shift
- **WHEN** the agent discovers an operational pattern, gotcha, or effective technique while processing threads
- **THEN** it appends the insight to `learnings.md` in its workspace
