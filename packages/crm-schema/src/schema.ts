import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  started_at: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).default("in_progress"),
  threads_processed: integer("threads_processed").default(0),
  emails_processed: integer("emails_processed").default(0),
  drafts_created: integer("drafts_created").default(0),
  tasks_created: integer("tasks_created").default(0),
  summary: text("summary"),
  cost_usd: doublePrecision("cost_usd"),
  current_thread_id: integer("current_thread_id"),
  case_id: integer("case_id").references(() => cases.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 10 }),
  units: integer("units"),
  manager: varchar("manager", { length: 255 }),
  manager_email: varchar("manager_email", { length: 255 }),
  description: text("description"),
  challenge_id: varchar("challenge_id", { length: 50 }).unique(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  first_name: varchar("first_name", { length: 255 }),
  last_name: varchar("last_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  type: varchar("type", { length: 50 }),
  property_id: integer("property_id").references(() => properties.id),
  company: varchar("company", { length: 255 }),
  unit: varchar("unit", { length: 100 }),
  role: varchar("role", { length: 255 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  status: varchar("status", { length: 20 }).default("new"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  description: text("description"),
  property_id: integer("property_id").references(() => properties.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const emails = pgTable(
  "emails",
  {
    id: serial("id").primaryKey(),
    subject: varchar("subject", { length: 500 }),
    from_address: varchar("from_address", { length: 255 }),
    to_addresses: text("to_addresses")
      .array()
      .$type<string[]>(),
    cc_addresses: text("cc_addresses")
      .array()
      .$type<string[]>(),
    body: text("body"),
    body_plain: text("body_plain"),
    date_sent: timestamp("date_sent", { withTimezone: true }),
    status: varchar("status", { length: 20 }).default("archived"),
    is_read: boolean("is_read").default(false),
    is_replied: boolean("is_replied").default(false),
    is_important: boolean("is_important").default(false),
    message_id: varchar("message_id", { length: 255 }),
    in_reply_to: varchar("in_reply_to", { length: 255 }),
    thread_id: varchar("thread_id", { length: 100 }),
    thread_position: integer("thread_position"),
    challenge_id: varchar("challenge_id", { length: 50 }).unique(),
    case_id: integer("case_id").references(() => cases.id),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("ix_emails_fts").using(
      "gin",
      sql`to_tsvector('english', coalesce(${table.subject},'') || ' ' || coalesce(${table.body},''))`,
    ),
  ],
);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  status: varchar("status", { length: 20 }).default("not_started"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  description: text("description"),
  date_start: timestamp("date_start", { withTimezone: true }),
  date_end: timestamp("date_end", { withTimezone: true }),
  case_id: integer("case_id").references(() => cases.id),
  contact_id: integer("contact_id").references(() => contacts.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  content: text("content"),
  case_id: integer("case_id").references(() => cases.id),
  shift_id: integer("shift_id").references(() => shifts.id),
  task_id: integer("task_id").references(() => tasks.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const threads = pgTable(
  "threads",
  {
    id: serial("id").primaryKey(),
    thread_id: varchar("thread_id", { length: 100 }).notNull(),
    subject: varchar("subject", { length: 500 }),
    last_activity_at: timestamp("last_activity_at", { withTimezone: true }),
    email_count: integer("email_count").default(0),
    is_read: boolean("is_read").default(false),
    case_id: integer("case_id").references(() => cases.id),
    property_id: integer("property_id").references(() => properties.id),
    contact_id: integer("contact_id").references(() => contacts.id),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("threads_thread_id_unique").on(table.thread_id)],
);
