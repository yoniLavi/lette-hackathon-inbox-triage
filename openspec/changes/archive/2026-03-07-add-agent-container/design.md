## Context
We need a Docker container that runs Claude Code in headless mode (`-p`) with access to EspoCRM via the EspoMCP stdio MCP server. This is the runtime for the email triage agent. A reference implementation exists at `/Users/yoni/codeliance/codeliance-stack/evaluator` but is far more complex (ephemeral per-job containers, Python SDK orchestration, firewalls). We take only the minimal patterns we need.

## Goals / Non-Goals
- Goals:
  - Container with Claude Code CLI + EspoMCP, invocable via `docker compose run`
  - Fully automatic API user provisioning (no manual EspoCRM UI steps)
  - Bedrock authentication (AWS bearer token, eu-west-1 default)
  - Ad-hoc prompt execution against the CRM for now
- Non-Goals:
  - Agent loop / session management (future work)
  - Firewall / network restrictions
  - Python Agent SDK integration (CLI is sufficient for now)
  - Frontend integration

## Decisions

### Claude Code via CLI, not SDK
The reference project uses the Python Agent SDK for programmatic control. For our hackathon PoC, the CLI with `-p` flag is simpler and sufficient. We can upgrade later.

### Bedrock auth via bearer token
Following the reference project pattern: `CLAUDE_CODE_USE_BEDROCK=1` + `AWS_BEARER_TOKEN_BEDROCK` + `AWS_REGION`. These are provided in `.env` and passed to the container.

### EspoMCP as stdio MCP server inside the container
EspoMCP runs as a stdio child process of Claude Code, configured via `--mcp-config /app/mcp.json`. The MCP config references `ESPOCRM_URL=http://espocrm` (Docker internal networking, port 80). The API key is passed via environment variable.

### Automatic API user creation
A Python script (`scripts/create_api_user.py`) creates an EspoCRM API user via the REST API (POST to `/api/v1/ApiUser`) with an admin role. It's idempotent — skips if the user already exists. The generated API key is printed to stdout so it can be captured. The seed script calls this automatically.

### Entrypoint wrapper script
A small `agent/entrypoint.sh` script runs Claude Code with the right flags:
- `--mcp-config /app/mcp.json` — load EspoMCP
- `--dangerously-skip-permissions` — no interactive prompts
- `--allowedTools` with all MCP tools auto-approved
- `-p` flag with the user's prompt

### Base image: node:20-slim
Minimal Node.js image. Claude Code installed via `npm install -g @anthropic-ai/claude-code`. EspoMCP cloned and built at image build time.

## Risks / Trade-offs
- `--dangerously-skip-permissions` gives the agent full tool access — acceptable for hackathon PoC, not for production
- API user has full admin access — acceptable for PoC, should be scoped down later
- EspoMCP is cloned from GitHub at build time — pinning to a commit hash would be more reproducible

## Open Questions
- None blocking for PoC
