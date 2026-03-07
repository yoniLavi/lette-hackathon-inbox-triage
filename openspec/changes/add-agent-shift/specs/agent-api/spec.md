## ADDED Requirements

### Requirement: Agent Shift
The agent API SHALL expose an endpoint that triggers batch processing of active emails, where the agent triages each email and takes appropriate CRM actions.

#### Scenario: Start a shift
- **WHEN** a client sends `POST /shift`
- **THEN** the agent starts a fresh session
- **AND** processes all active (unprocessed) emails in EspoCRM
- **AND** returns a structured summary of actions taken

#### Scenario: Per-email processing
- **WHEN** the agent processes an email during a shift
- **THEN** it reads the full email body and identifies the sender
- **AND** classifies the email by urgency (emergency, urgent, routine, low)
- **AND** takes one or more CRM actions: drafting a reply, updating contact/account details, or creating/updating a task

#### Scenario: Draft replies without sending
- **WHEN** the agent drafts a reply to an email
- **THEN** the reply is created in EspoCRM with status "Draft"
- **AND** the draft is never automatically sent
- **AND** the property manager can review and send it from the CRM UI

#### Scenario: Task creation for follow-up actions
- **WHEN** the agent identifies a follow-up action that requires human intervention
- **THEN** it creates a Task in EspoCRM with a description, priority, and due date
- **AND** links the task to the relevant Contact or Account

#### Scenario: Shift journal via Case
- **WHEN** the agent starts a shift
- **THEN** it creates a Case in EspoCRM (e.g., "Agent Shift — 2026-03-07 10:30") with status "In Progress"
- **AND** as it processes each email, it adds a Note to the Case summarizing the actions taken
- **AND** when the shift completes, it updates the Case status to "Closed" with a final summary

#### Scenario: Review previous shifts
- **WHEN** a property manager searches Cases in EspoCRM
- **THEN** they can find past shift Cases and browse their stream of notes to review what the agent did

#### Scenario: Reject concurrent shifts
- **WHEN** a shift is already in progress
- **AND** a second `POST /shift` arrives
- **THEN** the API returns `409 Conflict`

#### Scenario: Shift via CLI
- **WHEN** a user runs `scripts/agent.py --shift`
- **THEN** the script calls `POST /shift` and prints the summary to stdout

## MODIFIED Requirements

### Requirement: Agent HTTP API
The agent container SHALL expose an HTTP API for sending prompts and managing the agent session.

#### Scenario: Send a prompt
- **WHEN** a client sends `POST /prompt` with `{"message": "List all emails"}`
- **THEN** the agent processes the prompt using EspoCRM tools
- **AND** returns `{"response": "...", "session_id": "..."}` with the agent's response

#### Scenario: Reject concurrent prompts
- **WHEN** a prompt is already being processed
- **AND** a second `POST /prompt` arrives
- **THEN** the API returns `409 Conflict`

#### Scenario: Reject prompt during shift
- **WHEN** a shift is in progress
- **AND** a `POST /prompt` arrives
- **THEN** the API returns `409 Conflict`
