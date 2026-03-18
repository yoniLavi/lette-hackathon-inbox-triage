## 1. Dashboard Layout
- [x] 1.1 Replace 3-column grid with 2-column layout (work queue `lg:col-span-8` + insights `lg:col-span-4`)
- [x] 1.2 Remove separate Critical Queue and High Priority sections
- [x] 1.3 Implement composite sort: action type (triage=0, draft=1, pending=2) then priority (critical=0, high=1, medium=2, low=3) within each action group
- [x] 1.4 Render unified "Work Queue" with section count badge

## 2. Page Context
- [x] 2.1 Update `buildDashboardContext` to emit cases in unified work-queue order (matching the on-screen sort)
- [x] 2.2 Ensure topCases includes priority field (already present) and actionStatus (already present) — verify no regressions

## 3. Testing
- [x] 3.1 Verify E2E tests pass (dashboard rendering, AI context)
- [x] 3.2 Visual check: cards show urgency dot + action badge (no information loss from removed columns)
