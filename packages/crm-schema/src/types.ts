import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  shifts,
  properties,
  contacts,
  cases,
  emails,
  tasks,
  notes,
  threads,
} from "./schema.js";

// Select types (what you get back from queries)
export type Shift = InferSelectModel<typeof shifts>;
export type Property = InferSelectModel<typeof properties>;
export type Contact = InferSelectModel<typeof contacts>;
export type Case = InferSelectModel<typeof cases>;
export type Email = InferSelectModel<typeof emails>;
export type Task = InferSelectModel<typeof tasks>;
export type Note = InferSelectModel<typeof notes>;
export type Thread = InferSelectModel<typeof threads>;

// Insert types (what you provide for creation)
export type NewShift = InferInsertModel<typeof shifts>;
export type NewProperty = InferInsertModel<typeof properties>;
export type NewContact = InferInsertModel<typeof contacts>;
export type NewCase = InferInsertModel<typeof cases>;
export type NewEmail = InferInsertModel<typeof emails>;
export type NewTask = InferInsertModel<typeof tasks>;
export type NewNote = InferInsertModel<typeof notes>;
export type NewThread = InferInsertModel<typeof threads>;

/**
 * API response types — Date fields serialized to ISO strings, nullables preserved.
 * Use these in the frontend and scripts that consume the REST API.
 */
type Serialize<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K];
};

export type ApiShift = Serialize<Shift>;
export type ApiProperty = Serialize<Property>;
export type ApiContact = Serialize<Contact>;
export type ApiCase = Serialize<Case>;
export type ApiEmail = Serialize<Email>;
export type ApiTask = Serialize<Task>;
export type ApiNote = Serialize<Note>;
export type ApiThread = Serialize<Thread>;

// Entity name → table mapping (used by generic CRUD)
export const ENTITY_TABLES = {
  properties,
  contacts,
  emails,
  cases,
  tasks,
  notes,
  threads,
  shifts,
} as const;

export type EntityName = keyof typeof ENTITY_TABLES;

// Re-export table references for convenience
export {
  shifts,
  properties,
  contacts,
  cases,
  emails,
  tasks,
  notes,
  threads,
} from "./schema.js";
