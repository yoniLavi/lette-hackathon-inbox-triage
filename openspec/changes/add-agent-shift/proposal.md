# Change: Add agent shift endpoint for batch email processing

## Why
The agent can answer ad-hoc questions, but cannot yet autonomously process a batch of emails the way a property manager would at the start of their day. We need a single "start shift" trigger that makes the agent work through all active emails, taking concrete CRM actions for each one — drafting replies, updating contacts, and creating tasks.

## What Changes
- New `POST /shift` API endpoint that starts a batch processing session
- New `/shift` skill (`.claude/commands/shift.md`) defining the per-email workflow
- Updated `scripts/agent.py` with `--shift` flag to trigger from CLI
- Updated CLAUDE.md with shift-specific guidance (draft rules, task conventions)

## Impact
- Affected specs: `agent-api` (new endpoint + response model)
- Affected code: `agent/api.py`, `agent/workspace/CLAUDE.md`, `agent/workspace/.claude/commands/shift.md`, `scripts/agent.py`
