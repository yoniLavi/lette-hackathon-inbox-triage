# Change: Add agent shift endpoint for batch email processing

## Why
The agent can answer ad-hoc questions, but cannot yet autonomously process a batch of emails the way a property manager would at the start of their day. We need a single "start shift" trigger that makes the agent work through all active emails, taking concrete CRM actions for each one — drafting replies, updating contacts, and creating tasks.

Early experimentation showed the agent is inefficient at many CRM tasks (over-querying, redundant searches, poor entity relationship navigation). The shift — processing many emails end-to-end — is the forcing function for discovering these patterns. The agent should capture operational insights as it works, which we then synthesize into reusable skills.

## What Changes
- New `POST /shift` API endpoint that starts a batch processing session
- New `/shift` skill (`.claude/commands/shift.md`) defining the per-email workflow
- Updated `scripts/agent.py` with `--shift` flag to trigger from CLI
- Updated CLAUDE.md with shift-specific guidance (draft rules, task conventions)
- Insight capture: the shift skill instructs the agent to append operational learnings to `learnings.md` as it discovers patterns, gotchas, and effective techniques during email processing

## Insight Capture & Skill Synthesis

The shift doubles as a learning loop:

1. **During shift**: the agent appends to `learnings.md` (in its workspace) whenever it discovers something worth remembering — e.g., "searching by `from` address is faster than by sender name", "Contacts are often already linked to Accounts via the `accountId` field, no need to search separately", or "RTB dispute emails always reference a case number in the subject".

2. **After shift**: we review `learnings.md`, validate the insights against actual CRM behavior, and synthesize confirmed patterns into:
   - Improved skills (`.claude/commands/*.md`) — reusable workflows
   - Better CLAUDE.md guidance — reducing unnecessary tool calls
   - Domain heuristics — urgency rules, entity relationship shortcuts

3. **Commit & iterate**: updated skills are source-controlled, so each shift run benefits from all prior learnings. The agent gets measurably better over successive shifts.

This captured knowledge also informs the `add-async-mcp-delegation` work — we'll know exactly which CRM call patterns are slow and which can be parallelized before choosing an architecture.

## Impact
- Affected specs: `agent-api` (new endpoint + response model)
- Affected code: `agent/api.py`, `agent/workspace/CLAUDE.md`, `agent/workspace/.claude/commands/shift.md`, `scripts/agent.py`
- New file: `agent/workspace/learnings.md` (agent-written, human-reviewed)
