## MODIFIED Requirements

### Requirement: Seed CRM Data
The seed script SHALL populate the CRM API with challenge dataset records, replacing direct EspoCRM API calls.

#### Scenario: Seed test data
- **WHEN** `uv run scripts/seed.py` is executed
- **THEN** 5 properties, all contacts, and 100 emails from the challenge dataset are created via the CRM API
- **AND** email threading is preserved via `thread_id`

#### Scenario: Reset data
- **WHEN** `uv run scripts/reset.py` is executed
- **THEN** all CRM data is deleted via the CRM API

#### Scenario: Idempotent seeding
- **WHEN** seed.py is run multiple times
- **THEN** it does not create duplicate records
