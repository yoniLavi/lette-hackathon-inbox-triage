import { Hono } from "hono";
import {
  eq,
  sql,
  asc,
  desc,
  count,
  and,
  ne,
  inArray,
  lte,
  gte,
  getTableColumns,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
  emails,
  cases,
  tasks,
  threads,
  ENTITY_TABLES,
  type EntityName,
} from "@repo/crm-schema";
import { db } from "./db.js";
import { serialize, coerceValue } from "./serialize.js";
import { resolveIncludes } from "./includes.js";
import { upsertThread } from "./threads.js";

const log = (msg: string, ...args: unknown[]) =>
  console.log(`[crm] ${msg}`, ...args);

// ---------------------------------------------------------------------------
// Entity-specific filters
// ---------------------------------------------------------------------------
const FILTERS: Record<string, string[]> = {
  properties: ["type", "challenge_id"],
  contacts: ["type", "property_id", "email"],
  emails: [
    "status",
    "is_read",
    "is_replied",
    "thread_id",
    "case_id",
    "challenge_id",
  ],
  cases: ["status", "priority", "property_id"],
  tasks: ["status", "priority", "case_id", "contact_id"],
  notes: ["case_id", "shift_id", "task_id"],
  threads: ["is_read", "case_id", "property_id", "contact_id"],
  shifts: ["status"],
};

// Date columns that support range filters
const DATE_COLUMNS = [
  "date_end",
  "date_start",
  "date_sent",
  "created_at",
  "updated_at",
];

// ---------------------------------------------------------------------------
// Column type inference helpers
// ---------------------------------------------------------------------------
function getColumnType(
  col: PgColumn,
): "timestamp" | "boolean" | "integer" | "other" {
  const dt = col.dataType;
  if (dt === "date") return "timestamp";
  if (col.columnType === "PgTimestamp") return "timestamp";
  if (col.columnType === "PgBoolean") return "boolean";
  if (
    col.columnType === "PgInteger" ||
    col.columnType === "PgSerial"
  )
    return "integer";
  return "other";
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export const apiRoutes = new Hono();

// Health
apiRoutes.get("/health", (c) => c.json({ status: "ok" }));

// Counts
apiRoutes.get("/api/counts", async (c) => {
  const [emailTotal] = await db.select({ value: count() }).from(emails);
  const [openTasks] = await db
    .select({ value: count() })
    .from(tasks)
    .where(ne(tasks.status, "completed"));
  const [closedCases] = await db
    .select({ value: count() })
    .from(cases)
    .where(eq(cases.status, "closed"));
  return c.json({
    emails: emailTotal.value,
    open_tasks: openTasks.value,
    closed_cases: closedCases.value,
  });
});

// ---------------------------------------------------------------------------
// Shift endpoints
// ---------------------------------------------------------------------------
apiRoutes.get("/api/shift/next", async (c) => {
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.is_read, false))
    .orderBy(asc(threads.last_activity_at))
    .limit(1);

  if (!thread) return c.json({ thread: null, case: null });

  const threadDict = serialize(thread) as Record<string, unknown>;
  await resolveIncludes(db, "threads", threadDict, ["emails", "contact"]);

  let caseDict: Record<string, unknown> | null = null;
  if (thread.case_id) {
    const [caseObj] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, thread.case_id));
    if (caseObj) {
      caseDict = serialize(caseObj) as Record<string, unknown>;
      await resolveIncludes(db, "cases", caseDict, [
        "emails",
        "tasks",
        "notes",
        "property",
      ]);
    }
  }

  return c.json({ thread: threadDict, case: caseDict });
});

apiRoutes.post("/api/shift/complete", async (c) => {
  const data = await c.req.json();
  const emailIds: number[] = data.email_ids || [];
  const threadIdStr: string | undefined = data.thread_id;
  const caseId: number | undefined = data.case_id;

  let updated = 0;
  if (emailIds.length > 0) {
    const values: Record<string, unknown> = {
      is_read: true,
      updated_at: new Date(),
    };
    if (caseId !== undefined) values.case_id = caseId;

    const result = await db
      .update(emails)
      .set(values)
      .where(inArray(emails.id, emailIds));
    updated = result.rowCount ?? 0;
  }

  if (threadIdStr && caseId !== undefined) {
    await db
      .update(threads)
      .set({ case_id: caseId, updated_at: new Date() })
      .where(eq(threads.thread_id, threadIdStr));
  }

  if (threadIdStr) {
    await upsertThread(db, threadIdStr);
  }

  log(
    "Shift complete: marked %d emails read, thread=%s case=%s",
    updated,
    threadIdStr,
    caseId,
  );
  return c.json({ emails_updated: updated });
});

apiRoutes.get("/api/shift/incomplete", async (c) => {
  // Cases needing triage: new/in_progress with no tasks and no draft emails
  // Exclude shift journal cases (name starts with "Agent Shift")
  const result = await db
    .select()
    .from(cases)
    .where(
      and(
        inArray(cases.status, ["new", "in_progress"]),
        sql`NOT EXISTS (SELECT 1 FROM ${tasks} WHERE ${tasks.case_id} = ${cases.id})`,
        sql`NOT EXISTS (SELECT 1 FROM ${emails} WHERE ${emails.case_id} = ${cases.id} AND ${emails.status} = 'draft')`,
        sql`${cases.name} NOT LIKE 'Agent Shift%'`,
      ),
    )
    .orderBy(asc(cases.created_at));

  const items: Record<string, unknown>[] = [];
  for (const c of result) {
    const d = serialize(c) as Record<string, unknown>;
    await resolveIncludes(db, "cases", d, ["emails", "notes", "property"]);
    items.push(d);
  }

  return c.json({ list: items, total: items.length });
});

// ---------------------------------------------------------------------------
// Bulk email update
// ---------------------------------------------------------------------------
apiRoutes.patch("/api/emails/bulk", async (c) => {
  const data = await c.req.json();
  const ids: number[] = data.ids || [];
  const updates: Record<string, unknown> = data.updates || {};

  if (!ids.length || !Object.keys(updates).length) {
    return c.json({ error: "Both 'ids' and 'updates' are required" }, 400);
  }

  const cols = getTableColumns(emails);
  const validUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (k in cols && k !== "id") {
      const col = (cols as Record<string, PgColumn>)[k];
      validUpdates[k] = coerceValue(getColumnType(col), v);
    }
  }
  validUpdates.updated_at = new Date();

  const result = await db
    .update(emails)
    .set(validUpdates)
    .where(inArray(emails.id, ids));

  // Recompute threads for affected emails
  const affectedThreads = await db
    .selectDistinct({ thread_id: emails.thread_id })
    .from(emails)
    .where(inArray(emails.id, ids));
  for (const { thread_id } of affectedThreads) {
    if (thread_id) await upsertThread(db, thread_id);
  }

  log("Bulk updated %d emails", result.rowCount ?? 0);
  return c.json({ updated: result.rowCount ?? 0 });
});

// ---------------------------------------------------------------------------
// Generic CRUD routes
// ---------------------------------------------------------------------------
apiRoutes.get("/api/:entity", async (c) => {
  const entityName = c.req.param("entity") as EntityName;
  const table = ENTITY_TABLES[entityName];
  if (!table) return c.json({ detail: `Unknown entity: ${entityName}` }, 404);

  const query = c.req.query();
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const orderBy = query.order_by || "created_at";
  const order = query.order || "desc";
  const search = query.search;
  const include = query.include;

  const cols = getTableColumns(table);
  const conditions: SQL[] = [];

  // Entity-specific filters
  for (const field of FILTERS[entityName] || []) {
    const val = query[field];
    if (val !== undefined) {
      const col = (cols as Record<string, PgColumn>)[field];
      if (col) {
        const colType = getColumnType(col);
        const coerced = coerceValue(colType, val);
        conditions.push(eq(col, coerced as never));
      }
    }
  }

  // Date range filters
  for (const dateField of DATE_COLUMNS) {
    const col = (cols as Record<string, PgColumn>)[dateField];
    if (!col) continue;
    const before = query[`${dateField}_before`];
    const after = query[`${dateField}_after`];
    if (before) {
      const dt = new Date(before.replace("Z", "+00:00"));
      if (!isNaN(dt.getTime())) conditions.push(lte(col, dt as never));
    }
    if (after) {
      const dt = new Date(after.replace("Z", "+00:00"));
      if (!isNaN(dt.getTime())) conditions.push(gte(col, dt as never));
    }
  }

  // Full-text search (emails only)
  if (search && entityName === "emails") {
    conditions.push(
      sql`to_tsvector('english', coalesce(${emails.subject},'') || ' ' || coalesce(${emails.body},'')) @@ plainto_tsquery('english', ${search})`,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Ordering
  const orderCol = (cols as Record<string, PgColumn>)[orderBy] || (cols as Record<string, PgColumn>)["created_at"];
  const orderFn = order === "asc" ? asc : desc;

  const [totalResult] = await db
    .select({ value: count() })
    .from(table)
    .where(whereClause);

  const rows = await db
    .select()
    .from(table)
    .where(whereClause)
    .orderBy(orderFn(orderCol))
    .limit(limit)
    .offset(offset);

  const items = rows.map((r) => serialize(r as Record<string, unknown>));

  if (include) {
    const includeList = include
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const item of items) {
      await resolveIncludes(db, entityName, item, includeList);
    }
  }

  return c.json({ list: items, total: totalResult.value });
});

apiRoutes.get("/api/:entity/:id", async (c) => {
  const entityName = c.req.param("entity") as EntityName;
  const table = ENTITY_TABLES[entityName];
  if (!table) return c.json({ detail: `Unknown entity: ${entityName}` }, 404);

  const id = Number(c.req.param("id"));
  const cols = getTableColumns(table);
  const idCol = (cols as Record<string, PgColumn>)["id"];

  const [row] = await db
    .select()
    .from(table)
    .where(eq(idCol, id as never));
  if (!row)
    return c.json({ detail: `${entityName} ${id} not found` }, 404);

  const obj = serialize(row as Record<string, unknown>);

  const include = c.req.query("include");
  if (include) {
    const includeList = include
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await resolveIncludes(db, entityName, obj, includeList);
  }

  return c.json(obj);
});

apiRoutes.post("/api/:entity", async (c) => {
  const entityName = c.req.param("entity") as EntityName;
  const table = ENTITY_TABLES[entityName];
  if (!table) return c.json({ detail: `Unknown entity: ${entityName}` }, 404);

  const data = await c.req.json();
  const cols = getTableColumns(table);

  const valid: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k in cols && k !== "id") {
      const col = (cols as Record<string, PgColumn>)[k];
      valid[k] = coerceValue(getColumnType(col), v);
    }
  }

  const [created] = await db
    .insert(table)
    .values(valid as never)
    .returning();

  log("Created %s %d", entityName, (created as Record<string, unknown>).id);

  // Auto-upsert thread when an email is created
  if (
    entityName === "emails" &&
    (created as Record<string, unknown>).thread_id
  ) {
    await upsertThread(
      db,
      (created as Record<string, unknown>).thread_id as string,
    );
  }

  c.status(201);
  return c.json(serialize(created as Record<string, unknown>));
});

apiRoutes.patch("/api/:entity/:id", async (c) => {
  const entityName = c.req.param("entity") as EntityName;
  const table = ENTITY_TABLES[entityName];
  if (!table) return c.json({ detail: `Unknown entity: ${entityName}` }, 404);

  const id = Number(c.req.param("id"));
  const cols = getTableColumns(table);
  const idCol = (cols as Record<string, PgColumn>)["id"];

  // Check existence
  const [existing] = await db
    .select()
    .from(table)
    .where(eq(idCol, id as never));
  if (!existing)
    return c.json({ detail: `${entityName} ${id} not found` }, 404);

  const data = await c.req.json();
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k in cols && k !== "id") {
      const col = (cols as Record<string, PgColumn>)[k];
      updates[k] = coerceValue(getColumnType(col), v);
    }
  }
  updates.updated_at = new Date();

  const [updated] = await db
    .update(table)
    .set(updates as never)
    .where(eq(idCol, id as never))
    .returning();

  log("Updated %s %d", entityName, id);

  // Auto-upsert thread when an email is updated
  if (
    entityName === "emails" &&
    (updated as Record<string, unknown>).thread_id
  ) {
    await upsertThread(
      db,
      (updated as Record<string, unknown>).thread_id as string,
    );
  }

  return c.json(serialize(updated as Record<string, unknown>));
});

apiRoutes.delete("/api/:entity/:id", async (c) => {
  const entityName = c.req.param("entity") as EntityName;
  const table = ENTITY_TABLES[entityName];
  if (!table) return c.json({ detail: `Unknown entity: ${entityName}` }, 404);

  const id = Number(c.req.param("id"));
  const cols = getTableColumns(table);
  const idCol = (cols as Record<string, PgColumn>)["id"];

  // Get row before deletion (for thread_id capture)
  const [existing] = await db
    .select()
    .from(table)
    .where(eq(idCol, id as never));
  if (!existing)
    return c.json({ detail: `${entityName} ${id} not found` }, 404);

  const threadIdStr =
    entityName === "emails"
      ? (existing as Record<string, unknown>).thread_id
      : null;

  await db.delete(table).where(eq(idCol, id as never));
  log("Deleted %s %d", entityName, id);

  if (threadIdStr) {
    await upsertThread(db, threadIdStr as string);
  }

  return c.json({ deleted: true });
});

apiRoutes.delete("/api/:entity", async (c) => {
  const entityName = c.req.param("entity") as EntityName;
  const table = ENTITY_TABLES[entityName];
  if (!table) return c.json({ detail: `Unknown entity: ${entityName}` }, 404);

  if (c.req.header("x-confirm-destructive") !== "true") {
    return c.json(
      { detail: "Bulk delete requires header: x-confirm-destructive: true" },
      400,
    );
  }

  const result = await db.delete(table);
  log("Deleted all %s (%d rows)", entityName, result.rowCount ?? 0);
  return c.json({ deleted: true, count: result.rowCount ?? 0 });
});
