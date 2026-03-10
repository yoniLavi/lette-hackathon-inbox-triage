## 1. Data layer cleanup
- [x] 1.1 Rename `espo.ts` → `crm.ts`, update all imports
- [x] 1.2 Add missing types: `CrmContact`, `CrmThread`, `CrmNote`
- [x] 1.3 Add missing fields to existing types (`CrmProperty.manager_email`, `CrmEmail.is_important`)
- [x] 1.4 Update CRM proxy route: remove EspoCRM env vars, use `CRM_API_URL` only
- [x] 1.5 Add fetch functions: `getThreads()`, `getContacts(propertyId)`, `getNotes(caseId)`, update existing fetches to use `?include=`

## 2. Contact resolution
- [x] 2.1 Use `?include=contact` on email and thread fetches
- [x] 2.2 Display sender as contact name with type badge (tenant/landlord/contractor) instead of raw email address
- [x] 2.3 Fall back to raw `from_address` when no contact match

## 3. Dashboard: work-item-centric redesign
- [x] 3.1 Replace "Recent Emails" center column with a work queue showing all cases needing attention, with action-oriented status badges
- [x] 3.2 Update QuickStats to show work-centric metrics: Pending Tasks, Drafts to Review, Resolved Cases
- [x] 3.3 Enrich SituationCards with property name (via `?include=property`), contact info, action status, and thread/task counts

## 4. Case detail: task-first layout
- [x] 4.1 Reorder left panel: lead with recommended actions (tasks) and draft responses, then communications as supporting context
- [x] 4.2 Group case emails by thread_id in expandable thread groups
- [x] 4.3 Show contact name + type badge on emails instead of raw addresses
- [x] 4.4 Resolve property name and details in Related Context (use `?include=property`)

## 5. Case detail right panel enrichment
- [x] 5.1 Add agent notes section showing case notes chronologically
- [x] 5.2 Add related contacts section grouped by type (tenant, landlord, contractor, etc.)

## 6. Search
- [x] 6.1 Wire search page to CRM full-text search (`GET /api/emails?search=`) with `?include=contact`

## 7. Spec cleanup
- [x] 7.1 Remove all EspoCRM references from frontend-app spec
