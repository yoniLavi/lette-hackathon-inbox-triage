## 1. Reset Script

- [ ] 1.1 Create `scripts/reset.mjs` that deletes all Emails, Contacts, and Accounts via EspoCRM REST API
- [ ] 1.2 Verify reset leaves CRM in a clean state (no Emails, Contacts, or Accounts)

## 2. Seed Script

- [ ] 2.1 Create `scripts/seed.mjs` that reads `challenge-definition/proptech-test-data.json`
- [ ] 2.2 Seed Accounts from `metadata.properties` (name, type, units, manager)
- [ ] 2.3 Seed Contacts from unique email senders (linked to property Account where applicable)
- [ ] 2.4 Seed Emails with subject, body, from, to, cc, dateSent, isRead, and thread linking
- [ ] 2.5 Verify seeded data appears correctly in EspoCRM UI

## 3. Convenience Wrapper

- [ ] 3.1 Create `scripts/reseed.mjs` that runs reset then seed in sequence
- [ ] 3.2 Verify full reset-and-seed cycle works end to end
