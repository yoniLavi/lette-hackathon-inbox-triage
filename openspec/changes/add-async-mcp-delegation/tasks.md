## 1. Research & Decision
- [ ] 1.1 Test whether Claude Code SDK supports subagent/task spawning (Agent tool) via ClaudeSDKClient — can we observe subagent progress in receive_response()?
- [ ] 1.2 If Option A viable: prototype CLAUDE.md instructions for background delegation, verify agent follows them
- [ ] 1.3 If Option B: prototype a lightweight conversational AI layer (direct Claude API in FastAPI) that dispatches to the Claude Code worker async
- [ ] 1.4 Decide on approach based on feasibility and complexity
- [ ] 1.5 Optimize CLAUDE.md to reduce unnecessary CRM queries (single search with high limit, avoid pagination loops)

## 2. Page context enrichment
- [ ] 2.1 Enrich `usePageContext()` to pass actual on-screen data (not just page description) as structured context with each prompt
- [ ] 2.2 Dashboard: include case count, top cases with action status, stats (pending tasks, drafts, resolved)
- [ ] 2.3 Situation detail: include full case object (name, priority, status, property, task count, draft count, contact names)
- [ ] 2.4 Properties/Search: include relevant on-screen data
- [ ] 2.5 Instruct the AI (via system prompt or CLAUDE.md) to answer from provided page context when possible, only querying CRM for data not already on screen

## 3. Implementation
- [ ] 3.1 Implement chosen approach (Option A or B)
- [ ] 3.2 Ensure user gets an immediate acknowledgment (< 2s) for any query
- [ ] 3.3 Stream CRM results back to user as they arrive

## 4. Validation
- [ ] 4.1 Test: user gets a meaningful response within 3s of sending a message
- [ ] 4.2 Test: questions about on-screen data answered from context alone (no CRM calls)
- [ ] 4.3 Test: CRM data arrives via streaming updates, not blocking the initial response
- [ ] 4.4 Test: multi-turn conversation still works with the new architecture
