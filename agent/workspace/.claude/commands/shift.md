Process unread email threads in the CRM as a batch shift.

## Setup

1. Create a Case for this shift:
   ```bash
   crm cases create --json '{"name": "Agent Shift — <today's date and time>", "status": "in_progress", "priority": "normal"}'
   ```
   Save the Case ID — you'll add Notes to it throughout the shift.

2. Track the current case ID (from the thread's case context, not the shift case). This
   determines when you've switched to a new case and should check context usage.

## Main loop

3. Fetch the next unread thread:
   ```bash
   crm shift next
   ```
   This returns a JSON blob with:
   - `thread`: the thread with `emails[]` and `contact` pre-loaded
   - `case`: the linked case (if any) with `emails[]`, `tasks[]`, `notes[]`, `property` pre-loaded
   - If `thread` is `null`, there are no more unread threads — skip to Wrap Up.

4. For each thread, do the following:

### a) Assess the situation
   - Read all emails in `thread.emails` (they're ordered by thread_position).
   - Review the contact info in `thread.contact`.
   - If there's a case, review its tasks, notes, and other emails for full context.
   - Classify urgency:
     - **Emergency**: health/safety risks (floods, gas leaks, fires, lock-outs), immediate habitability threats
     - **Urgent**: rent arrears, RTB disputes, lease expiry within 30 days, compliance deadlines, legal threats
     - **Routine**: maintenance requests, general queries, lease renewals > 30 days, scheduled inspections
     - **Low**: marketing, FYI, newsletters, acknowledgments, simple thank-you replies

### b) Take CRM actions

   **Draft a reply** (for emails that warrant a response):
   - Use the property's `manager_email` from the case context as the `from_address`.
   - Use a professional, concise tone appropriate for Irish property management.
   - Reference specific details from the email. Don't be generic.
   - NEVER set status to "sent" — always "draft" for human review.
   ```bash
   crm emails create --json '{"subject": "Re: <original subject>", "body": "<draft reply>", "status": "draft", "from_address": "<manager_email from property>", "to_addresses": ["<sender email>"], "thread_id": "<thread_id>", "case_id": <case_id>}'
   ```

   **Create or update a Case** (if thread has no case yet):
   ```bash
   crm cases create --json '{"name": "<descriptive case name>", "status": "new", "priority": "<priority>", "description": "<context>", "property_id": <property_id>}'
   ```

   **Create Tasks** (when follow-up action is needed):
   ```bash
   crm tasks create --json '{"name": "<action description>", "status": "not_started", "priority": "<urgent|normal|low>", "description": "<context>", "case_id": <case_id>, "contact_id": <contact_id>}'
   ```

### c) Complete the thread
   Mark all emails in the thread as read and link to the case:
   ```bash
   crm shift complete --json '{"email_ids": [<ids from thread.emails>], "thread_id": "<thread_id>", "case_id": <case_id>}'
   ```

### d) Journal to the shift Case
   ```bash
   crm notes create --json '{"content": "**Thread: <subject>** (<email_count> emails, from <contact>) — <urgency>. Actions: <what you did>.", "case_id": <shift_case_id>}'
   ```

### e) Pacing: check before starting a new case
   After completing a thread, check if the NEXT thread belongs to a **different case**
   than the one you just processed. If it does:
   - Run `/context` to check your context usage.
   - If free space is **below 50%**, skip to Wrap Up — do not start a new case.
   - If free space is adequate, continue to the next thread.

   Always finish ALL unread threads for the current case before considering pacing.

### f) Capture learnings
   - If you discover something useful about CRM patterns, entity relationships, efficient search strategies, or domain knowledge, **append it to `/workspace/learnings.md`**.
   - Don't repeat insights already in the file — read it first.

5. Loop back to step 3.

## Wrap up

6. Update the shift Case:
   ```bash
   crm cases update <shift_case_id> --json '{"status": "closed", "description": "Processed <N> threads (<M> emails). <brief summary>."}'
   ```

7. Produce a final summary in this format:

```
## Shift Complete

**Threads processed**: <N>
**Emails processed**: <M>
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
