## Phase 1: Rich Page Context + Actions

### 1. Enrich page context
- [x] 1.1 Update `SituationContext` type and `buildSituationContext` to include: full email list (id, subject, from, to, body_plain, date_sent, status, thread_id, thread_position, is_read), draft details (id, subject, to, body_plain), task descriptions, note contents, contact details (email, company, unit)
- [x] 1.2 Update `DashboardContext` type and `buildDashboardContext` to include: case descriptions, pending task names per case, draft subjects per case
- [x] 1.3 Update `SearchContext` type and `buildSearchContext` to include: email body snippets (first 200 chars), case_id links
- [x] 1.4 Update `PropertiesContext` type and `buildPropertiesContext` to include: property descriptions, manager emails
- [x] 1.5 Update `FRONTEND_SYSTEM_PROMPT` in `api.py` to describe new context fields and the page_action tool

### 2. Action protocol — backend
- [x] 2.1 Add `page_action` tool definition to `TOOLS` in `frontend_ai.py` with schema: `{action: "scrollTo"|"expand", target: {type: "email"|"thread"|"task"|"draft"|"note", id: string}}`
- [x] 2.2 Handle `page_action` tool calls in `FrontendAI.chat()`: don't execute server-side, instead return the action in `ChatResult` so the API layer can pass it to the frontend
- [x] 2.3 Extend `ChatResult` with optional `page_action` field
- [x] 2.4 Emit new SSE event `event: action` with the action payload from `FrontendAI.chat()` via sse_queue, before the `done` event

### 3. Action protocol — frontend
- [x] 3.1 Parse `event: action` in `AIAssistant.processStream()` and store the action
- [x] 3.2 Add `data-ai-target` attributes to scroll/expand targets on the situation detail page: emails, threads, tasks, drafts, notes
- [x] 3.3 Implement `scrollTo` handler: find element by `data-ai-target`, `scrollIntoView`, apply highlight CSS class
- [x] 3.4 Implement `expand` handler: find thread group by `data-ai-target`, trigger expand state via custom event
- [x] 3.5 Add CSS highlight animation: temporary prominent border/glow that fades after ~2 seconds
- [x] 3.6 Execute action after `done` event is processed (after assistant message is added to chat)

### 4. Integration
- [ ] 4.1 Verify end-to-end: user asks "show me the draft", AI returns scrollTo action + text response, frontend scrolls and highlights the draft
- [ ] 4.2 Verify context enrichment: user asks "what do you think of this draft?", AI answers from full draft body in page context

### Phase 2: Navigate action (deferred)
- [ ] 5.1 Add `navigate` action type to protocol
- [ ] 5.2 Frontend executes navigation via Next.js router
- [ ] 5.3 Wait for new page context to load, send updated context back to AI for second turn
