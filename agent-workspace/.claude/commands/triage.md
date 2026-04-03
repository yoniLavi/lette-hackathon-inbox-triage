---
name: triage
description: Quick prioritized overview of unread threads and cases needing attention
---

Show a prioritized overview of what needs attention right now.

## Steps

1. Preview the queue:
   ```bash
   crm threads list --is-read false --order-by last_activity_at --order asc --limit 50
   ```

2. For each unread thread, classify urgency based on subject and age:
   - **Emergency**: health/safety keywords (leak, flood, gas, fire, lockout, no heating, electrical hazard)
   - **Urgent**: legal/compliance keywords (RTB, dispute, breach, HSE, inspection, deadline, arrears, expiring), or thread older than 48 hours
   - **Routine**: maintenance, queries, renewals, scheduled work
   - **Low**: newsletters, FYI, acknowledgments, marketing

3. Check for approaching deadlines:
   ```bash
   crm tasks list --status not_started --order-by date_end --order asc --limit 10
   ```

4. Output a summary table:

```
## Current Queue

| Priority | Thread | Subject | Emails | Age |
|----------|--------|---------|--------|-----|
| 🔴 Emergency | thread_001 | Water leak... | 3 | 2d |
| ... | ... | ... | ... | ... |

**Unread threads**: N total (E emergency, U urgent, R routine, L low)

## Approaching Deadlines
- [task name] — due [date] (case: [case name])
```

5. List the top 3 recommended next actions in priority order.
