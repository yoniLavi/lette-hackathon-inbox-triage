## 1. Agent API CORS
- [x] 1.1 Add CORS middleware to `agent/api.py` — allow requests from the frontend origin (configurable, default `http://localhost:3000`)

## 2. Chat Widget
- [x] 2.1 Update `AIAssistant.tsx` — replace mock `setTimeout` with `fetch(NEXT_PUBLIC_AGENT_URL + "/prompt")` call
- [x] 2.2 Add loading/typing indicator while waiting for agent response
- [x] 2.3 Handle 409 response — auto-restart session and retry
- [x] 2.4 Handle network errors gracefully — show error message, allow retry
- [x] 2.5 Add SSE streaming via `POST /prompt/stream` with real-time tool_use/text/done events
- [x] 2.6 Add "New Chat" button that resets the session via `POST /session/restart`
- [x] 2.7 Add markdown rendering for assistant messages (`react-markdown`)
- [x] 2.8 Persist chat messages in sessionStorage across page reloads

## 3. Fix: Multi-turn conversation hangs (Claude Code SDK)
- [ ] 3.1 Investigate `ClaudeSDKClient` multi-turn behavior — second `query()` + `receive_response()` produces no SDK messages (confirmed by `test_multi_turn_conversation` in `tests/test_chat_e2e.sh`)
- [ ] 3.2 Check SDK docs/source for correct multi-turn pattern — does `receive_response()` exhaust the iterator? Do we need to pass conversation history explicitly? Is there a `resume()` or `continue_session()` method?
- [ ] 3.3 Test alternative patterns: (a) re-create client but pass conversation_id, (b) use a different SDK entry point for follow-ups, (c) check if `query()` needs `await` differently after first turn
- [ ] 3.4 Add a per-request timeout to `receive_response()` (e.g., 90s) with automatic session teardown and error SSE event on timeout — prevents silent hangs
- [ ] 3.5 Update `test_chat_e2e.sh::test_multi_turn_conversation` to pass once fix is implemented

## 4. Validation
- [x] 4.1 Test: sending a message in the chat widget returns a real agent response
- [ ] 4.2 Test: sending a message while agent is busy shows the busy indicator
- [x] 4.3 Test: chat widget works when accessed via http://localhost:3000
- [ ] 4.4 Test: multi-turn conversation works (second message on same session completes)
- [ ] 4.5 Test: agent recovers gracefully after client disconnect mid-stream
