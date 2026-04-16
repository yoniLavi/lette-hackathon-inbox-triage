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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Read JSON from --json or stdin. Prefer stdin for multi-line content with
 * newlines — passing `\n` through `--json '...'` on a shell command requires
 * careful escaping that LLMs often get wrong (they over-escape to `\\n`,
 * which JSON.parse then decodes to the literal two characters `\n`).
 *
 * Usage:
 *   crm tasks create --json '{"name":"X"}'                  # OK for simple inline JSON
 *   crm tasks create --stdin <<'EOF'                        # Preferred for any content
 *   {"name":"X","description":"line1\nline2"}               # with \n, tabs, quotes etc
 *   EOF
 */
async function parseJsonInput(opts: { json?: string; stdin?: boolean }): Promise<unknown> {
  let raw: string;
  if (opts.stdin) {
    raw = (await readStdin()).trim();
    if (!raw) {
      console.error("Error: --stdin specified but stdin was empty");
      process.exit(1);
    }
  } else if (opts.json) {
    raw = opts.json;
  } else {
    console.error("Error: provide --json '...' or --stdin (with JSON piped in)");
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error: invalid JSON: ${e}`);
    process.exit(1);
  }
}

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
    .option("--json <data>", "JSON object to create (inline)")
    .option("--stdin", "Read JSON from stdin (preferred for multi-line content)")
    .action(async (opts) => {
      const data = await parseJsonInput(opts);
      output(await request("POST", entity, { body: data }));
    });

  group
    .command("update <id>")
    .option("--json <data>", "JSON fields to update (inline)")
    .option("--stdin", "Read JSON from stdin (preferred for multi-line content)")
    .action(async (id: string, opts) => {
      const data = await parseJsonInput(opts);
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
  .option(
    "--json <data>",
    '{"email_ids": [...], "thread_id": "...", "case_id": N}',
  )
  .option("--stdin", "Read JSON from stdin")
  .action(async (opts) => {
    const data = await parseJsonInput(opts);
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
    .option("--json <data>", '{"ids": [...], "updates": {...}}')
    .option("--stdin", "Read JSON from stdin")
    .action(async (opts) => {
      const data = await parseJsonInput(opts);
      output(await request("PATCH", "emails/bulk", { body: data }));
    });
}

program.parse();
