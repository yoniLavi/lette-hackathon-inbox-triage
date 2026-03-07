## 1. CRM API Client
- [ ] 1.1 Create `frontend/src/lib/espo.ts` — server-side fetch wrapper for EspoCRM REST API (uses `ESPOCRM_URL` + `ESPOCRM_API_KEY`)
- [ ] 1.2 Add typed fetch functions: `getCases()`, `getCase(id)`, `getEmails()`, `getAccounts()`, `getTasks()`, `getRelatedEmails(caseId)`, `getRelatedTasks(caseId)`

## 2. Dashboard Page
- [ ] 2.1 Convert dashboard to fetch Cases from CRM, grouped by priority (Critical/High/Medium/Low)
- [ ] 2.2 Replace activity stream with recent Emails from CRM
- [ ] 2.3 Update QuickStats to show live counts (total emails, open tasks, closed cases)

## 3. Situation Detail Page
- [ ] 3.1 Fetch Case by ID with linked Emails, Tasks, and Account
- [ ] 3.2 Show AI summary from Case description
- [ ] 3.3 Show communications timeline from linked Emails
- [ ] 3.4 Show recommended actions from linked Tasks
- [ ] 3.5 Show draft response from linked draft Emails (if any)
- [ ] 3.6 Remove hardcoded financial exposure breakdown, "Why CRITICAL" box, and tags

## 4. Properties Page
- [ ] 4.1 Fetch Accounts from CRM
- [ ] 4.2 Show each Account with counts of linked Cases and Emails
- [ ] 4.3 Remove fabricated unit counts, occupancy rates, and response times

## 5. Search Page
- [ ] 5.1 Wire search input to CRM search if trivial (filter Cases by name), otherwise leave as non-functional UI

## 6. Data Types
- [ ] 6.1 Update `src/lib/data.ts` — replace mock data with TypeScript types matching CRM entities (keep as types file, remove mock arrays)

## 7. Seed Updates
- [ ] 7.1 Add 1-2 Cases to `scripts/seed.py` linking existing Emails, with Tasks and a Note
- [ ] 7.2 Update `scripts/reset.py` to also delete Cases and Tasks
