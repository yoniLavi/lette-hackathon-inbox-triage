# Change: Replace mock data with live CRM data

## Why
The frontend uses hardcoded mock data (`src/lib/data.ts`). To demo a working end-to-end system, it needs to display real CRM data — emails, cases, tasks, and accounts — fetched from EspoCRM's REST API.

## What Changes
- New `src/lib/espo.ts` — server-side EspoCRM API client for Next.js
- Replace `mockSituations` with Cases fetched from CRM (Cases map to Situations)
- Replace `mockActivities` with recent Emails from CRM
- Simplify situation detail page: remove financial exposure breakdown, "Why CRITICAL" box, and tags — keep AI summary (Case description), communications (linked Emails), recommended actions (linked Tasks), and draft response (draft Emails)
- Simplify properties page: show Accounts with case/email counts, drop fabricated unit counts and occupancy stats
- Update QuickStats to show live counts (emails, open tasks, closed cases)
- Seed 1-2 example Cases with linked Emails and Tasks for demo
- Reset script updated to also clear Cases and Tasks

## Impact
- Affected specs: `frontend-app` (new data layer), `seed-scripts` (Case seeding + reset)
- Affected code: `frontend/src/lib/data.ts` (replaced), all page components, `scripts/seed.py`, `scripts/reset.py`
