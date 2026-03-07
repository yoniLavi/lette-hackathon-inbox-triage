## 1. Research & Decision
- [ ] 1.1 Test whether Claude Code SDK supports subagent/task spawning (Agent tool) via ClaudeSDKClient — can we observe subagent progress in receive_response()?
- [ ] 1.2 If Option A viable: prototype CLAUDE.md instructions for background delegation, verify agent follows them
- [ ] 1.3 If Option B: prototype a lightweight conversational AI layer (direct Claude API in FastAPI) that dispatches to the Claude Code worker async
- [ ] 1.4 Decide on approach based on feasibility and complexity
- [ ] 1.5 Optimize CLAUDE.md to reduce unnecessary CRM queries (single search with high limit, avoid pagination loops)

## 2. Implementation
- [ ] 2.1 Implement chosen approach
- [ ] 2.2 Ensure user gets an immediate acknowledgment (< 2s) for any query
- [ ] 2.3 Stream CRM results back to user as they arrive

## 3. Validation
- [ ] 3.1 Test: user gets a meaningful response within 3s of sending a message
- [ ] 3.2 Test: CRM data arrives via streaming updates, not blocking the initial response
- [ ] 3.3 Test: multi-turn conversation still works with the new architecture
