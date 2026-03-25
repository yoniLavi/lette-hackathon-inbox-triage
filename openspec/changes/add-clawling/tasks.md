## 1. Framework Core

- [ ] 1.1 Initialize `clawling/` directory with `package.json`, `tsconfig.json`, Hono + Zod + Agent SDK deps
- [ ] 1.2 Implement `config.ts` — Zod schema for config.json, agent definitions, tool definitions, delegation settings (~70 lines)
- [ ] 1.3 Implement `agents/types.ts` — `AgentBackend`, `AgentSession`, `AgentEvent` type union (~60 lines)
- [ ] 1.4 Implement `agents/registry.ts` — agent lifecycle management, create backends from config (~50 lines)
- [ ] 1.5 Implement `index.ts` — entry point, config loading, registry init, server startup (~30 lines)

## 2. Agent Backends

- [ ] 2.1 Implement `agents/claude-backend.ts` — wrap `query()` as `AgentSession.prompt()` AsyncGenerator, map SDK messages to `AgentEvent`, handle `resume` for session persistence, cost tracking via `SDKResultSuccess` (~100 lines)
- [ ] 2.2 Implement `postToolUse` hooks for structured progress extraction from Bash/CRM tool calls (~30 lines, integrated in claude-backend)
- [ ] 2.3 Verify Bedrock auth works with Agent SDK via env vars (`CLAUDE_CODE_USE_BEDROCK`, `AWS_BEARER_TOKEN_BEDROCK`)
- [ ] 2.4 Implement `agents/messages-backend.ts` — wrap `@anthropic-ai/bedrock-sdk` Messages API, maintain conversation history in-process, execute framework-defined tools (delegate, page_action) directly, emit `AgentEvent` stream (~150 lines)
- [ ] 2.5 Implement Bedrock bearer token auth for Messages API backend (port `_BearerTokenBedrock` pattern to TS)

## 3. Delegation System

- [ ] 3.1 Implement `delegation/tracker.ts` — parent-child bookkeeping, delegation records, timeout detection, orphan cleanup (~70 lines)
- [ ] 3.2 Implement `delegation/spawner.ts` — `spawn()` creates child session, starts background prompt, returns taskId; `spawnAndWait()` for sync delegation (~100 lines)
- [ ] 3.3 Implement `delegation/announcer.ts` — deliver child results to parent session or polling store (~60 lines)

## 4. HTTP Gateway

- [ ] 4.1 Implement `gateway.ts` — Hono app with `POST /v1/chat/completions` (OpenAI-compatible, SSE streaming, `model` field routes to agent), `POST /v1/wake/:agent`, `GET /v1/status/:taskId`, `GET /health`, CORS, optional bearer token auth via `CLAWLING_GATEWAY_TOKEN` (~150 lines)
- [ ] 4.2 Implement `channels/http.ts` — translate `AgentEvent` generator to OpenAI-compatible SSE stream (`data: {"choices": [...]}` + `data: [DONE]`), with `clawling` extension field for delegation/action/tool events, `x-clawling-session-id` header handling (~90 lines)

## 5. Session & Tool Infrastructure

- [ ] 5.1 Implement `sessions/store.ts` — JSONL persistence for delegation records and session metadata (~80 lines)
- [ ] 5.2 Implement `sessions/history.ts` — message tracking, token estimates, activity timestamps (~50 lines)
- [ ] 5.3 Implement `tools/registry.ts` — load custom tool definitions from config (~40 lines)
- [ ] 5.4 Implement `tools/mcp-bridge.ts` — lightweight MCP server via `createSdkMcpServer()` for custom tools (~80 lines)

## 6. Domain Configuration

- [ ] 6.1 Write `config.json` — two agents (frontend + worker), model routing, crm tool definition, delegation settings (~60 lines)
- [ ] 6.2 Adapt `workspace/CLAUDE.md` and `workspace/.claude/commands/*.md` skills for clawling mounting (AGENTS.md is source of truth, CLAUDE.md symlinks to it — verify paths work with Agent SDK's cwd)
- [ ] 6.3 Write frontend agent system prompt as `skills/frontend.md` (extract from current `api.py` FRONTEND_SYSTEM_PROMPT)
- [ ] 6.4 Add YAML frontmatter (`name`, `description`) to worker skill files (shift.md, triage.md, summarize-email.md, case-review.md, compliance-check.md) for claw ecosystem SKILL.md compatibility

## 7. Docker Integration

- [ ] 7.1 Write `clawling/Dockerfile` — node:20 base, install deps, mount workspace/skills/config
- [ ] 7.2 Update `docker-compose.yml` — replace `agent` service with `clawling` service, mount volumes
- [ ] 7.3 Install `crm-cli` in clawling container (mount from host, same as current agent container)

## 8. Frontend Adaptation

- [ ] 8.1 Update `AIAssistant.tsx` SSE parser — adapt to OpenAI-compatible SSE format (`data: {"choices": [{"delta": {"content": "..."}}]}` with `clawling` extension field for tool/delegation/action events, `data: [DONE]` terminator)
- [ ] 8.2 Update delegation handling — `delegation` event type replaces `worker_task_id` in done payload
- [ ] 8.3 Update polling endpoint — `/v1/status/:taskId` replaces `/worker/status`
- [ ] 8.4 Update shift trigger — `POST /v1/wake/worker` replaces `POST /shift`
- [ ] 8.5 Update session management — adapt restart/status calls to clawling endpoints

## 9. Scripts & Tests

- [ ] 9.1 Update `scripts/agent.py` to call clawling endpoints (or rewrite as TS script)
- [ ] 9.2 Integration tests for clawling gateway (prompt, delegation, wake, status polling)
- [ ] 9.3 E2E test: frontend → clawling → worker delegation → result delivery
- [ ] 9.4 E2E test: shift trigger → clawling wake → worker processes threads → CRM updates
