## 1. CRM API Client
- [x] 1.1 Create `frontend/src/lib/espo.ts` — fetch wrapper for EspoCRM REST API via `/api/crm` proxy route
- [x] 1.2 Add typed fetch functions: `getCases()`, `getCase(id)`, `getEmails()`, `getAccounts()`, `getTasks()`, `getRelatedEmails(caseId)`, `getRelatedTasks(caseId)`

## 2. Dashboard Page
- [x] 2.1 Convert dashboard to fetch Cases from CRM, grouped by priority (Critical/High/Medium/Low)
- [x] 2.2 Replace activity stream with recent Emails from CRM
- [x] 2.3 Update QuickStats to show live counts (total emails, open tasks, closed cases)

## 3. Situation Detail Page
- [x] 3.1 Fetch Case by ID with linked Emails, Tasks, and Account
- [x] 3.2 Show AI summary from Case description
- [x] 3.3 Show communications timeline from linked Emails
- [x] 3.4 Show recommended actions from linked Tasks
- [x] 3.5 Show draft response from linked draft Emails (if any)
- [x] 3.6 Remove hardcoded financial exposure breakdown, "Why CRITICAL" box, and tags

## 4. Properties Page
- [x] 4.1 Fetch Accounts from CRM
- [ ] 4.2 Show each Account with counts of linked Cases and Emails
- [x] 4.3 Remove fabricated unit counts, occupancy rates, and response times

## 5. Search Page
- [x] 5.1 Wire search input to CRM search if trivial (filter Cases by name), otherwise leave as non-functional UI — left as static UI

## 6. Data Types
- [x] 6.1 Update `src/lib/data.ts` — replace mock data with TypeScript types matching CRM entities (keep as types file, remove mock arrays)

## 7. Seed Updates
- [x] 7.1 Add 1-2 Cases to `scripts/seed.py` linking existing Emails, with Tasks
- [x] 7.2 Update `scripts/reset.py` to also delete Cases and Tasks
