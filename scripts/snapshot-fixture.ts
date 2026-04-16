/**
 * Snapshot CRM data after a shift run for use as E2E test fixtures.
 * Captures a representative case with its tasks, emails (incl. drafts), notes, and threads.
 *
 * Run: npx tsx scripts/snapshot-fixture.ts
 * Output: tests/fixtures/e2e-cases.json
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:8002";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../tests/fixtures/e2e-cases.json");

interface CrmRecord {
  id: number;
  [key: string]: unknown;
}

async function get<T = CrmRecord[]>(path: string): Promise<T> {
  const res = await fetch(`${CRM_API_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  const data = (await res.json()) as { list?: T } & T;
  return data.list !== undefined ? data.list : data;
}

function stripIds(records: CrmRecord[]): Record<string, unknown>[] {
  return records.map(({ id, created_at, updated_at, ...rest }) => rest);
}

async function main() {
  // Get cases with includes
  const cases = await get<CrmRecord[]>("/api/cases?limit=100&include=emails,tasks,notes");

  if (!cases.length) {
    console.error("No cases found — run a shift first.");
    process.exit(1);
  }

  // Pick cases that have good coverage: at least one task, one email, and ideally a draft
  const rich = cases.filter((c: CrmRecord) => {
    const emails = (c.emails as CrmRecord[]) || [];
    const tasks = (c.tasks as CrmRecord[]) || [];
    const hasDraft = emails.some((e) => e.status === "draft");
    return tasks.length > 0 && emails.length > 0 && hasDraft;
  });

  // Take up to 3 representative cases (prefer ones with drafts)
  const selected = (rich.length >= 2 ? rich : cases.filter((c: CrmRecord) => {
    const tasks = (c.tasks as CrmRecord[]) || [];
    return tasks.length > 0;
  })).slice(0, 3);

  if (!selected.length) {
    console.error("No cases with tasks found.");
    process.exit(1);
  }

  // Get the properties and contacts referenced by these cases
  const propertyIds = [...new Set(selected.map((c: CrmRecord) => c.property_id).filter(Boolean))] as number[];
  const properties: CrmRecord[] = [];
  for (const pid of propertyIds) {
    const p = await get<CrmRecord>(`/api/properties/${pid}`);
    properties.push(p);
  }

  // Collect contact IDs from emails
  const contactEmails = new Set<string>();
  for (const c of selected) {
    for (const e of (c.emails as CrmRecord[]) || []) {
      if (e.from_address) contactEmails.add(e.from_address as string);
    }
  }

  // Get threads for selected cases
  const caseIds = selected.map((c: CrmRecord) => c.id);
  const allThreads = await get<CrmRecord[]>("/api/threads?limit=500");
  const threads = allThreads.filter((t: CrmRecord) => caseIds.includes(t.case_id as number));

  // Build fixture — strip DB-specific IDs so we can create them fresh
  const fixture = {
    _comment: "Auto-generated E2E test fixture. Do not edit manually. Re-generate with: npx tsx scripts/snapshot-fixture.ts",
    properties: stripIds(properties),
    cases: selected.map(({ id, created_at, updated_at, emails, tasks, notes, ...rest }) => rest),
    emails: selected.flatMap((c: CrmRecord) =>
      ((c.emails as CrmRecord[]) || []).map(({ id, created_at, updated_at, ...rest }) => rest),
    ),
    tasks: selected.flatMap((c: CrmRecord) =>
      ((c.tasks as CrmRecord[]) || []).map(({ id, created_at, updated_at, ...rest }) => rest),
    ),
    notes: selected.flatMap((c: CrmRecord) =>
      ((c.notes as CrmRecord[]) || []).map(({ id, created_at, updated_at, shift_id, ...rest }) => rest),
    ),
    threads: threads.map(({ id, created_at, updated_at, ...rest }) => rest),
  };

  writeFileSync(OUT, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Fixture written to ${OUT}`);
  console.log(`  ${fixture.properties.length} properties, ${fixture.cases.length} cases, ${fixture.emails.length} emails, ${fixture.tasks.length} tasks, ${fixture.notes.length} notes, ${fixture.threads.length} threads`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
