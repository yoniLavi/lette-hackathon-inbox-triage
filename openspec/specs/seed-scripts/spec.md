# seed-scripts Specification

## Purpose
TypeScript scripts for seeding and resetting the CRM PostgreSQL database from the PropTech challenge dataset (`challenge-definition/proptech-test-data.json`).

## Requirements

### Requirement: CRM Reset
The project SHALL provide a script that removes all seeded data from the CRM API, returning it to a blank state.

#### Scenario: Reset clears all data
- **WHEN** `pnpm reset` (or `npx tsx scripts/reset.ts`) is run against a populated CRM
- **THEN** all entities (Notes, Tasks, Shifts, Threads, Emails, Cases, Contacts, Properties) are deleted in dependency order
- **AND** subsequent API queries return empty lists

### Requirement: Property Seeding
The seed script SHALL create CRM Properties from the challenge dataset.

#### Scenario: Properties seeded
- **WHEN** `pnpm seed` is run against a clean CRM
- **THEN** 5 Properties are created from `proptech-test-data.json`
- **AND** each Property has name, type (BTR/PRS), unit count, manager name, and a derived `manager_email`

### Requirement: Contact Seeding
The seed script SHALL create Contacts for each unique email sender, linked to their Property where applicable.

#### Scenario: Contacts created and linked
- **WHEN** `pnpm seed` is run
- **THEN** a Contact is created for each unique sender email address
- **AND** Contacts with a `property_id` are linked to the corresponding Property
- **AND** sender type, role, company, and unit information is preserved

### Requirement: Email Seeding
The seed script SHALL create Emails from the challenge dataset with threading, read status, and message relationships.

#### Scenario: Emails seeded with threading
- **WHEN** `pnpm seed` is run
- **THEN** 100 Emails are created matching the challenge dataset
- **AND** `thread_id` and `thread_position` are set for threaded conversations
- **AND** reply emails have `in_reply_to` set to the parent email's `message_id`
- **AND** Thread records are auto-created by the CRM API via trigger logic

### Requirement: Reseed Convenience
The project SHALL provide a single command to reset and re-seed in one step.

#### Scenario: Full reseed cycle
- **WHEN** `pnpm reseed` is run
- **THEN** existing data is cleared and fresh data is seeded from the challenge dataset
- **AND** the final state matches a clean seed
