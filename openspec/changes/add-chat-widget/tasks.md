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
- [x] 3.1 Investigate `ClaudeSDKClient` multi-turn behavior — root cause: iterating `receive_response()` (anyio MemoryObjectReceiveStream) inside a Starlette `StreamingResponse` async generator hangs on second turn. Direct SDK usage and non-streaming `/prompt` endpoint work fine.
- [x] 3.2 Check SDK docs/source — confirmed SDK multi-turn API is correct (`query()` + `receive_response()` per turn). Bug is in the ASGI/anyio async context interaction.
- [x] 3.3 Fix: replaced async generator pattern with `asyncio.Queue` bridge — SDK response consumed in a regular `asyncio.Task`, SSE events yielded from the queue in the generator. All 10 E2E tests pass.
- [ ] 3.4 Add a per-request timeout to `receive_response()` (e.g., 90s) with automatic session teardown and error SSE event on timeout — prevents silent hangs
- [x] 3.5 `test_chat_e2e.sh::test_multi_turn_conversation` passes

## 4. Validation
- [x] 4.1 Test: sending a message in the chat widget returns a real agent response
- [ ] 4.2 Test: sending a message while agent is busy shows the busy indicator
- [x] 4.3 Test: chat widget works when accessed via http://localhost:3000
- [x] 4.4 Test: multi-turn conversation works (second message on same session completes)
- [x] 4.5 Test: agent recovers gracefully after client disconnect mid-stream
