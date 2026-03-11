## 1. Research & Decision
- [x] 1.1 Test whether Claude Code SDK supports subagent/task spawning (Agent tool) via ClaudeSDKClient
- [x] 1.2 Prototype lightweight conversational AI layer options
- [x] 1.3 Decide on approach: Two-layer architecture (Frontend AI + Worker AI + delegation)

## 2. Page context enrichment (frontend)
- [x] 2.1 Create `page-context.tsx` with structured context types and builder helpers
- [x] 2.2 Dashboard: include case count, top cases with action status, stats
- [x] 2.3 Situation detail: include full case details, tasks, drafts, contacts
- [x] 2.4 Properties/Search: include relevant on-screen data
- [x] 2.5 Wire up `serializePageContext()` in AIAssistant to send JSON context with each prompt

## 3. Delegation MCP server (v1 — replaced in section 9)
- [x] 3.1 Create `agent/mcp_worker.py` — MCP server with delegate_to_worker and get_worker_result tools
- [x] 3.2 delegate_to_worker: queue prompt, spawn Worker query in background task, return task ID immediately
- [x] 3.3 get_worker_result: return response text if done, or "still working" status (waits up to 60s)
- [x] 3.4 Worker uses existing ClaudeSDKClient with WORKER_OPTIONS (cwd=/workspace, bypassPermissions)

## 4. Frontend AI session (v1 — replaced in section 9)
- [x] 4.1 Create Frontend AI ClaudeCodeOptions — Sonnet model, system prompt, MCP server config
- [x] 4.2 Frontend AI system prompt: page context rules, delegation instructions, never-block contract
- [x] 4.3 Wire up Frontend AI session lifecycle (_ensure_frontend, _teardown_frontend)

## 5. Two-tier streaming endpoint (v1 — worker streamed in same SSE; replaced by non-blocking in section 11)
- [x] 5.1 Rewrite `POST /prompt/stream` — route all user messages through Frontend AI
- [x] 5.2 Stream Frontend AI text events (acknowledgments, context-based answers) immediately
- [x] 5.3 Stream Worker progress (tool_use events) via shared SSE queue as they arrive
- [x] 5.4 Emit `done` event with final combined response

## 6. Integration & cleanup
- [x] 6.1 Update `POST /session/restart` to teardown both sessions
- [x] 6.2 Update `GET /session/status` to report both sessions (with backward-compat fields)
- [x] 6.3 Keep `POST /shift` endpoint unchanged (uses Worker directly)
- [x] 6.4 Update Dockerfile and docker-compose.yml for mcp_worker.py

## 7. Frontend adjustments (v1 — two-phase SSE; replaced by polling in section 11)
- [x] 7.1 Verify AIAssistant SSE handling supports two-phase response pattern
- [x] 7.2 Verify streaming UX: acknowledgment visible, tool progress, then CRM results replace

## 8. Testing & validation (v1)
- [x] 8.1 Integration tests: 24/24 passed (test_agent_api.py + test_crm_api.py)
- [x] 8.2 E2E chat tests: 10/10 passed (test_chat_e2e.sh)
- [x] 8.3 Timed tests: fast path 3.7-8.2s, CRM delegation 20-52s with two-phase streaming

## 9. Direct API for Frontend AI (v2 — bypass Claude Code SDK overhead)
- [x] 9.1 Add `anthropic` to agent/pyproject.toml dependencies
- [x] 9.2 Create `agent/frontend_ai.py` — direct Bedrock Messages API client
  - AnthropicBedrock client with aws_bearer_token + aws_region from env
  - In-process conversation history (list of messages)
  - System prompt (reuse existing FRONTEND_SYSTEM_PROMPT)
  - Tool definition: delegate_to_worker (fire-and-forget, no get_worker_result)
  - Non-streaming messages.create() via asyncio.to_thread (avoids blocking event loop)
  - Tool execution loop: when model returns tool_use, execute in-process, send tool_result, continue
- [x] 9.3 Implement in-process tool dispatch (replaces MCP server for frontend)
  - delegate_to_worker: reuse existing _run_worker logic from mcp_worker.py
  - Worker tool_use events pushed to SSE queue (v1; replaced by polling in v3)
- [x] 9.4 Update api.py: replace ClaudeSDKClient frontend with frontend_ai module
  - _ensure_frontend / _teardown_frontend now manage FrontendAI instance + message history
  - /prompt/stream _consume() calls frontend_ai.chat() instead of SDK
  - /prompt (non-streaming) also uses frontend_ai.chat()
  - Session restart clears conversation history
- [x] 9.5 Update docker-compose.yml: bind-mount frontend_ai.py
- [x] 9.6 Simplify mcp_worker.py: remove MCP server creation, keep only worker dispatch logic

## 10. Testing & validation (v2)
- [x] 10.1 Integration tests pass (24/24)
- [x] 10.2 E2E chat tests pass (10/10)
- [x] 10.3 Timed tests: fast path avg=2.9s, max=4.8s — all under 5s target
- [x] 10.4 Timed tests: CRM delegation 36s with two-phase streaming and worker tool progress
- [x] 10.5 Playwright E2E tests (12/12): dashboard, chat open/close, send/receive, multi-turn,
  context-aware, streaming loading state, input disabled, CRM delegation tool progress,
  markdown rendering, page navigation persistence

## 11. Non-blocking delegation UX (v3 — user can chat during worker execution)
- [x] 11.1 Backend: SSE stream closes immediately after Frontend AI acknowledgment
- [x] 11.2 Backend: Worker runs in background via `_background_worker_complete()`, results stored for polling
- [x] 11.3 Backend: Add `GET /worker/status` polling endpoint (returns result once, then clears)
- [x] 11.4 Backend: `/prompt` and `/prompt/stream` return `worker_task_id` in response
- [x] 11.5 Backend: Frontend AI available for new messages while worker runs (concurrent chat)
- [x] 11.6 Backend: Graceful error handling when delegate fails (worker busy → tool_result error)
- [x] 11.7 Frontend: Input re-enables immediately after acknowledgment (stream closes on `done`)
- [x] 11.8 Frontend: Poll `/worker/status` every 2s when `workerTaskId` is set
- [x] 11.9 Frontend: Worker result appears as new assistant message via polling
- [x] 11.10 Frontend: "Searching CRM..." indicator (header status + chat bubble) while worker runs
- [x] 11.11 Validated: delegation returns in 5.4s, follow-up chat in 2.1s, worker result in ~20s
- [x] 11.12 Integration tests: 24/24 passed
- [x] 11.13 Updated Playwright E2E: non-blocking delegation test replaces old blocking test
