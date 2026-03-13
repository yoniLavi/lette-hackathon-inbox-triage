## 1. CRM: Shift Entity
- [ ] 1.1 Add Shift model to `crm/models.py` (id, started_at, completed_at, status, threads_processed, emails_processed, drafts_created, tasks_created, summary, case_id)
- [ ] 1.2 Register "shifts" in entity registry in `crm/main.py`
- [ ] 1.3 Add `?include=case` support for shifts (case with notes for journal)
- [ ] 1.4 Add migration in `database.py:init_db()` for shifts table

## 2. Agent API: Async Shift
- [ ] 2.1 Refactor `POST /shift` to return `{"shift_id": N}` immediately and run in background
- [ ] 2.2 Create Shift record at start (status=in_progress), update on completion/failure
- [ ] 2.3 Update shift skill to call `crm shifts update` with metrics at wrap-up
- [ ] 2.4 Link journal Case to Shift record via case_id

## 3. CRM CLI: Shift Entity Support
- [ ] 3.1 Ensure `crm shifts create/update/get` works (should be automatic via entity registry)

## 4. Scripts: CLI Update
- [ ] 4.1 Update `scripts/agent.py --shift` to poll CRM `GET /api/shifts/{id}` until complete

## 5. Frontend: Shifts Page
- [ ] 5.1 Add `CrmShift` type to `crm.ts` with fetch functions
- [ ] 5.2 Create `/shifts` page with server-side data fetching
- [ ] 5.3 Implement shift history list with expandable details
- [ ] 5.4 Implement backlog section (unread thread count + preview)
- [ ] 5.5 Implement "Start Shift" trigger button calling agent API
- [ ] 5.6 Implement polling for active shift progress
- [ ] 5.7 Add "Shifts" to main navigation

## 6. Testing
- [ ] 6.1 Integration tests for Shift CRUD and include=case
- [ ] 6.2 Integration test for async POST /shift flow
