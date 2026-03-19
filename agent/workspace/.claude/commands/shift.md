Process unread email threads in the CRM as a batch shift.

## Setup

1. Find the current in-progress shift record:
   ```bash
   crm shifts list --status in_progress --limit 1 --order-by started_at --order desc
   ```
   Save the **shift ID** — you'll journal notes to it throughout the shift.

2. Track the current case ID (from the thread's case context). This
   determines when you've switched to a new case and should check context usage.

## Incomplete cases

3. Check for cases from previous shifts that need attention:
   ```bash
   crm shift incomplete
   ```
   This returns cases that are new/in_progress but have no tasks and no draft emails.
   If there are incomplete cases, process them FIRST before fetching new threads:
   - For each incomplete case, load it with full context:
     ```bash
     crm cases get <id> --include emails,tasks,notes,property
     ```
   - Triage the case: assess urgency, create tasks, draft replies as needed (see step 5b).
   - Journal each triaged case as a note to the shift (see step 5d).
   - Then proceed to step 4 (main loop for new threads).

## Main loop

4. Fetch the next unread thread:
   ```bash
   crm shift next
   ```
   This returns a JSON blob with:
   - `thread`: the thread with `emails[]` and `contact` pre-loaded
   - `case`: the linked case (if any) with `emails[]`, `tasks[]`, `notes[]`, `property` pre-loaded
   - If `thread` is `null`, there are no more unread threads — skip to Wrap Up.

5. For each thread, do the following:

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

   When the actions below are independent of each other (e.g. draft reply + create task
   + journal note), run them in parallel to save time.

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
   Note: if you need to create a case first, do that before creating tasks/drafts that reference it.

   **Create Tasks** (when follow-up action is needed):
   ```bash
   crm tasks create --json '{"name": "<action description>", "status": "not_started", "priority": "<urgent|normal|low>", "description": "<markdown context>", "case_id": <case_id>, "contact_id": <contact_id>}'
   ```
   Write `description` as **markdown** — use numbered lists, bold, line breaks.
   The frontend renders it as markdown, so `1) foo 2) bar` on one line is unreadable.
   Instead write:
   ```
   1. First action\n2. Second action\n3. Third action
   ```

### c) Complete the thread
   Mark all emails in the thread as read and link to the case:
   ```bash
   crm shift complete --json '{"email_ids": [<ids from thread.emails>], "thread_id": "<thread_id>", "case_id": <case_id>}'
   ```

### d) Journal to the shift
   ```bash
   crm notes create --json '{"content": "**Thread: <subject>** (<email_count> emails, from <contact>) — <urgency>. Actions: <what you did>.", "shift_id": <shift_id>}'
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

6. Loop back to step 4.

## Wrap up

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
