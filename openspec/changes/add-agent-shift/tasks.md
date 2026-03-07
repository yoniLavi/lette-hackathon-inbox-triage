## 1. Shift Skill
- [ ] 1.1 Create `agent/workspace/.claude/commands/shift.md` — detailed per-email processing workflow including Case journaling
- [ ] 1.2 Update `agent/workspace/CLAUDE.md` — add draft email conventions, task creation guidance, and shift journaling via Cases

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
- [ ] 5.6 Test: a Case is created for the shift with Notes journaling each processed email
- [ ] 5.4 Test: `scripts/agent.py --shift` works end-to-end
- [ ] 5.5 Test: concurrent shift/prompt requests return 409
