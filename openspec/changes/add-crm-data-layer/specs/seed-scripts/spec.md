## MODIFIED Requirements

### Requirement: CRM Reset
The project SHALL provide a script that removes all seeded data (Emails, Contacts, Accounts, Cases, Tasks) from EspoCRM, returning it to a blank state for re-seeding or demo resets.

#### Scenario: Reset clears all data
- **WHEN** `python scripts/reset.py` is run against a populated EspoCRM instance
- **THEN** all Emails, Contacts, Accounts, Cases, and Tasks are deleted
- **AND** subsequent API queries for these entities return empty lists

## ADDED Requirements

### Requirement: Case Seeding
The seed script SHALL create a small number of example Cases that group existing seeded Emails, with linked Tasks and Notes, to populate the frontend dashboard before the agent runs.

#### Scenario: Demo cases seeded
- **WHEN** `python scripts/seed.py` is run after emails and contacts are seeded
- **THEN** 1-2 Cases are created with names, priorities, and descriptions summarizing the linked emails
- **AND** each Case is linked to relevant Emails and the corresponding Account
- **AND** at least one Task is created per Case with a description and priority
