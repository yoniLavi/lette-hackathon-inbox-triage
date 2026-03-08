Process all unprocessed emails in the CRM as a batch shift.

## Setup

1. Create a Case for this shift:
   ```bash
   crm cases create --json '{"name": "Agent Shift — <today's date and time>", "status": "in_progress", "priority": "normal"}'
   ```
   Save the Case ID — you'll add Notes to it throughout the shift.

## Find unprocessed emails

2. Search for emails that haven't been read:
   ```bash
   crm emails list --status archived --is-read false --order-by date_sent --order asc --limit 1
   ```

## Process each email

3. For each email, do the following steps. Work through them **one email at a time** — finish all steps for one email before moving to the next.

### a) Read the full email
   ```bash
   crm emails get <id>
   ```

### b) Identify the sender
   - Check the `from_address`. Search for a matching Contact:
     ```bash
     crm contacts list --email <from_address>
     ```
   - If found, note their `property_id` and `type`.
   - If not found, note this as an unknown sender.

### c) Classify urgency
   - **Emergency**: health/safety risks (floods, gas leaks, fires, lock-outs), immediate habitability threats
   - **Urgent**: rent arrears, RTB disputes, lease expiry within 30 days, compliance deadlines, legal threats
   - **Routine**: maintenance requests, general queries, lease renewals > 30 days, scheduled inspections
   - **Low**: marketing, FYI, newsletters, acknowledgments, simple thank-you replies

### d) Take CRM actions

   **Draft a reply** (for emails that warrant a response):
   ```bash
   crm emails create --json '{"subject": "Re: <original subject>", "body": "<draft reply>", "status": "draft", "from_address": "<property manager email>", "to_addresses": ["<sender email>"]}'
   ```
   - Use a professional, concise tone appropriate for Irish property management.
   - Reference specific details from the email. Don't be generic.
   - NEVER set status to "sent" — always "draft" for human review.

   **Create a Task** (when follow-up action is needed):
   ```bash
   crm tasks create --json '{"name": "<action description>", "status": "not_started", "priority": "<urgent|normal|low>", "description": "<context>", "case_id": <shift_case_id>, "contact_id": <contact_id>}'
   ```

   **Mark email as read**:
   ```bash
   crm emails update <id> --json '{"is_read": true}'
   ```

### e) Journal to the shift Case
   ```bash
   crm notes create --json '{"content": "**<subject>** (from <sender>) — <urgency>. Actions: <what you did>.", "case_id": <shift_case_id>}'
   ```

### f) Capture learnings
   - If you discover something useful about CRM patterns, entity relationships, efficient search strategies, or domain knowledge, **append it to `/workspace/learnings.md`**.
   - Don't repeat insights already in the file — read it first.

## Wrap up

4. Update the shift Case:
   ```bash
   crm cases update <shift_case_id> --json '{"status": "closed", "description": "Processed <N> emails. <brief summary>."}'
   ```

5. Produce a final summary in this format:

```
## Shift Complete

**Emails processed**: <N>
**Drafts created**: <N>
**Tasks created**: <N>

### By urgency
- Emergency: <N> — <brief notes>
- Urgent: <N> — <brief notes>
- Routine: <N> — <brief notes>
- Low: <N> — <brief notes>

### Key actions
1. <most important action taken>
2. <second most important>
3. <third most important>

### Learnings captured
- <one-line summary of each new insight written to learnings.md>
```
