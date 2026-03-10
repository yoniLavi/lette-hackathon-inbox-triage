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
- [x] 3.1 Create `agent/mcp_worker.py` — MCP server with `delegate_to_worker(prompt)` and `get_worker_result(task_id)` tools
- [x] 3.2 `delegate_to_worker`: queue prompt, spawn Worker query in background task, return task ID immediately
- [x] 3.3 `get_worker_result`: return response text if done, or "still working" status (waits up to 60s)
- [x] 3.4 Worker uses existing `ClaudeSDKClient` with `WORKER_OPTIONS` (cwd=/workspace, bypassPermissions)

## 4. Frontend AI session
- [x] 4.1 Create Frontend AI `ClaudeCodeOptions` — Sonnet model, system prompt, MCP server config pointing to delegation MCP
- [x] 4.2 Frontend AI system prompt: page context rules, delegation instructions, never-block contract
- [x] 4.3 Wire up Frontend AI session lifecycle (`_ensure_frontend`, `_teardown_frontend`)

## 5. Two-tier streaming endpoint
- [x] 5.1 Rewrite `POST /prompt/stream` — route all user messages through Frontend AI
- [x] 5.2 Stream Frontend AI text events (acknowledgments, context-based answers) immediately
- [x] 5.3 Stream Worker progress (tool_use events) via shared SSE queue as they arrive
- [x] 5.4 Emit `done` event with final combined response

## 6. Integration & cleanup
- [x] 6.1 Update `POST /session/restart` to teardown both sessions
- [x] 6.2 Update `GET /session/status` to report both sessions (with backward-compat fields)
- [x] 6.3 Keep `POST /shift` endpoint unchanged (uses Worker directly)
- [x] 6.4 Update Dockerfile and docker-compose.yml for mcp_worker.py

## 7. Frontend adjustments
- [x] 7.1 Verify AIAssistant SSE handling supports two-phase response pattern — already implemented (text events replace, tool_use events show as status)
- [x] 7.2 Verify streaming UX: acknowledgment visible immediately, tool progress overlay, then CRM results replace — already working

## 8. Testing & validation
- [x] 8.1 Integration tests: 24/24 passed (test_agent_api.py + test_crm_api.py)
- [x] 8.2 E2E chat tests: 10/10 passed (test_chat_e2e.sh) — includes CRM delegation, multi-turn, streaming events
- [x] 8.3 test_chat_e2e.sh works as-is with new architecture (no changes needed)
