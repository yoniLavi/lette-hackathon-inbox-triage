/**
 * Reset CRM by deleting all data via the API.
 * Run: npx tsx scripts/reset.ts
 */

const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:8002";

// Order matters: delete children before parents (FK constraints)
const ENTITIES = ["notes", "tasks", "shifts", "threads", "emails", "cases", "contacts", "properties"];

async function deleteAll(entity: string): Promise<void> {
  const res = await fetch(`${CRM_API_URL}/api/${entity}`, { method: "DELETE" });
  if (res.status === 200) {
    const data = await res.json() as Record<string, unknown>;
    console.log(`  Deleted ${data.count ?? "?"} ${entity}`);
  } else if (res.status !== 404) {
    const text = await res.text();
    console.log(`  Error deleting ${entity}: ${res.status} ${text}`);
  }
}

export async function main(): Promise<void> {
  console.log("Resetting CRM...");
  for (const entity of ENTITIES) {
    await deleteAll(entity);
  }
  console.log("Reset complete.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
