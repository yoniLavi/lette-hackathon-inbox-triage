## 1. Research & Decision
- [ ] 1.1 Investigate Claude Code SDK capabilities for subagent/task spawning — does `ClaudeSDKClient` support spawning parallel tasks? Can the agent be instructed to use background workers?
- [ ] 1.2 Measure current tool call latency — profile typical CRM queries (search_entity, get_entity) to establish baseline
- [ ] 1.3 Decide on approach (Option A / B / C from proposal) based on SDK capabilities and complexity budget
- [ ] 1.4 If Option A: draft system prompt additions for `agent/workspace/CLAUDE.md` that instruct parallel/batched tool use
- [ ] 1.5 If Option B: prototype async tool interception in `api.py`

## 2. Implementation
- [ ] 2.1 Implement chosen approach
- [ ] 2.2 Add SSE events for partial/incremental results if applicable (e.g., `event: partial` with tool output summaries)

## 3. Validation
- [ ] 3.1 Measure response latency for typical queries before and after
- [ ] 3.2 Add test to `tests/test_chat_e2e.sh` — CRM query response time under 30s
- [ ] 3.3 Test that streaming updates appear within 5s of request start
