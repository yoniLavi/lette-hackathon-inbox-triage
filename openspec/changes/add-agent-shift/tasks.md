## 1. Shift Skill
- [ ] 1.1 Create `agent/workspace/.claude/commands/shift.md` — detailed per-email processing workflow including Case journaling and insight capture
- [ ] 1.2 Update `agent/workspace/CLAUDE.md` — add draft email conventions, task creation guidance, shift journaling via Cases, and learnings.md instructions
- [ ] 1.3 Create `agent/workspace/learnings.md` — seed with structure and initial known gotchas from prior experimentation

## 2. API Endpoint
- [ ] 2.1 Add `POST /shift` endpoint in `agent/api.py` — restarts session, sends /shift skill, returns summary
- [ ] 2.2 Update busy guard to block prompts during shift and vice versa

## 3. CLI Update
- [ ] 3.1 Add `--shift` flag to `scripts/agent.py` — calls POST /shift, prints summary

## 4. Container Rebuild
- [ ] 4.1 Rebuild agent container (new skill file + updated CLAUDE.md)

## 5. Validation
- [ ] 5.1 Test: `POST /shift` processes emails and returns a summary
- [ ] 5.2 Test: draft emails appear in EspoCRM with status "Draft"
- [ ] 5.3 Test: tasks are created in EspoCRM with descriptions and priorities
- [ ] 5.4 Test: a Case is created for the shift with Notes journaling each processed email
- [ ] 5.5 Test: `scripts/agent.py --shift` works end-to-end
- [ ] 5.6 Test: concurrent shift/prompt requests return 409
- [ ] 5.7 Test: `learnings.md` is populated with agent observations after a shift run

## 6. Synthesize Learnings (post-shift)
- [ ] 6.1 Review `agent/workspace/learnings.md` after first shift run
- [ ] 6.2 Validate insights against actual CRM behavior
- [ ] 6.3 Distill confirmed patterns into improved skills and CLAUDE.md guidance
- [ ] 6.4 Commit updated skills and note which patterns inform async-mcp-delegation
