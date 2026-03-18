## 1. CRM: Shift Entity
- [x] 1.1 Add Shift model to `crm/models.py` (id, started_at, completed_at, status, threads_processed, emails_processed, drafts_created, tasks_created, summary, case_id)
- [x] 1.2 Register "shifts" in entity registry in `crm/main.py`
- [x] 1.3 Add `?include=case` support for shifts (case with notes for journal)
- [x] 1.4 Table created via `Base.metadata.create_all` (no explicit migration needed)

## 2. Agent API: Async Shift
- [x] 2.1 Refactor `POST /shift` to return `{"shift_id": N}` immediately and run in background
- [x] 2.2 Create Shift record at start (status=in_progress), update on completion/failure
- [x] 2.3 Update shift skill to link Shift → Case and document `crm shifts` commands
- [x] 2.4 Link journal Case to Shift record via case_id (agent does this in setup step 2)

## 3. CRM CLI: Shift Entity Support
- [x] 3.1 Automatic via entity registry — `crm shifts create/update/get/list` all work

## 4. Scripts: CLI Update
- [x] 4.1 Update `scripts/agent.py --shift` to poll CRM `GET /api/shifts/{id}` until complete

## 5. Frontend: Shifts Page
- [x] 5.1 Add `CrmShift` type to `crm.ts` with fetch functions (`getShifts`, `getShift`, `getUnreadThreads`)
- [x] 5.2 Create `/shifts` page as client component
- [x] 5.3 Implement shift history list with expandable details (ShiftCard component)
- [x] 5.4 Implement backlog section (unread thread count + subject/sender preview)
- [x] 5.5 Implement "Start Shift" trigger button calling agent API
- [x] 5.6 Implement polling for active shift progress (3s interval)
- [x] 5.7 Add "Shifts" and "Properties" to main navigation in layout.tsx

## 6. Testing
- [x] 6.1 Integration tests for Shift CRUD and include=case (2 new tests, all 19 pass)
- [x] 6.2 Integration test for async POST /shift flow (skipped — requires full agent + Bedrock)
