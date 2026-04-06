# seed-scripts Specification

## Purpose
TypeScript scripts for seeding and resetting the CRM PostgreSQL database from the PropTech challenge dataset (`challenge-definition/proptech-test-data.json`).
## Requirements
### Requirement: CRM Reset
The project SHALL provide a script that removes all seeded data from the CRM, returning it to a blank state for re-seeding or demo resets.

#### Scenario: Reset clears all data
- **WHEN** `npx tsx scripts/reset.ts` is run against a populated CRM
- **THEN** all entities are deleted in correct FK order
- **AND** subsequent API queries return empty lists

### Requirement: Property Seeding
The project SHALL provide a script that creates CRM Properties from the challenge dataset, preserving property name, type, unit count, and manager assignment.

#### Scenario: Properties seeded
- **WHEN** `npx tsx scripts/seed.ts` is run against a clean CRM
- **THEN** 5 Properties are created matching `proptech-test-data.json`

### Requirement: Contact Seeding
The project SHALL create Contacts for each unique email sender in the challenge dataset, linked to their Property where a `property_id` is present.

#### Scenario: Contacts created and linked
- **WHEN** `npx tsx scripts/seed.ts` is run
- **THEN** a Contact is created for each unique sender email address
- **AND** Contacts with a `property_id` are linked to the corresponding Property

### Requirement: Email Seeding
The project SHALL create Emails from the challenge dataset with correct sender, recipients, timestamps, body content, read status, and thread relationships.

#### Scenario: Emails seeded with threading
- **WHEN** `npx tsx scripts/seed.ts` is run
- **THEN** 100 Emails are created matching the challenge dataset
- **AND** Thread records are auto-created via the CRM API's thread upsert logic

### Requirement: Reseed Convenience
The project SHALL provide a single command that resets the CRM and re-seeds all data in one step.

#### Scenario: Full reseed cycle
- **WHEN** `npx tsx scripts/reseed.ts` is run
- **THEN** existing data is cleared and fresh data is seeded

### Requirement: Case Seeding
The seed script SHALL create example Cases that group existing seeded Emails, with linked Tasks and Notes, to populate the frontend dashboard before the agent runs.

#### Scenario: Demo cases seeded
- **WHEN** `npx tsx scripts/seed.ts` is run after emails and contacts are seeded
- **THEN** Cases are created with names, priorities, and descriptions
- **AND** each Case is linked to relevant Emails and the corresponding Property
- **AND** at least one Task is created per Case

