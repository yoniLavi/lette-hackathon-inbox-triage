import { eq, sql, desc, ne, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { emails, threads, contacts, cases } from "@repo/crm-schema";
import type * as schema from "@repo/crm-schema";

type Db = NodePgDatabase<typeof schema>;

/**
 * Recompute a Thread row from its emails.
 * Creates the thread if it doesn't exist, deletes it if no emails remain.
 * Draft emails are excluded from is_read computation.
 */
export async function upsertThread(db: Db, threadIdStr: string): Promise<void> {
  if (!threadIdStr) return;

  // Aggregate from emails with this thread_id
  const [agg] = await db
    .select({
      cnt: sql<number>`count(${emails.id})`.as("cnt"),
      last_activity: sql<Date | null>`max(${emails.date_sent})`.as(
        "last_activity",
      ),
      subject: sql<string | null>`min(${emails.subject})`.as("subject"),
      case_id: sql<number | null>`max(${emails.case_id})`.as("case_id"),
    })
    .from(emails)
    .where(eq(emails.thread_id, threadIdStr));

  // is_read: true only when all non-draft emails are read
  const [readAgg] = await db
    .select({
      all_read: sql<boolean | null>`bool_and(${emails.is_read})`.as(
        "all_read",
      ),
    })
    .from(emails)
    .where(and(eq(emails.thread_id, threadIdStr), ne(emails.status, "draft")));

  const allRead = readAgg.all_read ?? true; // No non-draft emails → treat as read

  if (agg.cnt === 0) {
    // No emails left — delete thread if it exists
    await db.delete(threads).where(eq(threads.thread_id, threadIdStr));
    return;
  }

  // Resolve contact_id and property_id from the latest email's from_address
  const [latestEmail] = await db
    .select({ from_address: emails.from_address })
    .from(emails)
    .where(eq(emails.thread_id, threadIdStr))
    .orderBy(desc(emails.date_sent))
    .limit(1);

  let contactId: number | null = null;
  let propertyId: number | null = null;

  if (latestEmail?.from_address) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.email, latestEmail.from_address));
    if (contact) {
      contactId = contact.id;
      propertyId = contact.property_id;
    }
  }

  // Also try to get property_id from the case
  if (!propertyId && agg.case_id) {
    const [caseRow] = await db
      .select({ property_id: cases.property_id })
      .from(cases)
      .where(eq(cases.id, agg.case_id));
    if (caseRow) propertyId = caseRow.property_id;
  }

  // Upsert: try update first, then insert if not found
  const [existing] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(eq(threads.thread_id, threadIdStr));

  // Ensure last_activity is a proper Date (pg driver may return string from aggregates)
  const lastActivity = agg.last_activity instanceof Date
    ? agg.last_activity
    : agg.last_activity
      ? new Date(agg.last_activity as unknown as string)
      : null;

  const threadData = {
    subject: agg.subject,
    last_activity_at: lastActivity,
    email_count: agg.cnt,
    is_read: allRead,
    case_id: agg.case_id,
    contact_id: contactId,
    property_id: propertyId,
    updated_at: new Date(),
  };

  if (existing) {
    await db
      .update(threads)
      .set(threadData)
      .where(eq(threads.id, existing.id));
  } else {
    await db.insert(threads).values({
      thread_id: threadIdStr,
      ...threadData,
    });
  }
}
