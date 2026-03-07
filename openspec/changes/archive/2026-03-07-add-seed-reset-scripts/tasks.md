## 0. Setup

- [x] 0.1 Scripts use uv inline metadata (PEP 723) for dependency management — no requirements.txt needed

## 1. Reset Script

- [x] 1.1 Create `scripts/reset.py` that deletes all Emails, Contacts, and Accounts via EspoCRM REST API
- [x] 1.2 Verify reset leaves CRM in a clean state (no Emails, Contacts, or Accounts)

## 2. Seed Script

- [x] 2.1 Create `scripts/seed.py` that reads `challenge-definition/proptech-test-data.json`
- [x] 2.2 Seed Accounts from `metadata.properties` (name, type, units, manager)
- [x] 2.3 Seed Contacts from unique email senders (linked to property Account where applicable)
- [x] 2.4 Seed Emails with subject, body, from, to, cc, dateSent, isRead, and thread linking
- [x] 2.5 Verify seeded data appears correctly in EspoCRM UI

## 3. Convenience Wrapper

- [x] 3.1 Create `scripts/reseed.py` that runs reset then seed in sequence
- [x] 3.2 Verify full reset-and-seed cycle works end to end
