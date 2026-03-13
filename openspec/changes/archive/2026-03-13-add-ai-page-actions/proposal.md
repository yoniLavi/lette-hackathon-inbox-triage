# Change: AI Page Actions — rich context + scroll/expand control

## Why
The Frontend AI sees only summaries of page data (draft count but not draft bodies, task names but not descriptions, no email content). It can't help the user review or find things they're already looking at. Additionally, the AI has no way to draw the user's attention to specific page elements.

## What Changes

### Phase 1: Rich page context + scrollTo/expand actions
- **Enrich page context** on all pages to include full visible data (email bodies, draft content, task descriptions, note text, thread structure, contact details)
- **Add action protocol**: Frontend AI may return at most one UI action per response (`scrollTo`, `expand`) alongside its text reply
- **scrollTo with highlight**: scrolls to an element and applies a temporary CSS highlight effect (prominent border/glow) to draw the user's eye
- **expand**: expands a collapsed thread group on the situation detail page
- **Action tool**: Frontend AI gets a `page_action` tool that it calls to trigger UI actions; the frontend executes the action, captures updated context, and feeds it back before the AI produces its final text response

### Phase 2: Navigate action (future)
- **navigate**: move to a different page (e.g. dashboard → situation detail), frontend loads new page and sends updated context back to the AI before it responds

## Impact
- Affected specs: `frontend-app`, `agent-api`
- Affected code:
  - `frontend/src/lib/page-context.tsx` — enriched context types and builders
  - `frontend/src/app/situations/[id]/page.tsx` — register action handlers, add data-ids for scroll targets
  - `frontend/src/app/page.tsx` — enriched dashboard context
  - `frontend/src/app/search/page.tsx` — enriched search context
  - `frontend/src/app/properties/page.tsx` — enriched properties context
  - `frontend/src/components/dashboard/AIAssistant.tsx` — parse action events from SSE, execute actions, highlight CSS
  - `agent/frontend_ai.py` — add `page_action` tool definition
  - `agent/api.py` — pass action back via SSE event, accept updated context for second turn
