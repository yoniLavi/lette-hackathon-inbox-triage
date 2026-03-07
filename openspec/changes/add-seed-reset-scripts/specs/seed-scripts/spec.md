## ADDED Requirements

### Requirement: CRM Reset
The project SHALL provide a script that removes all seeded data (Emails, Contacts, Accounts) from EspoCRM, returning it to a blank state for re-seeding or demo resets.

#### Scenario: Reset clears all data
- **WHEN** `node scripts/reset.mjs` is run against a populated EspoCRM instance
- **THEN** all Emails, Contacts, and Accounts are deleted
- **AND** subsequent API queries for these entities return empty lists

### Requirement: Property Seeding
The project SHALL provide a script that creates EspoCRM Accounts from the challenge dataset's property list, preserving property name, type, unit count, and manager assignment.

#### Scenario: Properties seeded as Accounts
- **WHEN** `node scripts/seed.mjs` is run against a clean EspoCRM instance
- **THEN** 5 Accounts are created, one per property in `proptech-test-data.json`
- **AND** each Account contains the property name, type (BTR/PRS), unit count, and manager name

### Requirement: Contact Seeding
The project SHALL create EspoCRM Contacts for each unique email sender in the challenge dataset, linked to their property Account where a `property_id` is present.

#### Scenario: Contacts created and linked
- **WHEN** `node scripts/seed.mjs` is run
- **THEN** a Contact is created for each unique sender email address
- **AND** Contacts with a `property_id` are linked to the corresponding Account
- **AND** sender type and role information is preserved on the Contact

### Requirement: Email Seeding
The project SHALL create EspoCRM Emails from the challenge dataset with correct sender, recipients, timestamps, body content, read status, and thread relationships.

#### Scenario: Emails seeded with threading
- **WHEN** `node scripts/seed.mjs` is run
- **THEN** 100 Emails are created matching the challenge dataset
- **AND** emails within the same `thread_id` are linked via reply relationships
- **AND** `dateSent`, `isRead`, `from`, `to`, `cc`, and `subject` match the source data

### Requirement: Reseed Convenience
The project SHALL provide a single command that resets the CRM and re-seeds all data in one step.

#### Scenario: Full reseed cycle
- **WHEN** `node scripts/reseed.mjs` is run
- **THEN** existing data is cleared and fresh data is seeded from the challenge dataset
- **AND** the final state matches a clean seed
