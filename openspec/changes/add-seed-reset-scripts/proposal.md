# Change: Add seed and reset scripts for CRM data

## Why
We need a repeatable way to populate EspoCRM with the challenge dataset (5 properties, their contacts, and 100 test emails) and to reset the CRM to a clean state for iteration and demo resets.

## What Changes
- Add a **reset script** that wipes all CRM data (Emails, Contacts, Accounts) back to a blank slate
- Add a **seed script** that reads the challenge JSON and creates:
  - Accounts for each property (with type, units, manager info)
  - Contacts for each unique sender (linked to their Account where applicable)
  - Emails with correct from/to/cc, timestamps, threading (via `messageId`/`replied`), and read status
- Both scripts use the EspoCRM REST API with credentials from `.env`
- Add a convenience wrapper that runs reset then seed in sequence

## Impact
- Affected specs: new `seed-scripts` capability
- Affected code: new `scripts/` directory at project root
