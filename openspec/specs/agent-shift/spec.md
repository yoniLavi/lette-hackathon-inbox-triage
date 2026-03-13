# agent-shift Specification

## Purpose
Thread-aware batch email processing system where the AI agent autonomously triages incoming communications, drafts responses, creates follow-up tasks, and journals its work — all orchestrated through the CRM as system of record.

## Requirements

### Requirement: Shift Workflow
The agent SHALL process unread email threads in batch "shifts", working through each thread sequentially — assessing context, taking CRM actions, and journaling results — until all threads are processed or context limits are reached.

#### Scenario: Shift lifecycle
- **WHEN** a shift is triggered (via API or CLI)
- **THEN** the agent creates a journal Case ("Agent Shift — {timestamp}") with status "in_progress"
- **AND** enters a loop: fetch next unread thread → process → mark complete → journal
- **AND** on completion, closes the journal Case with a final summary

#### Scenario: Fetch work item
- **WHEN** the agent needs the next thread to process
- **THEN** it calls `crm shift next` which returns the oldest unread thread with all emails, sender contact, and full case context (tasks, notes, property) in a single call
- **AND** if no unread threads remain, the shift ends

### Requirement: Thread Processing
The agent SHALL assess each thread holistically — reading all emails in order, reviewing contact and case context — then take appropriate CRM actions.

#### Scenario: Urgency classification
- **WHEN** the agent processes a thread
- **THEN** it classifies the thread as one of: emergency, urgent, routine, or low priority
- **AND** uses Irish BTR/PRS domain knowledge (fire safety deadlines, lockout response times, RTB escalation patterns) to inform the classification

#### Scenario: Draft reply
- **WHEN** the agent decides a reply is needed
- **THEN** it creates an email with `status: "draft"` (never sent automatically)
- **AND** uses the property's `manager_email` as the `from_address`
- **AND** writes in a professional, concise tone appropriate for Irish property management

#### Scenario: Task creation
- **WHEN** the agent identifies a follow-up action requiring human intervention
- **THEN** it creates a Task with a clear action-oriented name, priority, description, and due date
- **AND** links it to the relevant Contact and Case

#### Scenario: Case management
- **WHEN** a thread is not yet linked to a Case
- **THEN** the agent creates a new Case and links the thread to it
- **AND** when a thread is already linked to a Case, the agent reviews existing tasks and notes before acting

### Requirement: Thread Completion
The agent SHALL mark processed threads as read and journal each one to the shift's Case.

#### Scenario: Mark thread read
- **WHEN** the agent finishes processing a thread
- **THEN** it calls `crm shift complete` with the thread's email IDs and case_id
- **AND** this batch-marks all emails as read and links the thread to its case

#### Scenario: Per-thread journal entry
- **WHEN** the agent finishes processing a thread
- **THEN** it creates a Note on the shift's journal Case summarizing: thread subject, email count, sender, urgency classification, and actions taken

### Requirement: Context-Aware Pacing
The agent SHALL manage its own context window usage, ensuring it finishes coherent units of work (all threads for a case) before stopping.

#### Scenario: Pacing check between cases
- **WHEN** the agent finishes all threads for the current case and is about to start a new case
- **THEN** it checks its context usage
- **AND** if usage exceeds 50%, it wraps up the shift with a summary of what was processed
- **AND** remaining unread threads are left for the next shift

#### Scenario: Never abandon a case mid-processing
- **WHEN** context usage exceeds 50% while processing threads for a case
- **THEN** the agent continues processing all remaining unread threads for that case
- **AND** only stops after the current case is fully processed

### Requirement: Shift Summary
The agent SHALL produce a structured summary at the end of each shift.

#### Scenario: Summary content
- **WHEN** a shift completes (all threads processed or pacing limit reached)
- **THEN** the summary includes: threads processed, emails processed, drafts created, tasks created, breakdown by urgency level, top 3 key actions, and any learnings captured

### Requirement: Insight Capture
The agent SHALL accumulate operational knowledge across shifts by appending discovered patterns to a persistent learnings file.

#### Scenario: Append learnings
- **WHEN** the agent discovers an operational pattern, domain-specific gotcha, or effective technique during processing
- **THEN** it reads `learnings.md` first to avoid duplicates
- **AND** appends the new insight with appropriate categorization

### Requirement: Concurrency Guard
Only one shift SHALL run at a time.

#### Scenario: Reject concurrent shift
- **WHEN** a shift is already in progress and a second shift is requested
- **THEN** the request is rejected with a 409 Conflict response
