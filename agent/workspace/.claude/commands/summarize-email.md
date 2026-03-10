Summarize a specific email or thread and its context.

Arguments: $ARGUMENTS (email ID, thread ID, or subject search term)

## Steps

1. Find the email or thread:
   - If argument is a number, try `crm emails get $ARGUMENTS --include contact`
   - If argument starts with "thread_", try `crm threads get` by listing threads and matching
   - Otherwise, search: `crm emails list --search "$ARGUMENTS" --limit 5`

2. If the email belongs to a thread, load the full thread:
   ```bash
   crm threads list --limit 500
   ```
   Find the matching thread and get it with includes:
   ```bash
   crm threads get <thread_id> --include emails,contact
   ```

3. If there's a linked case, load case context:
   ```bash
   crm cases get <case_id> --include tasks,notes,property
   ```

## Output

- **Thread**: thread_id (N emails)
- **Subject**: subject line
- **From**: sender name and email (contact type)
- **Property**: linked property if known
- **Case**: linked case if any (status, priority)
- **Timeline**: date range of thread emails
- **Summary**: 2-3 sentence summary of the conversation
- **Open tasks**: any tasks linked to the case
- **Suggested action**: what the property manager should do next
