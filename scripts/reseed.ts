/**
 * Reset and re-seed CRM in one step.
 * Run: npx tsx scripts/reseed.ts
 */

import { main as resetMain } from "./reset.js";
import { main as seedMain } from "./seed.js";

async function main(): Promise<void> {
  await resetMain();
  console.log();
  await seedMain();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
