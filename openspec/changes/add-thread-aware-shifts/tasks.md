## 1. CRM API — Thread model
- [x] 1.1 Add Thread model to `crm/models.py` (id, thread_id, subject, last_activity_at, email_count, is_read, case_id, property_id, contact_id)
- [x] 1.2 Add thread upsert logic: auto-create/update Thread on email create/update
- [x] 1.3 Add Thread to ENTITIES registry and FILTERS in `crm/main.py`
- [x] 1.4 Add `manager_email` field to Property model

## 2. CRM API — Include parameter
- [x] 2.1 Implement `?include=` support in generic GET-by-id endpoint (nested related records)
- [x] 2.2 Support includes: cases→(emails, tasks, notes, property), threads→(emails, contact), emails→(contact)
- [x] 2.3 Add include support to generic list endpoint (for thread listing with emails)

## 3. CRM API — Shift endpoints
- [x] 3.1 Implement `GET /api/shift/next` — returns next unread thread with full case context
- [x] 3.2 Implement `POST /api/shift/complete` — batch mark emails read, link to case
- [x] 3.3 Implement `PATCH /api/emails/bulk` — batch update emails by ID list

## 4. CRM CLI — Thread commands + include flag
- [x] 4.1 Add `crm threads list/get` commands
- [x] 4.2 Add `--include` flag to `get` commands across all entities
- [x] 4.3 Add `crm shift next` and `crm shift complete` commands
- [x] 4.4 Add `crm emails bulk-update` command

## 5. Agent workspace — Shift skill rewrite
- [x] 5.1 Rewrite `shift.md` to process threads via `crm shift next`, not individual emails
- [x] 5.2 Update `CLAUDE.md` with Thread entity docs, include flag docs, shift endpoint docs
- [x] 5.3 Add context-aware pacing: finish current case, don't start new case if >50% context used

## 6. Seed scripts
- [x] 6.1 Update `scripts/seed.py` to populate `manager_email` on Properties
- [x] 6.2 Verify threads are auto-created from seeded emails (no manual thread seeding needed)

## 7. Spec creation + cleanup
- [x] 7.1 Create `crm-api` spec covering all CRM entities, endpoints, Thread model, include param
- [x] 7.2 Update `agent-api` spec: remove EspoCRM references, update shift scenarios for thread-aware processing

## 8. Validation
- [x] 8.1 Test: thread auto-creation from email inserts
- [x] 8.2 Test: `GET /api/shift/next` returns full context blob
- [x] 8.3 Test: shift processes 5 threads with <5 tool calls per thread
- [x] 8.4 Test: multiple emails in same thread/case are processed together in one pass
- [x] 8.5 Test: `POST /api/shift/complete` batch-marks emails read
- [x] 8.6 Test: agent wraps up shift when context is high, finishing current case first
