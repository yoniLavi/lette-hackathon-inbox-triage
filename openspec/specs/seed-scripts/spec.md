# seed-scripts Specification

## Purpose
TBD - created by archiving change add-seed-reset-scripts. Update Purpose after archive.
## Requirements
### Requirement: CRM Reset
The project SHALL provide a script that removes all seeded data (Emails, Contacts, Accounts, Cases, Tasks) from EspoCRM, returning it to a blank state for re-seeding or demo resets.

#### Scenario: Reset clears all data
- **WHEN** `python scripts/reset.py` is run against a populated EspoCRM instance
- **THEN** all Emails, Contacts, Accounts, Cases, and Tasks are deleted
- **AND** subsequent API queries for these entities return empty lists

### Requirement: Property Seeding
The project SHALL provide a script that creates EspoCRM Accounts from the challenge dataset's property list, preserving property name, type, unit count, and manager assignment.

#### Scenario: Properties seeded as Accounts
- **WHEN** `python scripts/seed.py` is run against a clean EspoCRM instance
- **THEN** 5 Accounts are created, one per property in `proptech-test-data.json`
- **AND** each Account contains the property name, type (BTR/PRS), unit count, and manager name

### Requirement: Contact Seeding
The project SHALL create EspoCRM Contacts for each unique email sender in the challenge dataset, linked to their property Account where a `property_id` is present.

#### Scenario: Contacts created and linked
- **WHEN** `python scripts/seed.py` is run
- **THEN** a Contact is created for each unique sender email address
- **AND** Contacts with a `property_id` are linked to the corresponding Account
- **AND** sender type and role information is preserved on the Contact

### Requirement: Email Seeding
The project SHALL create EspoCRM Emails from the challenge dataset with correct sender, recipients, timestamps, body content, read status, and thread relationships.

#### Scenario: Emails seeded with threading
- **WHEN** `python scripts/seed.py` is run
- **THEN** 100 Emails are created matching the challenge dataset
- **AND** emails within the same `thread_id` are linked via reply relationships
- **AND** `dateSent`, `isRead`, `from`, `to`, `cc`, and `subject` match the source data

### Requirement: Reseed Convenience
The project SHALL provide a single command that resets the CRM and re-seeds all data in one step.

#### Scenario: Full reseed cycle
- **WHEN** `python scripts/reseed.py` is run
- **THEN** existing data is cleared and fresh data is seeded from the challenge dataset
- **AND** the final state matches a clean seed

### Requirement: Case Seeding
The seed script SHALL create a small number of example Cases that group existing seeded Emails, with linked Tasks and Notes, to populate the frontend dashboard before the agent runs.

#### Scenario: Demo cases seeded
- **WHEN** `python scripts/seed.py` is run after emails and contacts are seeded
- **THEN** 1-2 Cases are created with names, priorities, and descriptions summarizing the linked emails
- **AND** each Case is linked to relevant Emails and the corresponding Account
- **AND** at least one Task is created per Case with a description and priority

