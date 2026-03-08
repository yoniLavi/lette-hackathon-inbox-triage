Process all unprocessed emails in the CRM as a batch shift.

## Setup

1. Create a Case for this shift:
   - `create_entity(entityType="Case", name="Agent Shift — <today's date and time>", status="In Progress", priority="Normal")`
   - Save the Case ID — you'll add Notes to it throughout the shift.

## Find unprocessed emails

2. Search for emails that haven't been replied to or processed:
   - `search_entity(entityType="Email", where=[{"type": "equals", "attribute": "status", "value": "Archived"}], orderBy="dateSent", order="asc", limit=1)`
   - This returns summarized results (IDs and subjects only). Do NOT retry with different params to get more fields.

## Process each email

3. For each email, do the following steps. Work through them **one email at a time** — finish all steps for one email before moving to the next.

### a) Read the full email
   - `get_entity(entityType="Email", entityId="<id>")` to get the body, dates, sender, and all fields.

### b) Identify the sender
   - Check the `from` address. Search for a matching Contact: `search_entity(entityType="Contact", where=[{"type": "contains", "attribute": "emailAddress", "value": "<email>"}], limit=1)`
   - If found, note their linked Account (check `accountId` field on the Contact via `get_entity`).
   - If not found, note this as an unknown sender.

### c) Classify urgency
   - **Emergency**: health/safety risks (floods, gas leaks, fires, lock-outs), immediate habitability threats
   - **Urgent**: rent arrears, RTB disputes, lease expiry within 30 days, compliance deadlines, legal threats
   - **Routine**: maintenance requests, general queries, lease renewals > 30 days, scheduled inspections
   - **Low**: marketing, FYI, newsletters, acknowledgments, simple thank-you replies

### d) Take CRM actions

   **Draft a reply** (for emails that warrant a response):
   - `create_entity(entityType="Email", subject="Re: <original subject>", body="<draft reply>", status="Draft", to="<sender email>", from="<property manager email>")`
   - Use a professional, concise tone appropriate for Irish property management.
   - Reference specific details from the email. Don't be generic.
   - For emergencies: acknowledge the issue, confirm immediate action, provide next steps.
   - For routine matters: be helpful but brief.
   - NEVER set status to "Sent" — always "Draft" for human review.

   **Create a Task** (when follow-up action is needed):
   - `create_entity(entityType="Task", name="<action description>", status="Not Started", priority="<Urgent|Normal|Low>", description="<context and steps>")`
   - Link to the Contact if known: `link_entities(entityType="Task", entityId="<task_id>", linkName="contacts", linkedEntityId="<contact_id>")`

   **Update Contact/Account** (if you learn new info):
   - Only update if the email reveals concrete new information (e.g., new phone number, name correction).

### e) Journal to the shift Case
   - Add a Note to the Case: `create_entity(entityType="Note", post="<summary>", parentType="Case", parentId="<case_id>")`
   - Summary format: `**<subject>** (from <sender>) — <urgency>. Actions: <what you did>.`

### f) Capture learnings
   - If you discover something useful about CRM patterns, entity relationships, efficient search strategies, or domain knowledge that would help process future emails faster, **append it to `/workspace/learnings.md`**.
   - Examples of things worth capturing:
     - Entity relationship shortcuts (e.g., "Contacts have `accountId` — no need to search Accounts separately")
     - Search patterns that work well or poorly
     - Domain patterns (e.g., "RTB dispute emails always reference case numbers")
     - MCP tool behaviors or quirks you notice
   - Don't repeat insights already in the file — read it first.

## Wrap up

4. Update the shift Case:
   - `update_entity(entityType="Case", entityId="<case_id>", status="Closed", description="Processed <N> emails. <brief summary of key actions>.")`

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
