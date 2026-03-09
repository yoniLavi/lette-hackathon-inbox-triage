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
- Fire alarm panel faults require resolution within 24 hours per fire safety regulations
- Interim fire watch may be required for affected floors while fire alarm systems are being repaired

## Operations Procedures

- Tenant move-out: 10 business day deposit return timeline after final inspection
- Service lift booking required for tenant move-outs in multi-unit properties
- Pre-departure walkthrough best practice (typically 1 week before move-out) to identify remediation needs
- Email sender address may differ from signature name in email body (cross-reference contact records)
- Subletting: Requires written consent, formal application with employment verification, €150 admin fee, RTB registration for subtenancy. Processing takes 7-10 business days. Principal tenant remains responsible for rent and property condition.
- Local Property Tax (LPT): Annual returns due by late March. Management company responsible for coordinating submissions across portfolio properties with individual landlords. Penalties apply for missed deadlines.

## Insurance & Liability

- Building equipment (integrated appliances, washing machines, etc.) provided with apartments is covered under building insurance, not tenant contents insurance
- Tenants are not liable for failures of building-provided equipment
- Water damage from building equipment failures = building insurance claim

## Pest Control

- Single-unit pest reports may indicate building-wide issues if tenant suspects common area source (bin stores, chutes)
- Pest control response should include: (1) treat affected unit, (2) inspect suspected common area sources, (3) survey neighboring units
- Musty smells near bin chutes/stores are indicators of potential pest breeding grounds

## CRM Technical Issues (2026-03-09)

- Server 500 errors observed when filtering tasks/notes by case_id (e.g., `crm tasks list --case-id 14`, `crm notes list --case-id 14`)
- Server 500 errors observed when filtering contacts by property_id + type together
- No --unit filter available for contacts list (must fetch all contacts for property and filter manually)

## BTR/PRS Emergency Patterns

- Smart lock failures are lockout emergencies requiring immediate master key dispatch (30 min response target)
- Water leaks through light fittings are electrical hazards - instruct tenant to avoid switches/outlets and evacuate if sparking
- Repeat noise complaints (3+ incidents logged) require formal written warnings citing quiet enjoyment clause breach and potential tenancy termination
