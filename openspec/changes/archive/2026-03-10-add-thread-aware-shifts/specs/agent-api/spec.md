## MODIFIED Requirements

### Requirement: Agent Shift
The agent API SHALL expose an endpoint that triggers batch processing of active emails, where the agent triages each thread and takes appropriate CRM actions.

#### Scenario: Start a shift
- **WHEN** a client sends `POST /shift`
- **THEN** the agent starts a fresh session
- **AND** processes unread threads via the CRM shift work-item endpoint
- **AND** returns a structured summary of actions taken

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
- **AND** as it processes each thread, it adds a Note to the Case summarizing the actions taken
- **AND** when the shift completes, it updates the Case status to "closed" with a final summary

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
- **THEN** the script calls `POST /shift` and prints the summary to stdout

#### Scenario: Insight capture during shift
- **WHEN** the agent discovers an operational pattern, gotcha, or effective technique while processing threads
- **THEN** it appends the insight to `learnings.md` in its workspace
