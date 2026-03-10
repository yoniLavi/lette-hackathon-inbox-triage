Scan for approaching regulatory and compliance deadlines across the portfolio.

## Steps

1. Find tasks with upcoming deadlines (next 28 days):
   ```bash
   crm tasks list --status not_started --date-end-before <28 days from today, ISO format> --order-by date_end --order asc --limit 50
   crm tasks list --status in_progress --date-end-before <28 days from today, ISO format> --order-by date_end --order asc --limit 50
   ```

2. Also check for overdue tasks (deadline already passed):
   ```bash
   crm tasks list --status not_started --date-end-before <today, ISO format> --order-by date_end --order asc --limit 50
   ```

3. For each task with a deadline, load its case context:
   ```bash
   crm cases get <case_id> --include property
   ```

4. Flag items by regulatory category:
   - **Fire safety**: DFB inspection deadlines (28-day remediation window), fire alarm faults (24h), fire safety certificates
   - **Gas safety**: annual certificate renewals per unit
   - **RTB**: dispute response deadlines, hearing dates, rent review notices
   - **HSE**: housing standards inspection compliance
   - **LPT**: Local Property Tax annual returns (late March)
   - **Insurance**: policy renewals, claim follow-ups
   - **Lease**: expiry dates, renewal notice periods, break clauses

## Output

```
## Compliance Check — <today's date>

### 🔴 Overdue
| Task | Property | Due | Days Over | Category |
|------|----------|-----|-----------|----------|
| ... | ... | ... | ... | ... |

### 🟡 Due Within 7 Days
| Task | Property | Due | Days Left | Category |
|------|----------|-----|-----------|----------|
| ... | ... | ... | ... | ... |

### 🟢 Due Within 28 Days
| Task | Property | Due | Days Left | Category |
|------|----------|-----|-----------|----------|
| ... | ... | ... | ... | ... |

### Summary
- **Overdue**: N items requiring immediate attention
- **This week**: N items
- **This month**: N items
- **Top risk**: [most critical item and why]
```
