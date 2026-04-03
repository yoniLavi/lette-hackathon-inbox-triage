import { eq, asc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  emails,
  cases,
  tasks,
  notes,
  contacts,
  properties,
} from "@repo/crm-schema";
import type * as schema from "@repo/crm-schema";
import { serialize } from "./serialize.js";

type Db = NodePgDatabase<typeof schema>;

/**
 * Include specs: entity → include_name → resolver function.
 * Each resolver takes (db, parentRow) and returns the nested data.
 */
type IncludeResolver = (
  db: Db,
  row: Record<string, unknown>,
) => Promise<unknown>;

const INCLUDE_SPECS: Record<string, Record<string, IncludeResolver>> = {
  cases: {
    emails: async (db, row) => {
      const rows = await db
        .select()
        .from(emails)
        .where(eq(emails.case_id, row.id as number));
      return rows.map((r) => serialize(r));
    },
    tasks: async (db, row) => {
      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.case_id, row.id as number));
      return rows.map((r) => serialize(r));
    },
    notes: async (db, row) => {
      const rows = await db
        .select()
        .from(notes)
        .where(eq(notes.case_id, row.id as number));
      return rows.map((r) => serialize(r));
    },
    property: async (db, row) => {
      if (!row.property_id) return null;
      const [prop] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, row.property_id as number));
      return prop ? serialize(prop) : null;
    },
  },

  threads: {
    emails: async (db, row) => {
      const rows = await db
        .select()
        .from(emails)
        .where(eq(emails.thread_id, row.thread_id as string))
        .orderBy(asc(emails.thread_position));
      return rows.map((r) => serialize(r));
    },
    contact: async (db, row) => {
      if (!row.contact_id) return null;
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, row.contact_id as number));
      return contact ? serialize(contact) : null;
    },
  },

  emails: {
    contact: async (db, row) => {
      if (!row.from_address) return null;
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, row.from_address as string));
      return contact ? serialize(contact) : null;
    },
  },

  shifts: {
    case: async (db, row) => {
      if (!row.case_id) return null;
      const [caseObj] = await db
        .select()
        .from(cases)
        .where(eq(cases.id, row.case_id as number));
      return caseObj ? serialize(caseObj) : null;
    },
    notes: async (db, row) => {
      const rows = await db
        .select()
        .from(notes)
        .where(eq(notes.shift_id, row.id as number))
        .orderBy(asc(notes.created_at));
      return rows.map((r) => serialize(r));
    },
  },
};

export async function resolveIncludes(
  db: Db,
  entity: string,
  row: Record<string, unknown>,
  includeList: string[],
): Promise<void> {
  const specs = INCLUDE_SPECS[entity];
  if (!specs) return;

  for (const incName of includeList) {
    const resolver = specs[incName];
    if (resolver) {
      row[incName] = await resolver(db, row);
    }
  }
}
