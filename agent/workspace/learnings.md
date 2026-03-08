# Agent Learnings

Operational insights discovered during shift processing. Each entry is validated
by experience, not speculation. We synthesize these into skills and CLAUDE.md
improvements between shifts.

## EspoMCP Patterns

- `search_entity` returns summarized results only (name, email, status) — no dates, no body, no IDs in the display. Always follow up with `get_entity` for full details.
- `formatGenericEntityResults` (used for Email search) is especially limited. Dedicated formatters exist for Contact, Account, Meeting but NOT Email.
- Use `orderBy` + `order` + `limit` on searches to get the records you actually need, rather than fetching everything and filtering.
- **Email/Task creation via MCP tools has permission restrictions** — attempts to create Email or Task entities return "Access forbidden - insufficient permissions" or "Invalid request data" errors. Note creation works reliably. This limits shift automation to journaling only.
- Direct API access via curl works for read operations. When MCP tools fail, fall back to API to verify entity structure and field names.

## Entity Relationships

- Contacts have `accountId` field linking directly to Accounts — no need to search separately
- Emails can have `parentType` and `parentId` linking to Cases or other entities
- Cases can contain Notes via `parentType="Case"` and `parentId` relationship

## Domain Patterns

- Irish BTR/PRS context: RTB (Residential Tenancies Board), RPZ (Rent Pressure Zones)
- HSE Environmental Health Service enforces Housing Standards for Rented Houses Regulations 2019
- 4 urgency levels: emergency > urgent > routine > low
- Property managers are referenced by first name in emails (Tara, Maeve, Declan, Ronan, Shauna)
- Multiple properties in portfolio: CityNorth Quarter, Reds Works, Graylings, Ilah Residences, Thornbury Village
- Common escalation patterns: tenant complaint → RTB dispute → HSE inspection → potential prosecution
- Mould/damp issues have high legal sensitivity — multiple regulatory tracks can run in parallel

## Efficiency Notes

- When processing large batches of emails (50+), use batch GET operations via curl + jq to get quick summaries before detailed processing
- Cross-reference related emails by subject line and date to avoid duplicate analysis
- Group related incidents in single Notes rather than creating separate Notes for each thread
- For shift journaling when Task creation is blocked, Notes work well as narrative logs with action items embedded
