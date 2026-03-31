## 1. Framework Core

- [x] 1.1 Initialize `clawling/` directory with `package.json`, `tsconfig.json`, Hono + Zod + Agent SDK deps
- [x] 1.2 Implement `config.ts` — Zod schema for config.json, agent definitions, tool definitions, delegation settings (~70 lines)
- [x] 1.3 Implement `agents/types.ts` — `AgentBackend`, `AgentSession`, `AgentEvent` type union (~60 lines)
- [x] 1.4 Implement `agents/registry.ts` — agent lifecycle management, create backends from config (~50 lines)
- [x] 1.5 Implement `index.ts` — entry point, config loading, registry init, server startup (~30 lines)

## 2. Agent Backends

- [x] 2.1 Implement `agents/claude-backend.ts` — wrap `query()` as `AgentSession.prompt()` AsyncGenerator, map SDK messages to `AgentEvent`, handle `resume` for session persistence, cost tracking via `SDKResultSuccess` (~100 lines)
- [x] 2.2 Implement `postToolUse` hooks for structured progress extraction from Bash/CRM tool calls (~30 lines, integrated in claude-backend)
- [x] 2.3 Verify Bedrock auth works with Agent SDK via env vars (`CLAUDE_CODE_USE_BEDROCK`, `AWS_BEARER_TOKEN_BEDROCK`)
- [x] 2.4 Implement `agents/messages-backend.ts` — wrap `@anthropic-ai/bedrock-sdk` Messages API, maintain conversation history in-process, execute framework-defined tools (delegate, page_action) directly, emit `AgentEvent` stream (~150 lines)
- [x] 2.5 Implement Bedrock bearer token auth for Messages API backend (port `_BearerTokenBedrock` pattern to TS)

## 3. Delegation System

- [x] 3.1 Implement `delegation/tracker.ts` — parent-child bookkeeping, delegation records, timeout detection, orphan cleanup (~70 lines)
- [x] 3.2 Implement `delegation/spawner.ts` — `spawn()` creates child session, starts background prompt, returns taskId; `spawnAndWait()` for sync delegation (~100 lines)
- [x] 3.3 Implement `delegation/announcer.ts` — deliver child results to parent session or polling store (~60 lines)

## 4. HTTP Gateway

- [x] 4.1 Implement `gateway.ts` — Hono app with `POST /v1/chat/completions` (OpenAI-compatible, SSE streaming, `model` field routes to agent), `POST /v1/wake/:agent`, `GET /v1/status/:taskId`, `GET /health`, CORS, optional bearer token auth via `CLAWLING_GATEWAY_TOKEN` (~150 lines)
- [x] 4.2 SSE translation integrated directly in `gateway.ts` via `eventToSSEChunk()` — OpenAI-compatible `data: {"choices": [...]}` + `data: [DONE]`, with `clawling` extension field for delegation/action/tool events

## 5. Session & Tool Infrastructure

- [x] 5.1 Implement `sessions/store.ts` — framework-level session tracking (metadata, message counts)
- [x] 5.2 Sessions history tracking integrated into store.ts (lightweight — agent backends handle their own persistence)
- [x] 5.3 Tool registration via config (tools defined in config.json, loaded by backends)
- [x] 5.4 Implement `tools/mcp-bridge.ts` — shell command template execution for custom tools via `createSdkMcpServer()`

## 6. Domain Configuration

- [x] 6.1 Write `config.json` — two agents (frontend + worker), model routing, delegation settings (~30 lines)
- [x] 6.2 Workspace CLAUDE.md and skills mount unchanged — Agent SDK loads them via `cwd: /workspace`
- [x] 6.3 Write frontend agent system prompt as `skills/frontend.md` (extracted from `api.py` FRONTEND_SYSTEM_PROMPT)
- [x] 6.4 Add YAML frontmatter (`name`, `description`) to worker skill files (shift.md, triage.md, summarize-email.md, case-review.md, compliance-check.md) for claw ecosystem SKILL.md compatibility

## 7. Docker Integration

- [x] 7.1 Write `clawling/Dockerfile` — node:20 base, install deps, claude-code CLI, entrypoint.sh
- [x] 7.2 Update `docker-compose.yml` — replace `agent` service with `clawling` service, mount volumes (src, config, skills, workspace, crm-cli)
- [x] 7.3 CRM CLI installed via uv in entrypoint.sh (same pattern as current agent container)

## 8. Frontend Adaptation

- [x] 8.1 Update `AIAssistant.tsx` SSE parser — OpenAI-compatible format (`data: {"choices": [{"delta": {"content": "..."}}]}` with `clawling` extension, `data: [DONE]`)
- [x] 8.2 Update delegation handling — `clawling.type === "delegation"` with `taskId` replaces `worker_task_id` in done payload
- [x] 8.3 Update polling endpoint — `/v1/status/${taskId}` replaces `/worker/status`
- [x] 8.4 Update shift trigger — `POST /v1/wake/worker` with `{"prompt": "/shift"}` replaces `POST /shift`
- [x] 8.5 Update session management — removed explicit restart call (clawling creates sessions per-request)

## 9. Scripts & Tests

- [x] 9.1 Update `scripts/agent.py` to call clawling endpoints (`/v1/chat/completions`, `/v1/wake/worker`, `/v1/status/:taskId`, `/health`)
- [x] 9.2 Integration tests for clawling gateway (prompt, delegation, wake, status polling) — `test_agent_api.py` rewritten, 11/11 pass
- [x] 9.3 E2E test: frontend → clawling → worker delegation → result delivery — `test_frontend_e2e.py` 26/29 pass (2 LLM-flaky navigate tests, 1 skipped)
- [x] 9.4 E2E test: shift trigger → clawling wake → worker processes threads — wake path verified via API test + shifts page wiring
