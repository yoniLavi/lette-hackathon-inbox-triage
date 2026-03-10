Review a case with all its context and produce a status summary.

Arguments: $ARGUMENTS (case ID or case name search term)

## Steps

1. Find the case:
   - If argument is a number: `crm cases get $ARGUMENTS --include emails,tasks,notes,property`
   - Otherwise search: `crm cases list --limit 20` and find by name

2. Load related threads:
   ```bash
   crm threads list --case-id <case_id> --limit 50
   ```

3. Load contacts involved (from thread emails' from_address):
   ```bash
   crm contacts list --property-id <property_id> --limit 50
   ```

## Output

```
## Case: [name]
**Status**: [status] | **Priority**: [priority] | **Property**: [property name]

### Timeline
- [date] — [event/email summary]
- [date] — [event/email summary]

### Open Tasks
- [ ] [task name] — [priority] (assigned to: [contact])

### Completed Tasks
- [x] [task name]

### Key Contacts
- [name] ([type]) — [role in this case]

### Current Situation
[2-3 sentence assessment of where things stand]

### Recommended Next Steps
1. [action]
2. [action]
```
