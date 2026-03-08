# Agent Learnings

Operational insights discovered during shift processing. Each entry is validated
by experience, not speculation. We synthesize these into skills and CLAUDE.md
improvements between shifts.

## EspoMCP Patterns

- `search_entity` returns summarized results only (name, email, status) — no dates, no body, no IDs in the display. Always follow up with `get_entity` for full details.
- `formatGenericEntityResults` (used for Email search) is especially limited. Dedicated formatters exist for Contact, Account, Meeting but NOT Email.
- Use `orderBy` + `order` + `limit` on searches to get the records you actually need, rather than fetching everything and filtering.

## Entity Relationships

- (add insights about Contact→Account, Email→Case, and other relationships as discovered)

## Domain Patterns

- Irish BTR/PRS context: RTB (Residential Tenancies Board), RPZ (Rent Pressure Zones)
- 4 urgency levels: emergency > urgent > routine > low
- Property managers are referenced by first name in emails

## Efficiency Notes

- (add insights about reducing unnecessary tool calls, batching strategies, etc.)
