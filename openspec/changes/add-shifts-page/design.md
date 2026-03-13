## Context
The shift system is fully implemented as a synchronous agent endpoint (`POST /shift`) that blocks for up to 300s. The agent creates a Case per shift for journaling (Notes per thread). To expose shifts in the UI, we need a dedicated entity for tracking and an async trigger pattern consistent with the existing worker delegation architecture.

## Goals / Non-Goals
- Goals: Operator visibility into shift history, backlog awareness, UI-triggered shifts with live progress
- Non-Goals: Real-time SSE streaming of shift progress (polling is sufficient), replacing the Case-based journaling (Shift entity complements it, doesn't replace it)

## Decisions

### Shift as CRM entity (not just a Case)
The Shift entity stores structured metadata (status, timing, counts, summary) that would be awkward to parse from Case descriptions. The agent still creates a Case for detailed journaling (Notes per thread) — the Shift record links to it via `case_id`.

Fields: `id`, `started_at`, `completed_at`, `status` (in_progress | completed | failed), `threads_processed`, `emails_processed`, `drafts_created`, `tasks_created`, `summary`, `case_id` (FK to the journal Case).

### Async shift trigger
`POST /shift` returns `{"shift_id": N}` immediately, runs the shift skill in the background. The agent creates the Shift record at start (status=in_progress) and updates it on completion. Frontend polls `GET /api/shifts/{id}` for status. CLI polls the same way.

This is consistent with the worker delegation pattern (background task + polling) and keeps CRM as the system of record for shift state.

### Backlog = unread threads
"Emails since last shift" is implemented as the count + list of unread threads (`GET /api/threads?is_read=false`). This is simpler and more accurate than timestamp-based filtering — it shows exactly what the next shift would process.

### Shifts page layout
Three sections:
1. **Header with trigger** — "Start Shift" button (disabled when one is running), active shift progress indicator
2. **Backlog summary** — count of unread threads, grouped preview (thread subjects, senders, urgency signals)
3. **Shift history** — reverse-chronological list of past shifts with expandable details (summary, metrics, link to journal Case)

## Risks / Trade-offs
- Polling latency: operator sees updates every 2-3s, not real-time. Acceptable for hackathon — shifts take minutes.
- Shift entity adds a table: minimal overhead, standard CRUD pattern already established.
- Agent must update Shift record: requires `crm shifts update` calls in the shift skill — straightforward addition.

## Open Questions
- Should the backlog preview show full thread details or just subjects + counts?
