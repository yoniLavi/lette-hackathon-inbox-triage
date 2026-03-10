# Change: Align frontend with new CRM data model

## Why
The frontend was built against EspoCRM and hasn't been updated since the CRM was replaced with our custom FastAPI + PostgreSQL stack. The spec still references EspoCRM/Accounts, the code still lives in `espo.ts`, and the frontend is missing three CRM entities entirely (Contact, Thread, Note). More importantly, the UX is email-centric (flat email list, email counts) when the human user's actual role is **tier-2 review of AI-triaged work** — reviewing cases, approving tasks, and sending draft responses prepared by the AI shift-worker.

## UX Philosophy
The AI shift-worker processes all incoming emails in near-realtime. The human property manager never needs to see raw emails — they review the AI's output:
- **Cases** (situations) with AI summaries
- **Tasks** (recommended actions) proposed by the AI
- **Draft responses** prepared by the AI for approval/sending
- **Notes** recorded by the AI during triage

The dashboard should answer: "What needs my attention?" — not "What emails arrived?"

## What Changes
- **BREAKING**: Replace all EspoCRM references in spec and code (env vars, file names, entity names)
- Add Contact, Thread, and Note types to the data layer
- **Dashboard center column**: Replace "Recent Emails" with a unified work queue of cases needing attention, ordered by priority and recency, with action-oriented status badges ("Draft ready for review", "3 actions pending", "Needs triage")
- **Dashboard right column**: Change QuickStats from email-centric ("Emails") to work-centric ("Pending Tasks", "Drafts to Review", "Resolved Cases")
- **SituationCards**: Show property name, contact info, action status, and thread/task counts — not just case name and priority
- **Case detail**: Lead with tasks and drafts (the actionable items), with communications as supporting context in expandable thread groups
- **Case detail right panel**: Add related contacts grouped by type and agent notes
- Resolve contact names + type badges on all email/thread displays
- Resolve property names instead of "Property #5"
- Wire search page to CRM full-text search
- Use `?include=` param throughout for richer data loading

## Design Notes
- Keep existing layout (three-column dashboard, two-panel case detail) — no structural changes
- Shift content hierarchy from email-centric to work-item-centric
- Inspired by Lette.ai's action-oriented, task-focused property management UX

## Impact
- Affected specs: `frontend-app`
- Affected code: `frontend/src/lib/espo.ts` (rename + rewrite types), all pages and components that consume CRM data
- No CRM API changes required — all needed endpoints and includes already exist
