## 1. Agent API CORS
- [ ] 1.1 Add CORS middleware to `agent/api.py` — allow requests from the frontend origin (configurable, default `http://localhost:3000`)

## 2. Chat Widget
- [ ] 2.1 Update `AIAssistant.tsx` — replace mock `setTimeout` with `fetch(NEXT_PUBLIC_AGENT_URL + "/prompt")` call
- [ ] 2.2 Add loading/typing indicator while waiting for agent response
- [ ] 2.3 Handle 409 response — show "Agent is busy processing another request" message
- [ ] 2.4 Handle network errors gracefully — show error message, allow retry

## 3. Validation
- [ ] 3.1 Test: sending a message in the chat widget returns a real agent response
- [ ] 3.2 Test: sending a message while agent is busy shows the busy indicator
- [ ] 3.3 Test: chat widget works when accessed via http://localhost:3000
