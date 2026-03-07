## ADDED Requirements

### Requirement: Instant User Response
The user-facing AI SHALL respond to the user within 3 seconds of receiving a message. CRM tool calls SHALL NOT block the initial response.

#### Scenario: User asks about CRM data
- **WHEN** a user asks "what's the most urgent issue?"
- **THEN** the user receives an immediate acknowledgment (e.g., "Let me check the priority queue for you")
- **AND** CRM data is fetched asynchronously
- **AND** results are streamed back to the user as they become available

#### Scenario: Simple conversational question
- **WHEN** a user asks a question that doesn't need CRM data (e.g., "what can you help me with?")
- **THEN** the response arrives within 3 seconds with no CRM calls

### Requirement: Async CRM Delegation
CRM-heavy operations SHALL be delegated asynchronously so the conversational AI remains responsive throughout.

#### Scenario: Multi-tool CRM query
- **WHEN** a query requires multiple CRM tool calls (search + get_entity for each result)
- **THEN** the user sees streaming progress (tool names, partial results) as each call completes
- **AND** the conversational AI can accept follow-up messages while CRM work is in progress
