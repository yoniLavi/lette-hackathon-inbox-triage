# agent-container Specification

## Purpose
The clawling TypeScript agent framework runs as a Docker service, providing an OpenAI-compatible HTTP gateway that routes between a fast Frontend Agent (Bedrock Messages API) and an autonomous Worker Agent (Claude Agent SDK).

## Requirements

### Requirement: Agent Gateway
The clawling container SHALL expose an OpenAI-compatible HTTP gateway on port 8001.

#### Scenario: Gateway health check
- **WHEN** `GET /health` is called
- **THEN** the response is `{"status":"ok"}`

#### Scenario: Ad-hoc prompt via CLI
- **WHEN** a user runs `npx tsx scripts/agent.ts "List all open cases"`
- **THEN** the script calls `POST /v1/chat/completions` with model `clawling/frontend`
- **AND** returns the response to stdout

### Requirement: Bedrock Authentication
The clawling container SHALL authenticate with Claude via AWS Bedrock using a bearer token.

#### Scenario: Bedrock credentials from environment
- **WHEN** `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_BEARER_TOKEN_BEDROCK`, and `AWS_REGION` are set
- **THEN** both the Frontend Agent (Bedrock SDK) and Worker Agent (Claude Agent SDK) use Bedrock as the model provider

### Requirement: CRM CLI Access
The Worker Agent SHALL have access to the `crm` CLI for all CRM operations.

#### Scenario: CLI available in worker workspace
- **WHEN** the worker agent runs a Bash command `crm cases list`
- **THEN** the CLI calls the CRM API at `http://crm-api:8002` and returns JSON output
- **AND** the agent workspace is mounted at `/workspace` with `CLAUDE.md` and `.claude/commands/`

### Requirement: Two-Tier AI Architecture
The gateway SHALL route requests to two distinct AI backends.

#### Scenario: Frontend agent routing
- **WHEN** `POST /v1/chat/completions` is called with model `clawling/frontend`
- **THEN** the Frontend Agent (Bedrock Messages API, fast) handles the request
- **AND** responds in under 5 seconds for context-only queries

#### Scenario: Worker agent routing
- **WHEN** `POST /v1/wake/worker` is called with a prompt
- **THEN** the Worker Agent (Claude Agent SDK, autonomous) starts a background task
- **AND** returns a `taskId` immediately for status polling
