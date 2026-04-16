/**
 * Reset CRM by deleting all data via the API.
 * Run: npx tsx scripts/reset.ts
 * Skip confirmation: npx tsx scripts/reset.ts --yes
 */

import * as readline from "node:readline/promises";

const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:8002";

// Order matters: delete children before parents (FK constraints)
const ENTITIES = ["notes", "tasks", "shifts", "threads", "emails", "cases", "contacts", "properties"];

async function confirm(): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("⚠️  This will DELETE ALL CRM data. Continue? (y/N) ");
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function deleteAll(entity: string): Promise<void> {
  const res = await fetch(`${CRM_API_URL}/api/${entity}`, {
    method: "DELETE",
    headers: { "x-confirm-destructive": "true" },
  });
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
  const skipConfirm = process.argv.includes("--yes") || process.argv.includes("-y");
  (async () => {
    if (!skipConfirm && !(await confirm())) {
      console.log("Aborted.");
      process.exit(0);
    }
    await main();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
