# agent-container Specification

## Purpose
TBD - created by archiving change add-agent-container. Update Purpose after archive.
## Requirements
### Requirement: Agent Container
The system SHALL provide a Docker container that runs Claude Code in headless mode with access to EspoCRM via the EspoMCP MCP server.

#### Scenario: Ad-hoc prompt execution
- **WHEN** a user runs `docker compose run agent "List all emails"`
- **THEN** Claude Code executes the prompt with EspoMCP tools available
- **AND** returns the result to stdout

#### Scenario: EspoCRM connectivity
- **WHEN** the agent container starts
- **THEN** it can reach EspoCRM at `http://espocrm` on the Docker network
- **AND** authenticates via API key

### Requirement: Bedrock Authentication
The agent container SHALL authenticate with Claude via AWS Bedrock using a bearer token and configurable region.

#### Scenario: Bedrock credentials from environment
- **WHEN** `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_BEARER_TOKEN_BEDROCK`, and `AWS_REGION` are set in `.env`
- **THEN** Claude Code uses Bedrock as the model provider

### Requirement: Automatic API User Provisioning
The system SHALL automatically create an EspoCRM API user for the agent, without manual UI steps.

#### Scenario: First-time setup
- **WHEN** `scripts/create_api_user.py` runs against a fresh EspoCRM instance
- **THEN** an API user named "Agent" is created with full access
- **AND** the API key is printed to stdout

#### Scenario: Idempotent re-run
- **WHEN** the script runs and the "Agent" API user already exists
- **THEN** it prints the existing API key without creating a duplicate

### Requirement: MCP Configuration
The agent container SHALL configure EspoMCP as a stdio MCP server, with the EspoCRM URL and API key injected via environment variables.

#### Scenario: MCP server startup
- **WHEN** Claude Code starts with `--mcp-config /app/mcp.json`
- **THEN** EspoMCP launches as a stdio child process
- **AND** connects to EspoCRM using the configured URL and API key

