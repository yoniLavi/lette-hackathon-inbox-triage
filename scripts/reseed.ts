/**
 * Reset and re-seed CRM in one step.
 * Run: npx tsx scripts/reseed.ts
 * Skip confirmation: npx tsx scripts/reseed.ts --yes
 */

import * as readline from "node:readline/promises";
import { main as resetMain } from "./reset.js";
import { main as seedMain } from "./seed.js";

async function confirm(): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("⚠️  This will DELETE ALL CRM data and re-seed. Continue? (y/N) ");
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function main(): Promise<void> {
  await resetMain();
  console.log();
  await seedMain();
}

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
