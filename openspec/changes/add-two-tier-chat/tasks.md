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
  - Two tool definitions: delegate_to_worker, get_worker_result (JSON schema)
  - Non-streaming messages.create() via asyncio.to_thread (avoids blocking event loop)
  - Tool execution loop: when model returns tool_use, execute in-process, send tool_result, continue
- [x] 9.3 Implement in-process tool dispatch (replaces MCP server for frontend)
  - delegate_to_worker: reuse existing _run_worker logic from mcp_worker.py
  - get_worker_result: reuse existing future-based polling logic
  - Worker tool_use events still pushed to SSE queue
- [x] 9.4 Update api.py: replace ClaudeSDKClient frontend with frontend_ai module
  - _ensure_frontend / _teardown_frontend now manage FrontendAI instance + message history
  - /prompt/stream _consume() calls frontend_ai.chat() instead of SDK
  - /prompt (non-streaming) also uses frontend_ai.chat()
  - Session restart clears conversation history
- [x] 9.5 Update docker-compose.yml: bind-mount frontend_ai.py
- [x] 9.6 Simplify mcp_worker.py: remove MCP server creation, keep only worker dispatch logic

## 10. Testing & validation (v2)
- [ ] 10.1 Integration tests pass (24/24)
- [ ] 10.2 E2E chat tests pass (10/10)
- [ ] 10.3 Timed tests: fast path < 3s (context-only, no tool calls)
- [ ] 10.4 Timed tests: CRM delegation still shows two-phase streaming with worker progress
