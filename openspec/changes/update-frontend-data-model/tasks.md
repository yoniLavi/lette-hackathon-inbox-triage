## 1. Data layer cleanup
- [ ] 1.1 Rename `espo.ts` → `crm.ts`, update all imports
- [ ] 1.2 Add missing types: `CrmContact`, `CrmThread`, `CrmNote`
- [ ] 1.3 Add missing fields to existing types (`CrmProperty.manager_email`, `CrmEmail.is_important`)
- [ ] 1.4 Update CRM proxy route: remove EspoCRM env vars, use `CRM_API_URL` only
- [ ] 1.5 Add fetch functions: `getThreads()`, `getContacts(propertyId)`, `getNotes(caseId)`, update existing fetches to use `?include=`

## 2. Dashboard: work-item-centric redesign
- [ ] 2.1 Replace "Recent Emails" center column with a work queue showing all cases needing attention, with action-oriented status badges
- [ ] 2.2 Update QuickStats to show work-centric metrics: Pending Tasks, Drafts to Review, Resolved Cases
- [ ] 2.3 Enrich SituationCards with property name (via `?include=property`), contact info, action status, and thread/task counts

## 3. Contact resolution
- [ ] 3.1 Use `?include=contact` on email and thread fetches
- [ ] 3.2 Display sender as contact name with type badge (tenant/landlord/contractor) instead of raw email address
- [ ] 3.3 Fall back to raw `from_address` when no contact match

## 4. Case detail: task-first layout
- [ ] 4.1 Reorder left panel: lead with recommended actions (tasks) and draft responses, then communications as supporting context
- [ ] 4.2 Group case emails by thread_id in expandable thread groups
- [ ] 4.3 Show contact name + type badge on emails instead of raw addresses
- [ ] 4.4 Resolve property name and details in Related Context (use `?include=property`)

## 5. Case detail right panel enrichment
- [ ] 5.1 Add agent notes section showing case notes chronologically
- [ ] 5.2 Add related contacts section grouped by type (tenant, landlord, contractor, etc.)

## 6. Search
- [ ] 6.1 Wire search page to CRM full-text search (`GET /api/emails?search=`) with `?include=contact`

## 7. Spec cleanup
- [ ] 7.1 Remove all EspoCRM references from frontend-app spec
