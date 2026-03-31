## MODIFIED Requirements

### Requirement: CRM Entity CRUD
The CRM API SHALL expose REST endpoints for managing Properties, Contacts, Emails, Tasks, Cases, Notes, Threads, and Shifts with consistent JSON responses, filtering, ordering, and pagination. The API SHALL be implemented in TypeScript using Hono and Drizzle ORM, with entity types inferred from a shared Drizzle schema (`@repo/crm-schema`).

#### Scenario: List entities with filters
- **WHEN** a client sends `GET /api/emails?status=archived&is_read=false&limit=10&order_by=date_sent&order=asc`
- **THEN** the API returns `{"list": [...], "total": N}` with matching emails

#### Scenario: Get entity by ID
- **WHEN** a client sends `GET /api/emails/42`
- **THEN** the API returns the full email record as JSON

#### Scenario: Create entity
- **WHEN** a client sends `POST /api/emails` with a JSON body
- **THEN** the API creates the record and returns it with status 201

#### Scenario: Update entity
- **WHEN** a client sends `PATCH /api/emails/42` with partial JSON
- **THEN** the API updates only the provided fields and returns the updated record

#### Scenario: Delete entity
- **WHEN** a client sends `DELETE /api/emails/42`
- **THEN** the API deletes the record and returns `{"deleted": true}`

#### Scenario: Full-text search on emails
- **WHEN** a client sends `GET /api/emails?search=water+leak`
- **THEN** the API returns emails matching the search terms in subject or body via PostgreSQL full-text search

#### Scenario: Dashboard counts
- **WHEN** a client sends `GET /api/counts`
- **THEN** the API returns `{"emails": N, "open_tasks": N, "closed_cases": N}`

#### Scenario: Shared schema types
- **WHEN** the CRM API starts
- **THEN** entity table definitions and TypeScript types are imported from `@repo/crm-schema`
- **AND** no type definitions are duplicated between the API, CLI, or frontend

## ADDED Requirements

### Requirement: Shared CRM Schema Package
The project SHALL maintain a `@repo/crm-schema` package containing Drizzle ORM table definitions for all CRM entities. This package SHALL be the single source of truth for database schema and TypeScript types, imported by the CRM API, CRM CLI, frontend, and scripts.

#### Scenario: Schema defines all entities
- **WHEN** the `@repo/crm-schema` package is imported
- **THEN** it exports Drizzle `pgTable` definitions for: properties, contacts, emails, tasks, cases, notes, threads, shifts
- **AND** it exports inferred `Select` and `Insert` TypeScript types for each entity

#### Scenario: Frontend imports types directly
- **WHEN** the frontend needs CRM entity types
- **THEN** it imports them from `@repo/crm-schema` (e.g., `import type { Email } from "@repo/crm-schema"`)
- **AND** no manual type interface definitions are maintained in the frontend

#### Scenario: Schema matches PostgreSQL
- **WHEN** the Drizzle schema is compared to the running PostgreSQL database
- **THEN** all table names, column names, column types, foreign keys, and defaults match exactly
