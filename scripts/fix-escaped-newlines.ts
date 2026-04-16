/**
 * One-off migration: unescape literal backslash-escapes in CRM text fields.
 *
 * The worker agent previously over-escaped JSON when invoking the CRM CLI
 * via bash, causing strings like "line1\\n\\nline2" to be stored with
 * literal backslash-n instead of real newlines. See:
 *   - frontend/src/lib/unescape-markdown.ts (display-layer safety net)
 *   - packages/crm-cli/src/index.ts (--stdin option to prevent recurrence)
 *
 * This script walks all text fields on existing records and rewrites them
 * to use real newlines. Idempotent — records without literal escapes are
 * skipped.
 *
 * Run: npx tsx scripts/fix-escaped-newlines.ts [--dry-run]
 */

const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:8002";
const DRY_RUN = process.argv.includes("--dry-run");

function unescape(text: string | null | undefined): string | null {
  if (text == null) return text ?? null;
  return text
    .replace(/(?<!\\)\\n/g, "\n")
    .replace(/(?<!\\)\\t/g, "\t")
    .replace(/(?<!\\)\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

function needsFix(text: string | null | undefined): boolean {
  if (!text) return false;
  return /(?<!\\)\\[nrt]/.test(text);
}

interface Record {
  id: number;
  [key: string]: unknown;
}

async function fetchAll(entity: string): Promise<Record[]> {
  const all: Record[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(`${CRM_API_URL}/api/${entity}?limit=${limit}&offset=${offset}`);
    const data = (await res.json()) as { list: Record[]; total: number };
    all.push(...data.list);
    if (all.length >= data.total) break;
    offset += limit;
  }
  return all;
}

async function patch(entity: string, id: number, body: Record): Promise<void> {
  if (DRY_RUN) return;
  const res = await fetch(`${CRM_API_URL}/api/${entity}/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH /api/${entity}/${id}: ${res.status} ${await res.text()}`);
  }
}

async function fixEntity(entity: string, fields: string[]): Promise<void> {
  const records = await fetchAll(entity);
  let fixed = 0;
  for (const r of records) {
    const update: Record = { id: r.id };
    let dirty = false;
    for (const f of fields) {
      const v = r[f];
      if (typeof v === "string" && needsFix(v)) {
        update[f] = unescape(v);
        dirty = true;
      }
    }
    if (dirty) {
      await patch(entity, r.id, update);
      fixed++;
    }
  }
  console.log(`  ${entity}: ${fixed}/${records.length} records fixed${DRY_RUN ? " (dry-run)" : ""}`);
}

async function main(): Promise<void> {
  console.log(`Unescape migration${DRY_RUN ? " (dry-run)" : ""}...`);
  await fixEntity("tasks", ["description", "name"]);
  await fixEntity("cases", ["description", "name"]);
  await fixEntity("notes", ["content"]);
  await fixEntity("emails", ["body", "body_plain", "subject"]);
  await fixEntity("properties", ["description"]);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
