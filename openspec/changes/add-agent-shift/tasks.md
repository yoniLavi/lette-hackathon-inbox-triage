## Status: PAUSED — pending CRM replacement

Shift implementation is functional but profiling revealed EspoCRM+EspoMCP is
too slow for viable email processing. A single email takes 100+ tool calls
and 7+ minutes. CRM replacement is prerequisite for continuing.

See profiling data in `agent/workspace/learnings.md` and commit history.

## 1. Shift Skill
- [x] 1.1 Create `agent/workspace/.claude/commands/shift.md`
- [x] 1.2 Update `agent/workspace/CLAUDE.md`
- [x] 1.3 Create `agent/workspace/learnings.md`

## 2. API Endpoint
- [x] 2.1 Add `POST /shift` endpoint in `agent/api.py`
- [x] 2.2 Update busy guard to block prompts during shift and vice versa

## 3. CLI Update
- [x] 3.1 Add `--shift` flag to `scripts/agent.py`

## 4. Container Rebuild
- [x] 4.1 Dev compose now uses bind mounts — no rebuild needed

## 5. Validation (blocked on CRM replacement)
- [ ] 5.1 Test: `POST /shift` processes emails and returns a summary
- [ ] 5.2 Test: draft emails appear with status "Draft"
- [ ] 5.3 Test: tasks are created with descriptions and priorities
- [ ] 5.4 Test: a Case is created for the shift with Notes journaling
- [ ] 5.5 Test: `scripts/agent.py --shift` works end-to-end
- [ ] 5.6 Test: concurrent shift/prompt requests return 409
- [ ] 5.7 Test: `learnings.md` is populated with agent observations

## 6. Synthesize Learnings (post-shift)
- [ ] 6.1 Review `agent/workspace/learnings.md` after successful shift
- [ ] 6.2 Distill confirmed patterns into improved skills and CLAUDE.md
- [ ] 6.3 Commit updated skills

## Profiling Results (1-email shift)

Tool call breakdown (109 total, ~7 min for ONE email):
- 56 MCP CRM calls (search_entity ×26, get_entity ×12, search_cases ×7, search_notes ×6, search_contacts ×4, create_entity ×3, health_check ×1)
- 22 Bash (curl fallbacks when MCP create operations fail)
- 18 ToolSearch (deferred tool loading — pure overhead)
- 13 other Claude Code tools (Agent ×3, Glob ×3, Read ×2, TodoWrite ×2)

Key findings:
- EspoMCP `create_entity` fails for Email and Task (permission/validation errors)
- Agent falls back to curl via Bash, then spirals into exploratory debugging
- ToolSearch overhead is massive — 18 calls just to discover available tools
- Agent over-queries: searches the same entity types repeatedly
