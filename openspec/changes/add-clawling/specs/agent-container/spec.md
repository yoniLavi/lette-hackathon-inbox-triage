## REMOVED Requirements

### Requirement: Agent Container
**Reason**: Replaced by clawling's Node-only Docker container. No more Python/FastAPI. The container runs Hono on Node with Claude Agent SDK in-process.
**Migration**: `agent/Dockerfile` → `clawling/Dockerfile` (node:20 base, no Python/uv layer).

### Requirement: Bedrock Authentication
**Reason**: Preserved in clawling via the same environment variables. The Claude Agent SDK uses `CLAUDE_CODE_USE_BEDROCK` and `AWS_BEARER_TOKEN_BEDROCK` natively.
**Migration**: Same `.env` variables, passed to clawling container.

### Requirement: Automatic API User Provisioning
**Reason**: Was for EspoCRM (no longer used). CRM API uses direct PostgreSQL access.
**Migration**: Already removed in practice; formally removing from spec.

### Requirement: MCP Configuration
**Reason**: Replaced by clawling's config-driven MCP tool registration. Custom tools (like crm CLI) are defined in `config.json` and exposed via `createSdkMcpServer()`.
**Migration**: MCP config → clawling `config.tools` section.
