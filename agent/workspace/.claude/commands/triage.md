Triage all unprocessed emails in the CRM.

For each email:
1. Search emails: `search_entity(entityType="Email", orderBy="dateSent", order="desc", limit=20)`
2. For each email, `get_entity` to read the full body and dates
3. Identify the sender — check if they're a known Contact or linked to an Account
4. Classify urgency:
   - **Emergency**: health/safety risks, floods, gas leaks, fires, lock-outs
   - **Urgent**: rent arrears, RTB disputes, lease expiry within 30 days, compliance deadlines
   - **Routine**: maintenance requests, general queries, lease renewals > 30 days
   - **Low**: marketing, FYI, newsletters
5. Summarize findings in a table: Subject | From | Urgency | Recommended Action

After the table, list the top 3 recommended actions in priority order.
