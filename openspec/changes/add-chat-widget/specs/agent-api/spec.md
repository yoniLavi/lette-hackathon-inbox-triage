## ADDED Requirements

### Requirement: CORS Support
The agent API SHALL allow cross-origin requests from the frontend so the browser-based chat widget can call `POST /prompt` directly.

#### Scenario: Browser request from frontend
- **WHEN** the frontend at `http://localhost:3000` sends a `POST /prompt` request to the agent API at `http://localhost:8001`
- **THEN** the agent API includes appropriate CORS headers in the response
- **AND** the request succeeds without being blocked by the browser
