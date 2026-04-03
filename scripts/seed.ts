/**
 * Seed CRM API with challenge dataset: properties, contacts, emails.
 * Run: npx tsx scripts/seed.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../challenge-definition/proptech-test-data.json");
const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:8002";

async function apiPost(entity: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${CRM_API_URL}/api/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status !== 201) {
    const text = await res.text();
    console.error(`  ERROR creating ${entity}: ${res.status} ${text}`);
    throw new Error(`Failed to create ${entity}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

interface ChallengeProperty {
  id: string;
  name: string;
  type: string;
  units: number;
  manager: string;
}

interface ChallengeSender {
  name: string;
  email: string;
  type: string;
  role?: string;
  company?: string;
  unit?: string;
  property_id?: string;
}

interface ChallengeEmail {
  id: string;
  subject: string;
  body: string;
  from: ChallengeSender;
  to: string;
  cc?: string;
  timestamp: string;
  read: boolean;
  thread_id: string;
  thread_position: number;
}

function loadData(): { metadata: { properties: ChallengeProperty[] }; emails: ChallengeEmail[] } {
  return JSON.parse(readFileSync(DATA_PATH, "utf-8"));
}

async function seedProperties(properties: ChallengeProperty[]): Promise<Map<string, number>> {
  const propMap = new Map<string, number>();
  for (const prop of properties) {
    const managerEmail = prop.manager
      ? prop.manager.toLowerCase().replace(/ /g, ".") + "@manageco.ie"
      : undefined;
    const payload: Record<string, unknown> = {
      name: prop.name,
      type: prop.type,
      units: prop.units,
      manager: prop.manager,
      challenge_id: prop.id,
    };
    if (managerEmail) payload.manager_email = managerEmail;
    const created = await apiPost("properties", payload);
    propMap.set(prop.id, created.id as number);
    console.log(`  Property: ${prop.name} → ${created.id}`);
  }
  return propMap;
}

function extractSenders(emails: ChallengeEmail[]): ChallengeSender[] {
  const seen = new Map<string, ChallengeSender>();
  for (const email of emails) {
    const addr = email.from.email.toLowerCase();
    if (!seen.has(addr)) seen.set(addr, email.from);
  }
  return Array.from(seen.values());
}

function splitName(fullName: string): [string, string] {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return ["", parts[0]];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

function parseAddresses(field: string | undefined): string[] {
  if (!field) return [];
  return field.split(",").map((a) => a.trim()).filter(Boolean);
}

async function seedContacts(
  senders: ChallengeSender[],
  propMap: Map<string, number>,
): Promise<Map<string, number>> {
  const contactMap = new Map<string, number>();
  for (const sender of senders) {
    const [first, last] = splitName(sender.name);
    const payload: Record<string, unknown> = {
      first_name: first,
      last_name: last,
      email: sender.email,
      type: sender.type,
    };
    if (sender.role) payload.role = sender.role;
    if (sender.company) payload.company = sender.company;
    if (sender.unit) payload.unit = sender.unit;
    if (sender.property_id && propMap.has(sender.property_id)) {
      payload.property_id = propMap.get(sender.property_id);
    }
    const created = await apiPost("contacts", payload);
    contactMap.set(sender.email.toLowerCase(), created.id as number);
    console.log(`  Contact: ${sender.name} <${sender.email}> → ${created.id}`);
  }
  return contactMap;
}

async function seedEmails(challengeEmails: ChallengeEmail[]): Promise<Map<string, number>> {
  const sorted = [...challengeEmails].sort(
    (a, b) => a.thread_id.localeCompare(b.thread_id) || a.thread_position - b.thread_position,
  );
  const emailMap = new Map<string, number>();

  for (const email of sorted) {
    const toAddrs = parseAddresses(email.to);
    const ccAddrs = parseAddresses(email.cc);

    const payload: Record<string, unknown> = {
      subject: email.subject,
      body: email.body,
      body_plain: email.body,
      from_address: email.from.email,
      to_addresses: toAddrs,
      date_sent: email.timestamp,
      status: "archived",
      is_read: email.read,
      thread_id: email.thread_id,
      thread_position: email.thread_position,
      challenge_id: email.id,
      message_id: `<${email.id}@proptech-challenge>`,
    };

    if (ccAddrs.length) payload.cc_addresses = ccAddrs;

    // Link reply to parent via in_reply_to
    if (email.thread_position > 1) {
      const parent = sorted.find(
        (e) => e.thread_id === email.thread_id && e.thread_position === email.thread_position - 1,
      );
      if (parent) payload.in_reply_to = `<${parent.id}@proptech-challenge>`;
    }

    const created = await apiPost("emails", payload);
    emailMap.set(email.id, created.id as number);
    console.log(`  Email: ${email.id} "${email.subject.slice(0, 50)}" → ${created.id}`);
  }

  console.log(`Seeded ${sorted.length} emails`);
  return emailMap;
}

export async function main(): Promise<void> {
  const data = loadData();
  console.log("Seeding CRM...\n");

  console.log("Creating Properties...");
  const propMap = await seedProperties(data.metadata.properties);
  console.log(`\nCreated ${propMap.size} properties\n`);

  console.log("Creating Contacts...");
  const senders = extractSenders(data.emails);
  const contactMap = await seedContacts(senders, propMap);
  console.log(`\nCreated ${contactMap.size} contacts\n`);

  console.log("Creating Emails...");
  await seedEmails(data.emails);

  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
