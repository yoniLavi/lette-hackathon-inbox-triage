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

## CRM Technical Notes

- No --unit filter available for contacts list (must fetch all contacts for property and filter manually)
- Use `--include` flag on `get` commands to load related data in one call (e.g., `crm cases get 3 --include emails,tasks,notes,property`)
- `crm shift next` pre-loads thread + emails + contact + case + tasks + notes + property — use this during shifts instead of individual lookups
- Date range filters available: `--date-end-before`, `--date-end-after`, `--date-sent-before`, `--date-sent-after` (ISO dates)
- Draft emails do NOT affect thread.is_read — only archived/sent emails count. So creating a draft reply won't make a thread reappear as "unread"

## BTR/PRS Emergency Patterns

- Smart lock failures are lockout emergencies requiring immediate master key dispatch (30 min response target)
- Water leaks through light fittings are electrical hazards - instruct tenant to avoid switches/outlets and evacuate if sparking
- Repeat noise complaints (3+ incidents logged) require formal written warnings citing quiet enjoyment clause breach and potential tenancy termination

## CRITICAL: Welfare Emergency Response Protocol

**CASE 389 INCIDENT (March 2026) — Process Failure Documentation**

Welfare emergency at Graylings Apt 13A: 7-day delay between report and emergency services contact. Tenant missing 1+ week, strong smell, mail piling up. Report received March 6, action taken March 13.

**Critical Failure Points Identified:**
1. Draft reply created but NO physical welfare check conducted for 7 days
2. Welfare emergency indicators (smell + missing tenant + mail piling) not recognized as requiring immediate physical response
3. Tenant contact record missing from CRM (Apt 13A had no contact entry)
4. No automated monitoring/escalation for overdue critical priority tasks
5. Task created retrospectively with already-overdue deadline

**Correct Welfare Emergency Response:**
- **Smell + missing tenant + mail piling = IMMEDIATE physical welfare check** (same day, within 2 hours)
- Do NOT send draft email and wait — physical check required first
- Contact Gardaí (999/112) immediately if unable to reach tenant by phone/door knock
- Property manager MUST attend with master key
- Break door access if needed (life safety overrides property damage)
- Welfare checks are NOT routine maintenance — they are potential life-or-death situations

**Missing Contact Records:**
- ALL occupied units must have tenant contact records in CRM for emergency situations
- Conduct regular audits of contact completeness (quarterly minimum)
- Flag gaps to property managers immediately

**Process Improvements Required:**
1. Emergency triage training for all staff on welfare indicators
2. Automated alerts for overdue critical/urgent tasks
3. Contact record completeness audits
4. Clear protocol: welfare emergency = physical check within 2 hours, not email correspondence

## Collective Tenant Action & Planning Law

- **Organized resident petitions** (20+ signatures) require escalation beyond property manager level — needs senior management and legal review
- Planning objections to neighboring developments involve property law (light rights, boundary issues) and require specialized planning consultant engagement
- **Developer boundary incursions** during site surveys = trespass matter. Response: verify boundaries, document incursions with photos, issue cease-and-desist if confirmed
- Resident requests for planning submissions should be evaluated against: (1) legal standing, (2) impact on property rights, (3) duty of care to tenants
- Timeline commitments for complex legal matters: allow 7-10 business days for management coordination and legal review

