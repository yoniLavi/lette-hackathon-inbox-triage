## 1. Research & Decision
- [x] 1.1 Test whether Claude Code SDK supports subagent/task spawning (Agent tool) via ClaudeSDKClient
- [x] 1.2 Prototype lightweight conversational AI layer options
- [x] 1.3 Decide on approach: Two-layer Claude Code architecture (Frontend AI + Worker AI + MCP delegation)

## 2. Page context enrichment (frontend)
- [x] 2.1 Create `page-context.tsx` with structured context types and builder helpers
- [x] 2.2 Dashboard: include case count, top cases with action status, stats
- [x] 2.3 Situation detail: include full case details, tasks, drafts, contacts
- [x] 2.4 Properties/Search: include relevant on-screen data
- [x] 2.5 Wire up `serializePageContext()` in AIAssistant to send JSON context with each prompt

## 3. Delegation MCP server
- [ ] 3.1 Create `agent/mcp_worker.py` — MCP server with `delegate_to_worker(prompt)` and `get_worker_result(task_id)` tools
- [ ] 3.2 `delegate_to_worker`: queue prompt, spawn Worker query in background task, return task ID immediately
- [ ] 3.3 `get_worker_result`: return response text if done, or "still working" status
- [ ] 3.4 Worker uses existing `ClaudeSDKClient` with `WORKER_OPTIONS` (cwd=/workspace, bypassPermissions)

## 4. Frontend AI session
- [ ] 4.1 Create Frontend AI `ClaudeCodeOptions` — smart model (Sonnet), system prompt, MCP server config pointing to delegation MCP
- [ ] 4.2 Frontend AI system prompt: page context rules, delegation instructions, never-block contract
- [ ] 4.3 Wire up Frontend AI session lifecycle (`_ensure_frontend`, `_teardown_frontend`)

## 5. Two-tier streaming endpoint
- [ ] 5.1 Rewrite `POST /prompt/stream` — route all user messages through Frontend AI
- [ ] 5.2 Stream Frontend AI text events (acknowledgments, context-based answers) immediately
- [ ] 5.3 Stream Worker progress (tool_use events) and results as they arrive
- [ ] 5.4 Emit `done` event with final combined response

## 6. Integration & cleanup
- [ ] 6.1 Update `POST /session/restart` to teardown both sessions
- [ ] 6.2 Update `GET /session/status` to report both sessions
- [ ] 6.3 Keep `POST /shift` endpoint unchanged (uses Worker directly)
- [ ] 6.4 Update `agent/workspace/CLAUDE.md` page context section if needed for Worker

## 7. Frontend adjustments
- [ ] 7.1 Update AIAssistant SSE handling for two-phase response pattern (fast text → worker text replacement)
- [ ] 7.2 Verify streaming UX: acknowledgment visible immediately, then CRM results replace/append

## 8. Testing & validation
- [ ] 8.1 Test: context-only questions answered in < 3s with no CRM calls
- [ ] 8.2 Test: CRM questions get immediate acknowledgment, then async results
- [ ] 8.3 Test: multi-turn conversation works across both AI sessions
- [ ] 8.4 Test: /shift still works (Worker-only path)
- [ ] 8.5 Update test_chat_e2e.sh for new architecture
