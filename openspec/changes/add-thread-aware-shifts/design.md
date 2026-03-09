## Context
The agent processes emails during shifts. Currently it fetches one email at a time,
then makes multiple API calls to build context (contact lookup, thread siblings,
case history). This is wasteful when multiple emails share a thread or case.

The CRM API is a FastAPI service with 6 entities (Property, Contact, Email, Task,
Case, Note) and a generic CRUD pattern. The agent calls it via a Click-based CLI
installed in the agent container.

## Goals
- Thread is a first-class entity with its own endpoints
- A single API call returns everything the agent needs to process a thread
- Shift skill processes threads (not emails), with full case context pre-loaded
- Batch operations reduce per-thread tool calls from ~8-11 to ~3-4

## Non-Goals
- GraphQL or fully flexible query language (one consumer with predictable patterns)
- Real-time thread updates via websockets
- Thread merging/splitting

## Decisions

### Thread as a derived entity
- **Decision**: Thread is auto-maintained by the API, not manually created by clients.
  When an email is created/updated, the API upserts the corresponding Thread row
  based on `email.thread_id`.
- **Why**: Threads are an aggregate view of emails, not independent data. Making
  them derived keeps the source of truth in emails and avoids sync issues.
- **Implementation**: Post-insert/update hook in the email create/update endpoints.
  Thread fields (`subject`, `last_activity_at`, `email_count`, `is_read`) are
  recomputed from the thread's emails.

### Include parameter pattern
- **Decision**: Use `?include=emails,contact,tasks` query parameter on GET endpoints.
  Returns nested JSON objects under keys matching the include names.
- **Why**: Simple, REST-idiomatic, no new dependencies. The agent's CLI can add an
  `--include` flag that maps directly.
- **Alternatives considered**:
  - GraphQL: too heavy for one consumer, adds schema/resolver layer
  - JSON:API sparse fieldsets: over-engineered for our use case
  - Separate `/api/cases/{id}/emails` sub-resource endpoints: more calls, not fewer

### Shift work-item endpoint
- **Decision**: `GET /api/shift/next` returns a composite JSON blob with the next
  unread thread plus its full case context. `POST /api/shift/complete` batch-updates
  the processed emails and thread.
- **Why**: This is a purpose-built endpoint for the agent's primary workflow. It
  replaces ~5 CLI calls per email with 1 call per thread. The response shape is:
  ```json
  {
    "thread": {
      "id": 42, "thread_id": "thread_042", "subject": "...",
      "last_activity_at": "...", "email_count": 3, "is_read": false,
      "emails": [/* ordered by thread_position */],
      "contact": {/* resolved from latest email's from_address */}
    },
    "case": {
      "id": 14, "name": "...", "status": "...",
      "tasks": [...], "notes": [...],
      "property": {/* resolved from case.property_id */}
    }
  }
  ```
  When no case exists yet (new thread), `case` is `null`.
- **Ordering**: Threads are returned oldest-unread-first (`last_activity_at ASC`
  where `is_read = false`), so stale alerts get processed before fresh routine mail.

### Thread.is_read semantics
- **Decision**: `Thread.is_read` is true only when ALL emails in the thread are read.
  Recomputed on email update.
- **Why**: The agent should see a thread as "unprocessed" if any email in it is new.

### Shift pacing: context-aware, not count-based
- **Decision**: The agent does not use a fixed thread or email limit. Instead, it
  always finishes the current case (all its unread threads), then checks context
  usage before starting a new case. If context exceeds 50%, it wraps up the shift.
- **Why**: The real constraint on shift length is the agent's context window, not an
  arbitrary item count. A shift with 3 single-email threads is cheap; a shift with 1
  thread of 50 emails is expensive. Count-based limits can't capture this.

  This mirrors human behaviour: a property manager finishes the case in front of them
  but won't start a new one near the end of their shift. The agent does the same —
  it commits to completing the current case even if context is getting full, but
  exercises judgement about whether to take on new work.

  The automatic context compaction mechanism is the safety net if a single case is
  genuinely enormous.
- **Implementation**: The shift skill instructs the agent:
  1. Fetch next unread thread via `crm shift next`
  2. Process all threads belonging to the same case
  3. Before fetching a thread from a **different** case, assess context usage
  4. If >50% context consumed, close the shift and report summary

  The agent runs inside a Claude Code session and can check its own context usage
  via the `/context` slash command, which returns a breakdown including free space
  percentage. The shift skill instructs the agent to run `/context` before starting
  a new case and wrap up if free space is below 50%.

## Risks / Trade-offs
- **Eager loading size**: A large case could return ~30K tokens of context. This is
  within budget but worth monitoring. If cases grow beyond ~100 items, we'd add
  pagination to the include results.
  → Mitigation: Log payload sizes in shift endpoint, add a warning if >50K chars.
- **Thread upsert overhead**: Every email create/update triggers a thread recompute.
  With 100 emails this is negligible, but at scale we'd want a background job.
  → Mitigation: Acceptable for hackathon scale. Recompute is a single aggregate query.

## Open Questions
- Should `POST /api/shift/complete` also auto-create the shift Case and Notes, or
  should the agent continue to create those via separate CLI calls? (Leaning toward
  keeping it in the agent — the journaling benefits from the agent's reasoning about
  what to write.)
