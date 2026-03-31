# Change: Replace Python agent server with Clawling — a lightweight TS agent orchestration framework

## Why
The agent server (`agent/*.py`, ~1,339 lines of Python) implements session management, worker delegation, SSE streaming, and shift orchestration as tightly-coupled custom code. Meanwhile, the frontend is already TypeScript (Next.js, ~5,700 lines), creating a dual-language stack with duplicated types and no shared modules. The `@anthropic-ai/claude-agent-sdk` now provides a native TypeScript programmatic API for Claude Code's agent capabilities (no subprocess), making a TS rewrite viable and cleaner.

Clawling extracts the orchestration pattern into a reusable, provider-agnostic framework with **multi-level AI delegation as a first-class citizen** — the core architectural insight from this project. The framework runs as a single Docker container, configured via JSON + mounted skill files.

## What Changes
- **NEW** `clawling/` directory — TypeScript agent orchestration framework (~1,160 lines)
  - Dual-backend agent interface: Claude Agent SDK (primary), ACP (future)
  - Delegation primitives: `spawn()`, track parent-child lifecycle, announce results
  - HTTP gateway with SSE streaming (OpenAI-compatible events + extensions)
  - Session persistence (JSONL)
  - Custom tool registration via MCP bridge
  - Config-driven agent definitions (model, tools, permissions, system prompt per agent)
- **REMOVED** `agent/` directory — Python FastAPI server (api.py, frontend_ai.py, mcp_worker.py)
- **MODIFIED** `docker-compose.yml` — replace Python agent container with Node-only clawling container
- **MODIFIED** frontend `AIAssistant.tsx` — adapt SSE event parsing to clawling's event format
- **UNCHANGED** `crm/` — CRM API stays in Python (can port later)
- **UNCHANGED** `agent/workspace/` — CLAUDE.md and skill files mount into clawling
- **UNCHANGED** `crm-cli/` — still installed in the clawling container for agent tool access

## Impact
- Affected specs: agent-api (replaced), agent-container (replaced), docker-stack (modified)
- New spec: clawling
- Affected code: agent/ (removed), clawling/ (new), frontend/src/components/dashboard/AIAssistant.tsx, docker-compose.yml
