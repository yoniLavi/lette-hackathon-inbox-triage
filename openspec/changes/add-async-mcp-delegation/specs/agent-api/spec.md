## ADDED Requirements

### Requirement: Response Latency Target
The agent API SHALL aim to deliver visible progress (status updates, partial results, or the final response) within 10 seconds of receiving a prompt, even for queries that require multiple CRM tool calls.

#### Scenario: Fast first update
- **WHEN** a client sends a prompt that requires CRM tool calls
- **THEN** the SSE stream delivers at least one meaningful update (tool_use event or text) within 10 seconds of the request
- **AND** the full response completes within 60 seconds for typical single-entity queries

#### Scenario: Multi-tool query
- **WHEN** a prompt requires 3+ sequential CRM tool calls (e.g., "summarize all emails from tenant X")
- **THEN** each tool call emits a `tool_use` event as it starts
- **AND** partial text results are streamed as they become available (not batched until all tools complete)
