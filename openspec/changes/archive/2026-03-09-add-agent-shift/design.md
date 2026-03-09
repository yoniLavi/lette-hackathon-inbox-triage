## Context
The agent API currently supports free-form `POST /prompt`. We need a structured batch operation where the agent processes all active emails in a single session, taking CRM actions for each one.

## Goals / Non-Goals
- Goals:
  - Single API call triggers full email batch processing
  - Agent drafts reply emails (status=Draft, never Sent)
  - Agent creates/updates Contacts, Tasks, and Cases as needed
  - Structured summary of all actions taken
  - Reuses the existing Claude Code SDK session infrastructure
- Non-Goals:
  - Actually sending emails (drafts only — human reviews before sending)
  - Concurrent/parallel email processing (sequential is fine)
  - Scheduling or cron-based shifts (manual trigger only)
  - Streaming progress updates to the client (now feasible — SSE infrastructure exists from add-chat-widget)

## Decisions

### Shift = a prompt with the /shift skill
The shift endpoint sends the `/shift` skill as the prompt to the existing SDK session. This keeps the implementation thin — the intelligence lives in the skill file, not in Python code. The API just needs to:
1. Restart the session (fresh context for each shift)
2. Send the `/shift` prompt
3. Collect and return the response

### Draft emails via create_entity
EspoCRM's Email entity supports `status: "Draft"`. The agent creates draft emails using `create_entity(entityType="Email", data={status: "Draft", ...})` and links them to the original email thread. The property manager reviews and sends from the CRM UI.

### Tasks for follow-up actions
When the agent identifies work that can't be handled by a draft reply (e.g., "schedule inspection", "escalate to solicitor", "chase contractor"), it creates a Task in EspoCRM with a clear description, priority, and due date. Tasks are linked to the relevant Contact or Account.

### Structured summary in the response
The agent's final output is a structured summary: how many emails processed, actions taken per email, and overall priority recommendations. This becomes the `summary` field in the API response.

## Implementation notes (from chat widget work)
- **Must use asyncio.Queue bridge** for the streaming endpoint — iterating `receive_response()` inside a Starlette async generator hangs on multi-turn. The queue pattern from `prompt_stream` should be reused.
- **Filter reasoning traces** — clear `text_parts` on each `ToolUseBlock` so the summary only contains the final output, not intermediate "Let me search..." narration.
- **CLAUDE.md prompt matters** — instruct the agent to be concise, not narrate tool usage, and produce structured output (e.g., markdown table of processed emails).
- **SSE streaming is available** — the shift endpoint can stream per-email progress events using the existing SSE infrastructure.

## Risks / Trade-offs
- Long-running request: processing 100 emails could take minutes. SSE streaming mitigates UX impact — user sees per-email progress. The 409 concurrent-request guard prevents double-triggers.
- LLM judgement: draft quality and triage accuracy depend on the model. The "draft only" approach means a human always reviews before anything is sent.
- Token usage: reading 100 email bodies in a single session will use significant context. The skill should process in batches (e.g., 20 at a time) to stay within limits.
