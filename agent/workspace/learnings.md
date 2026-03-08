# Agent Learnings

Operational insights discovered during shift processing. Each entry is validated
by experience, not speculation. We synthesize these into skills and CLAUDE.md
improvements between shifts.

## CRM CLI Patterns

- `crm` CLI outputs structured JSON on stdout — parse with jq when needed
- List endpoints return `{"list": [...], "total": N}` — check `total` for pagination
- Full-text search on emails: `crm emails list --search "water leak"`
- Filter by FK: `crm emails list --case-id 3`, `crm tasks list --case-id 3`
- Create with JSON: `crm cases create --json '{"name": "...", "status": "in_progress"}'`
- Update specific fields: `crm emails update 42 --json '{"is_read": true}'`

## Entity Relationships

- Contacts have `property_id` linking directly to Properties
- Emails have `case_id` FK to Cases (set via update after case creation)
- Tasks have `case_id` and `contact_id` direct FKs
- Notes have `case_id` FK — used for shift journaling
- Emails are threaded via `thread_id` and `thread_position`

## Domain Patterns

- Irish BTR/PRS context: RTB (Residential Tenancies Board), RPZ (Rent Pressure Zones)
- HSE Environmental Health Service enforces Housing Standards for Rented Houses Regulations 2019
- 4 urgency levels: emergency > urgent > routine > low
- Property managers are referenced by first name in emails (Tara, Maeve, Declan, Ronan, Shauna)
- Multiple properties in portfolio: CityNorth Quarter, Reds Works, Graylings, Ilah Residences, Thornbury Village
- Common escalation patterns: tenant complaint → RTB dispute → HSE inspection → potential prosecution
- Mould/damp issues have high legal sensitivity — multiple regulatory tracks can run in parallel

## Efficiency Notes

- Group related incidents in single Notes rather than creating separate Notes for each thread
- Cross-reference related emails by subject line and date to avoid duplicate analysis

## Regulatory & Compliance

- Dublin Fire Brigade (DFB) Fire Prevention Section conducts fire safety inspections with 28-day compliance deadlines for non-compliant items
- Fire safety non-compliance requires remediation plan submission with timelines and contractor certifications
- Contact type "legal" used for regulatory bodies like DFB (in addition to tenant/landlord/contractor/prospect/internal/external types)

## Operations Procedures

- Tenant move-out: 10 business day deposit return timeline after final inspection
- Service lift booking required for tenant move-outs in multi-unit properties
- Pre-departure walkthrough best practice (typically 1 week before move-out) to identify remediation needs
- Email sender address may differ from signature name in email body (cross-reference contact records)
