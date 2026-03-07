## ADDED Requirements

### Requirement: Live Chat Widget
The frontend SHALL include a floating chat widget that sends messages to the agent API and displays real responses.

#### Scenario: Send a message to the agent
- **WHEN** a user types a message in the chat widget and presses send
- **THEN** the widget sends `POST /prompt` to the agent API with the message
- **AND** displays a loading indicator while waiting
- **AND** renders the agent's response when it arrives

#### Scenario: Agent is busy
- **WHEN** a user sends a message while the agent is already processing another request
- **THEN** the agent API returns 409
- **AND** the widget displays a user-friendly "agent is busy" message

#### Scenario: Network error
- **WHEN** the agent API is unreachable or returns a server error
- **THEN** the widget displays an error message
- **AND** allows the user to retry
