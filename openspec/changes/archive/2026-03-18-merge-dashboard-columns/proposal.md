# Change: Merge Dashboard Queue and Work Queue into Unified Priority List

## Why
The left column (Critical Queue / High Priority) and center column (Needs Your Attention) surface overlapping case data — the same case can appear in both. The left column organizes by severity, the center by action type, but neither adds enough unique value to justify the duplication. A single unified queue sorted by a composite score (action urgency × priority) gives the operator one place to look, reduces cognitive load, and reclaims screen space for richer case cards.

## What Changes
- **Dashboard layout**: Replace the 3-column grid (priority tiers | work queue | quick insights) with a 2-column layout (unified work queue | quick insights sidebar)
- **Unified work queue**: Single list of non-closed, non-done cases sorted by composite score: action type first (triage → draft → pending), then priority within each group (critical → high → medium → low)
- **Priority integrated into cards**: Each SituationCard already shows a colored urgency dot and action badge — no information is lost by removing the separate priority sections
- **Quick Insights sidebar**: Remains as-is but gets more horizontal space
- **Page context for frontend AI**: `buildDashboardContext` updated to reflect the merged view — cases listed in work-queue order with both priority and actionStatus, so the AI sees the same unified ranking the human sees

## Impact
- Affected specs: `frontend-app` (Work-Centric Dashboard requirement, Page context on dashboard scenario)
- Affected code: `frontend/src/app/page.tsx` (dashboard layout), `frontend/src/lib/page-context.tsx` (buildDashboardContext)
- No backend changes
- No new dependencies
