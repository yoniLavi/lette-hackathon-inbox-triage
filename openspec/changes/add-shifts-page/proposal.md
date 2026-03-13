# Change: Add Shifts Page with First-Class Shift Entity

## Why
Shifts are currently backend-only — triggered via CLI (`scripts/agent.py --shift`) with no visibility into history, results, or backlog. The operator has no way to see what the AI processed, what's pending, or trigger a shift from the UI. A dedicated shifts page gives operators full control and visibility over the AI's batch processing.

## What Changes
- **New CRM entity: Shift** — first-class record tracking each shift's lifecycle (status, timing, metrics, summary)
- **Agent API becomes async** — `POST /shift` returns immediately with a `shift_id`, runs in background, updates Shift record on completion
- **New frontend page: `/shifts`** — shift history with summaries, incoming email backlog, trigger + follow a new shift
- CLI `--shift` updated to poll the new async endpoint

## Impact
- Affected specs: `crm-api` (new entity), `agent-api` (async shift), `frontend-app` (new page)
- Affected code: `crm/main.py`, `crm/models.py`, `agent/api.py`, `agent/workspace/.claude/commands/shift.md`, `frontend/src/app/shifts/page.tsx`, `frontend/src/lib/crm.ts`, `scripts/agent.py`
