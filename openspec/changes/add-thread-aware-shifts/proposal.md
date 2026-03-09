# Change: Add thread-aware shifts with eager case loading

## Why
The current shift processes emails one at a time, making ~8-11 tool calls per email
to piece together context (fetch email, look up contact, check thread, check case).
When multiple emails belong to the same thread or case, the agent processes them in
isolation — duplicating lookups, missing context from sibling emails, and sometimes
writing redundant replies to different messages in the same conversation.

Threads should be a first-class CRM entity. A shift should fetch the next unread
**thread** with its full case context (all related emails, tasks, notes, contacts)
in a single call, so the agent reasons about the whole situation at once.

Sizing: a typical case has 3-5 threads, 15-50 emails, and up to 100 related items
total. Serialized as JSON this is ~30K tokens — well within the agent's 200K context.

## What Changes

### 1. Thread model + API (new `crm-api` spec)
- New `Thread` entity: auto-created/updated when emails are inserted
- `GET /api/threads` with filters (`is_read`, `case_id`, `property_id`)
- `GET /api/threads/{id}?include=emails,contact` returns thread with nested related records
- Thread `is_read` derived from whether all emails in the thread are read

### 2. Include/expand on existing endpoints
- `?include=` parameter on `GET /api/cases/{id}` — returns case with nested emails, tasks, notes, contacts
- `?include=contact` on `GET /api/emails/{id}` — resolves `from_address` to contact inline
- `?include=emails` on `GET /api/threads/{id}` — all emails in the thread ordered by position

### 3. Shift work-item endpoint
- `GET /api/shift/next` — returns the next unread thread with full case context (thread + emails + contact + case + case's tasks/notes/other emails + property)
- `POST /api/shift/complete` — batch-marks emails as read, links thread to case

### 4. Batch email operations
- `PATCH /api/emails/bulk` with `{"ids": [...], "updates": {"is_read": true}}` — saves N tool calls per thread

### 5. Property manager email mapping
- Add `manager_email` field to Property model so draft replies use the correct `from_address`

### 6. Shift skill update
- Rewrite `shift.md` to process threads (not individual emails) using the new work-item endpoint
- Context-aware shift pacing: the agent finishes the current case (all its unread
  threads) but does not start a new case if context usage exceeds 50%. This mirrors
  how a human property manager finishes the case in front of them but won't start a
  new one near the end of their shift. No arbitrary email/thread count limit needed —
  the agent manages its own pacing based on the actual constraint (context window).

### 7. Spec cleanup
- Create `crm-api` spec (missing — was skipped during replace-crm archive)
- Update `agent-api` spec to remove stale EspoCRM references

## Impact
- Affected specs: `crm-api` (new), `agent-api` (modify shift requirements)
- Affected code: `crm/models.py`, `crm/main.py`, `crm-cli/crm_cli/main.py`, `agent/workspace/.claude/commands/shift.md`, `agent/workspace/CLAUDE.md`, `scripts/seed.py`
- **Not breaking**: existing entity endpoints unchanged, Thread is additive
