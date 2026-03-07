## Context
The challenge dataset has 100 emails across threads, with senders of various types (tenant, landlord, contractor, prospect, internal, legal) and 5 properties. We need to map this into EspoCRM's entity model.

## Entity Mapping

| Challenge Data | EspoCRM Entity | Notes |
|---|---|---|
| Property | Account | name, type (BTR/PRS) stored in description, units in description |
| Sender | Contact | firstName, lastName, emailAddress; linked to Account via `accountId` |
| Email | Email | subject, body, from, to, cc, dateSent, status, isRead |

## Decisions

- **Accounts for properties, not custom entities** — EspoCRM Accounts are the natural fit and avoid custom entity configuration. Property metadata (type, units, manager) goes in the description field.
- **Contacts for all senders** — every unique email address becomes a Contact. Sender type/role from the challenge data goes in the `description` field. Contacts are linked to their property Account when `property_id` is present.
- **Email threading via messageId** — each email gets a unique `messageId` header. Replies reference the parent via the `repliedId` link, preserving thread structure.
- **Simple Node.js scripts using fetch** — no framework, just the built-in `fetch` API (Node 18+). Reads `.env` via `dotenv` or manual parsing.
- **Reset via bulk delete** — iterate through Emails, Contacts, Accounts and delete via API. Simple and reliable for a dev/demo workflow.

## Non-Goals
- No Docker container for scripts — run directly from host with `node`
- No incremental/idempotent seeding — reset + seed is the workflow
