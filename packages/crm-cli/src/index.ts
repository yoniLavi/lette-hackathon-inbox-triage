#!/usr/bin/env npx tsx
/**
 * CRM CLI — command-line interface for the CRM API.
 *
 * Usage:
 *   crm <entity> list [--limit N] [--order-by FIELD] [--status S] [--search Q] ...
 *   crm <entity> get <id> [--include emails,contact]
 *   crm <entity> create --json '{...}'
 *   crm <entity> update <id> --json '{...}'
 *   crm <entity> delete <id>
 *   crm shift next
 *   crm shift complete --json '{...}'
 *   crm shift incomplete
 *   crm emails bulk-update --json '{...}'
 */

import { Command } from "commander";
import { request, output } from "./client.js";

const program = new Command();
program.name("crm").description("CRM command-line interface");

const ENTITIES = [
  "properties",
  "contacts",
  "emails",
  "cases",
  "tasks",
  "notes",
  "threads",
  "shifts",
];

for (const entity of ENTITIES) {
  const group = program.command(entity);

  group
    .command("list")
    .option("-l, --limit <n>", "Max results", "20")
    .option("--offset <n>", "Offset", "0")
    .option("-o, --order-by <field>", "Order by field", "created_at")
    .option("--order <dir>", "Sort direction (asc/desc)", "desc")
    .option("--status <s>")
    .option("--priority <p>")
    .option("--property-id <n>")
    .option("--case-id <n>")
    .option("--contact-id <n>")
    .option("--thread-id <id>")
    .option("--email <addr>")
    .option("--type <t>")
    .option("-s, --search <q>", "Full-text search (emails)")
    .option("--is-read <v>")
    .option("--is-replied <v>")
    .option("--challenge-id <id>")
    .option("--include <fields>", "Comma-separated related entities")
    .option("--date-end-before <date>")
    .option("--date-end-after <date>")
    .option("--date-sent-before <date>")
    .option("--date-sent-after <date>")
    .action(async (opts) => {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts)) {
        if (v !== undefined) {
          // Convert camelCase to snake_case for API params
          const key = k.replace(/([A-Z])/g, "_$1").toLowerCase();
          params[key] = String(v);
        }
      }
      output(await request("GET", entity, { params }));
    });

  group
    .command("get <id>")
    .option("--include <fields>", "Comma-separated related entities")
    .action(async (id: string, opts) => {
      const params: Record<string, string> = {};
      if (opts.include) params.include = opts.include;
      output(await request("GET", `${entity}/${id}`, { params }));
    });

  group
    .command("create")
    .requiredOption("--json <data>", "JSON object to create")
    .action(async (opts) => {
      let data: unknown;
      try {
        data = JSON.parse(opts.json);
      } catch (e) {
        console.error(`Error: invalid JSON: ${e}`);
        process.exit(1);
      }
      output(await request("POST", entity, { body: data }));
    });

  group
    .command("update <id>")
    .requiredOption("--json <data>", "JSON fields to update")
    .action(async (id: string, opts) => {
      let data: unknown;
      try {
        data = JSON.parse(opts.json);
      } catch (e) {
        console.error(`Error: invalid JSON: ${e}`);
        process.exit(1);
      }
      output(await request("PATCH", `${entity}/${id}`, { body: data }));
    });

  group
    .command("delete <id>")
    .action(async (id: string) => {
      output(await request("DELETE", `${entity}/${id}`));
    });
}

// Shift commands (separate from the generic shift entity commands)
const shift = program.command("shift").description("Shift work-item commands");

shift.command("next").description("Get next unread thread").action(async () => {
  output(await request("GET", "shift/next"));
});

shift
  .command("complete")
  .description("Mark a thread as processed")
  .requiredOption(
    "--json <data>",
    '{"email_ids": [...], "thread_id": "...", "case_id": N}',
  )
  .action(async (opts) => {
    let data: unknown;
    try {
      data = JSON.parse(opts.json);
    } catch (e) {
      console.error(`Error: invalid JSON: ${e}`);
      process.exit(1);
    }
    output(await request("POST", "shift/complete", { body: data }));
  });

shift
  .command("incomplete")
  .description("Get cases needing triage")
  .action(async () => {
    output(await request("GET", "shift/incomplete"));
  });

// Bulk email update (added to the emails command)
const emailsCmd = program.commands.find((c) => c.name() === "emails");
if (emailsCmd) {
  emailsCmd
    .command("bulk-update")
    .description("Batch update emails by ID list")
    .requiredOption("--json <data>", '{"ids": [...], "updates": {...}}')
    .action(async (opts) => {
      let data: unknown;
      try {
        data = JSON.parse(opts.json);
      } catch (e) {
        console.error(`Error: invalid JSON: ${e}`);
        process.exit(1);
      }
      output(await request("PATCH", "emails/bulk", { body: data }));
    });
}

program.parse();
