## MODIFIED Requirements

### Requirement: Agent Container
The agent container SHALL provide Claude Code SDK with access to CRM data via a CLI tool, replacing EspoMCP.

#### Scenario: CRM CLI available
- **WHEN** the agent container starts
- **THEN** the `crm` CLI is available on PATH
- **AND** it can reach the CRM API service via the Docker network

#### Scenario: Agent uses CLI for CRM operations
- **WHEN** the agent needs to read or write CRM data
- **THEN** it calls `crm <entity> <action>` via Bash
- **AND** receives structured JSON on stdout
- **AND** errors are reported on stderr with non-zero exit codes

#### Scenario: No MCP tools required
- **WHEN** the agent processes emails during a shift
- **THEN** it does not use MCP tools for CRM access
- **AND** does not require ToolSearch for tool discovery
