Summarize a specific email and its context.

Arguments: $ARGUMENTS (email subject search term or email ID)

Steps:
1. If the argument looks like an ID, use `get_entity(entityType="Email", entityId=...)` directly
2. Otherwise, `search_entity(entityType="Email", filters={name: "$ARGUMENTS"}, limit=5)` to find it
3. `get_entity` on the matching email to get the full body
4. Look up the sender as a Contact — check if they're linked to an Account
5. Check for related emails in the same thread (search by subject or messageId)

Output:
- **From**: sender name and email
- **Sent**: date
- **Subject**: subject line
- **Account**: linked account if known
- **Summary**: 2-3 sentence summary of the email content
- **Related**: any other emails in the thread
- **Suggested action**: what the property manager should do next
