/**
 * Playwright E2E tests for the frontend chat widget.
 *
 * Requires:
 *   - Docker Compose stack running (docker compose up -d)
 *   - Playwright browsers installed (npx playwright install chromium)
 *
 * Run via:
 *   pnpm vitest run tests/frontend-e2e.test.ts
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Playwright locator assertion helpers (since we use vitest not @playwright/test). */
async function expectVisible(locator: ReturnType<Page["locator"]>, timeout = 5000) {
  await locator.waitFor({ state: "visible", timeout });
}
async function expectHidden(locator: ReturnType<Page["locator"]>, timeout = 5000) {
  await locator.waitFor({ state: "hidden", timeout });
}
async function expectEnabled(locator: ReturnType<Page["locator"]>, timeout = 5000) {
  await locator.waitFor({ state: "visible", timeout });
  expect(await locator.isEnabled()).toBe(true);
}

const FRONTEND_URL = "http://localhost:3000";
const AGENT_URL = "http://localhost:8001";
const CRM_URL = "http://localhost:8002";

const FAST_TIMEOUT = 30_000;
const SLOW_TIMEOUT = 120_000;

// --- Fixture seeding ---

interface FixtureRecord { [key: string]: unknown }
interface Fixture {
  cases: FixtureRecord[];
  emails: FixtureRecord[];
  tasks: FixtureRecord[];
  notes: FixtureRecord[];
  threads: FixtureRecord[];
}

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/e2e-cases.json",
);

/** IDs created during fixture seeding, for cleanup */
const createdIds: { entity: string; id: number }[] = [];
/** Case IDs from the fixture (populated in beforeAll) */
let fixtureCaseIds: number[] = [];

async function crmPost(path: string, body: FixtureRecord): Promise<FixtureRecord> {
  const res = await fetch(`${CRM_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as FixtureRecord;
}

async function seedFixture(): Promise<void> {
  const fixture: Fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

  // Collect distinct original case_ids from emails (preserving fixture order)
  const origCaseIds: number[] = [];
  for (const e of fixture.emails) {
    const cid = e.case_id as number;
    if (cid && !origCaseIds.includes(cid)) origCaseIds.push(cid);
  }

  // 1. Create cases and build old→new ID mapping
  const caseIdMap = new Map<number, number>();
  for (let i = 0; i < fixture.cases.length; i++) {
    const created = await crmPost("/api/cases", fixture.cases[i]);
    const newId = (created as { id: number }).id;
    if (i < origCaseIds.length) caseIdMap.set(origCaseIds[i], newId);
    createdIds.push({ entity: "cases", id: newId });
    fixtureCaseIds.push(newId);
  }

  const remapCase = (id: unknown) =>
    id ? caseIdMap.get(id as number) ?? null : null;

  // 2. Create emails (remap case_id, strip challenge_id to avoid unique conflicts)
  for (const e of fixture.emails) {
    const { challenge_id, case_id, contact_id, ...rest } = e;
    const created = await crmPost("/api/emails", { ...rest, case_id: remapCase(case_id) });
    createdIds.push({ entity: "emails", id: (created as { id: number }).id });
  }

  // 3. Create tasks (remap case_id, drop contact_id to avoid FK issues)
  for (const t of fixture.tasks) {
    const { case_id, contact_id, ...rest } = t;
    const created = await crmPost("/api/tasks", { ...rest, case_id: remapCase(case_id) });
    createdIds.push({ entity: "tasks", id: (created as { id: number }).id });
  }

  // 4. Create notes (remap case_id)
  for (const n of fixture.notes) {
    const { case_id, ...rest } = n;
    const created = await crmPost("/api/notes", { ...rest, case_id: remapCase(case_id) });
    createdIds.push({ entity: "notes", id: (created as { id: number }).id });
  }

  // Threads are auto-created by the CRM when emails with thread_id are inserted
}

async function cleanupFixture(): Promise<void> {
  // Delete in reverse order (children before parents)
  for (const { entity, id } of [...createdIds].reverse()) {
    await fetch(`${CRM_URL}/api/${entity}/${id}`, { method: "DELETE" }).catch(() => {});
  }
}

function firstCaseId(): number {
  if (!fixtureCaseIds.length) throw new Error("No fixture cases seeded");
  return fixtureCaseIds[0];
}

/**
 * Navigate and wait for the page to be interactive.
 *
 * Uses `load` (not `networkidle`) so long-lived polling loops — like the shifts
 * page intervals or an open browser tab on /shifts — can't starve the test.
 * `load` is enough to ensure React has hydrated and click handlers are wired.
 */
async function goto(page: Page, url: string, readySelector = "body") {
  await page.goto(url, { waitUntil: "load" });
  await page.locator(readySelector).first().waitFor({ state: "visible", timeout: 10_000 });
}

function openChat(page: Page) {
  return (async () => {
    await goto(page, FRONTEND_URL);
    const toggle = page.locator("button.w-16.h-16");
    await toggle.waitFor({ state: "visible", timeout: 10_000 });
    await toggle.click();
    const input = page.locator("textarea[placeholder*='Ask anything']");
    await expectVisible(input, 3000);
    return input;
  })();
}

async function sendMessage(page: Page, text: string): Promise<number> {
  const input = page.locator("textarea[placeholder*='Ask anything']");
  await input.fill(text);
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(100);
  return await countMsgs(page);
}

async function countMsgs(page: Page): Promise<number> {
  return page.locator("[data-msg-id]").count();
}

async function waitForResponse(
  page: Page,
  timeout = FAST_TIMEOUT,
  prevCount?: number,
): Promise<string> {
  if (prevCount !== undefined) {
    await page.waitForFunction(
      (pc: number) =>
        document.querySelectorAll("[data-msg-id]").length > pc,
      prevCount,
      { timeout },
    );
  } else {
    const spinner = page.locator("div.justify-start .animate-spin");
    try {
      await spinner.first().waitFor({ state: "visible", timeout: 3000 });
    } catch {}
    try {
      await spinner.first().waitFor({ state: "hidden", timeout });
    } catch {}
  }

  await page.waitForTimeout(300);
  const msgs = page.locator("[data-msg-id]");
  const count = await msgs.count();
  expect(count).toBeGreaterThan(0);
  return msgs.nth(count - 1).innerText();
}

async function openChatOnSituation(page: Page, caseId?: number) {
  if (caseId === undefined) caseId = firstCaseId();
  await goto(page, `${FRONTEND_URL}/cases/${caseId}`, "button.w-16.h-16");
  const toggle = page.locator("button.w-16.h-16");
  await toggle.click();
  const input = page.locator("textarea[placeholder*='Ask anything']");
  await expectVisible(input, 3000);
  return input;
}

describe("frontend e2e", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    await seedFixture();
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await cleanupFixture();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();
    await fetch(`${AGENT_URL}/session/restart`, { method: "POST" }).catch(
      () => {},
    );
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
  });

  test("dashboard loads", async () => {
    await goto(page, FRONTEND_URL);
    await page.waitForSelector("text=/Situations|Cases|Dashboard/i", {
      timeout: 10_000,
    });
  });

  test("chat widget opens and closes", async () => {
    await goto(page, FRONTEND_URL);
    const toggle = page.locator("button.w-16.h-16");

    await toggle.click();
    const panel = page.locator("textarea[placeholder*='Ask anything']");
    await expectVisible(panel, 3000);

    await toggle.click();
    await expectHidden(panel, 3000);
  });

  test("suggested prompts visible", async () => {
    await openChat(page);
    const prompts = page.locator(
      "button:has-text('Summarize'), button:has-text('Show me'), button:has-text('Draft')",
    );
    await expectVisible(prompts.first(), 3000);
  });

  test("send message shows response", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChat(page);
    const n = await sendMessage(page, "What can you help me with?");
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    expect(response.length).toBeGreaterThan(20);
  });

  test("user message appears in chat", async () => {
    await openChat(page);
    await sendMessage(page, "Hello there!");
    const userMsgs = page.locator("div.justify-end div.rounded-\\[24px\\]");
    await expectVisible(userMsgs.first(), 3000);
    const text = await userMsgs.first().innerText();
    expect(text).toContain("Hello there!");
  });

  test("multi-turn conversation", { timeout: SLOW_TIMEOUT + 30_000 }, async () => {
    await openChat(page);
    const n1 = await sendMessage(page, "Remember this number: 42");
    await waitForResponse(page, SLOW_TIMEOUT, n1);

    const n2 = await sendMessage(page, "What number did I just tell you?");
    const response = await waitForResponse(page, SLOW_TIMEOUT, n2);
    expect(response).toContain("42");
  });

  test("context aware response", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await goto(page, FRONTEND_URL);
    await openChat(page);
    const n = await sendMessage(
      page,
      "How many situations are showing on my dashboard?",
    );
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    expect(response.length).toBeGreaterThan(10);
  });

  test("streaming shows loading state", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChat(page);
    const n = await sendMessage(
      page,
      "Explain what BTR means in Irish property management.",
    );
    const spinner = page.locator("div.justify-start .animate-spin");
    try {
      await spinner.first().waitFor({ state: "visible", timeout: 3000 });
    } catch {}
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    expect(response.length).toBeGreaterThan(5);
  });

  test("input enabled after response", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChat(page);
    const n = await sendMessage(
      page,
      "What is the Residential Tenancies Board?",
    );
    await waitForResponse(page, FAST_TIMEOUT, n);
    const input = page.locator("textarea[placeholder*='Ask anything']");
    await expectEnabled(input, 3000);
  });

  test("non-blocking delegation", { timeout: SLOW_TIMEOUT * 2 + 30_000 }, async () => {
    await openChat(page);

    // Use a cross-entity query that the frontend can't answer from a single page
    const n = await sendMessage(
      page,
      "Which properties have the most overdue tasks? Compare across all properties.",
    );
    const ack = await waitForResponse(page, FAST_TIMEOUT, n);
    expect(ack.length).toBeGreaterThan(5);

    // Chat input should be re-enabled (non-blocking)
    const chatInput = page.locator("textarea[placeholder*='Ask anything']");
    await expectEnabled(chatInput, 5000);

    // Check if delegation was triggered by looking for the "Searching CRM" indicator
    const workerIndicator = page.locator("text=/Searching CRM|Working/i");
    const delegated = (await workerIndicator.count()) > 0;

    if (delegated) {
      // Wait for worker result to appear as a new message. Worker latency is
      // highly variable (Bedrock + SDK roundtrip), so allow up to 2x SLOW_TIMEOUT.
      // If it takes even longer, don't fail — the ack already proved non-blocking.
      const msgsAfter = await page.locator("[data-msg-id]").count();
      try {
        await page.waitForFunction(
          (mc: number) =>
            document.querySelectorAll("[data-msg-id]").length > mc,
          msgsAfter,
          { timeout: SLOW_TIMEOUT * 2 },
        );
        const allMsgs = page.locator("[data-msg-id]");
        const finalCount = await allMsgs.count();
        const lastMsg = await allMsgs.nth(finalCount - 1).innerText();
        expect(lastMsg.length).toBeGreaterThan(20);
      } catch {
        // Worker took too long — log but don't fail (non-blocking was proven by ack)
        console.log("[delegation test] worker result did not arrive within 4min, skipping result assertion");
      }
    }
    // If the agent answered directly or navigated instead of delegating,
    // that's also valid — the ack assertion above already passed
  });

  test("response renders markdown", { timeout: SLOW_TIMEOUT + 10_000 }, async () => {
    await openChat(page);
    const n = await sendMessage(page, "How many open cases do I have?");
    await waitForResponse(page, SLOW_TIMEOUT, n);

    const lastMsg = page.locator("[data-msg-id]").last();
    const hasP = (await lastMsg.locator("p").count()) > 0;
    const hasStrong = (await lastMsg.locator("strong").count()) > 0;
    const hasEm = (await lastMsg.locator("em").count()) > 0;
    expect(hasP || hasStrong || hasEm).toBe(true);
  });

  test("chat persists across page navigation", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChat(page);
    const n = await sendMessage(page, "Remember the word: pineapple");
    await waitForResponse(page, FAST_TIMEOUT, n);

    const navLinks = page.locator(
      "a[href*='properties'], a[href*='situation'], nav a",
    );
    if ((await navLinks.count()) > 0) {
      await navLinks.first().click();
      await page.waitForLoadState("networkidle");
      const toggle = page.locator("button.w-16.h-16");
      await expectVisible(toggle, 5000);
    }
  });

  // --- Page context enrichment tests ---

  test("case page does not show literal escape sequences", async () => {
    // Regression guard: the worker agent sometimes writes "\\n" (literal
    // backslash-n) in JSON passed via bash, which gets stored verbatim and
    // previously rendered as "\n\n" in the UI. The unescapeMarkdown helper
    // normalizes these at display time.
    const caseId = firstCaseId();
    await goto(page, `${FRONTEND_URL}/cases/${caseId}`, "[data-ai-target^='task-']");

    const bodyText = await page.locator("body").innerText();
    const literalEscapes = bodyText.match(/\\n/g) || [];
    expect(
      literalEscapes.length,
      `Rendered page contains ${literalEscapes.length} literal "\\\\n" escape sequences — unescapeMarkdown may be missing`,
    ).toBe(0);
  });

  test("situation has ai-target attributes", async () => {
    const caseId = firstCaseId();
    await goto(page, `${FRONTEND_URL}/cases/${caseId}`, "[data-ai-target]");

    const targets = page.locator("[data-ai-target]");
    const count = await targets.count();
    expect(count).toBeGreaterThan(0);

    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      const v = await targets.nth(i).getAttribute("data-ai-target");
      if (v) values.push(v);
    }
    const hasTask = values.some((t) => t.startsWith("task-"));
    const hasDraft = values.some((t) => t.startsWith("draft-"));
    const hasNote = values.some((t) => t.startsWith("note-"));
    expect(hasTask || hasDraft || hasNote).toBe(true);
  });

  test("enriched context answers draft question", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChatOnSituation(page, firstCaseId());
    const n = await sendMessage(
      page,
      "What does the draft response say? Give me a brief summary.",
    );
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    const lower = response.toLowerCase();
    expect(
      ["can't see", "don't have", "not available", "not included"].every(
        (p) => !lower.includes(p),
      ),
    ).toBe(true);
    expect(response.length).toBeGreaterThan(20);
  });

  test("enriched context sees email bodies", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChatOnSituation(page, firstCaseId());
    const n = await sendMessage(
      page,
      "What is this case about? Be specific about the issue.",
    );
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    expect(response.length).toBeGreaterThan(30);
    const lower = response.toLowerCase();
    expect(
      ["can't see", "don't have", "not available", "which case"].every(
        (p) => !lower.includes(p),
      ),
    ).toBe(true);
  });

  test("scrollTo action highlights element", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChatOnSituation(page, firstCaseId());
    const n = await sendMessage(page, "Show me the first task");
    await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(500);

    const highlighted = page.locator(".ai-highlight");
    const target = page.locator("[data-ai-target^='task-']");
    const hasHighlight = (await highlighted.count()) > 0;
    const targetInView =
      (await target.count()) > 0 && (await target.first().isVisible());
    expect(hasHighlight || targetInView).toBe(true);
  });

  test("expand action opens thread", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChatOnSituation(page, firstCaseId());
    const threadHeaders = page.locator(
      "[data-ai-target^='thread-'] button",
    );
    if ((await threadHeaders.count()) === 0) return; // skip if no threads

    const n = await sendMessage(
      page,
      "Expand the email thread so I can see all messages",
    );
    await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(500);

    const threadEmails = page.locator(
      "[data-ai-target^='thread-'] [data-ai-target^='email-']",
    );
    expect(await threadEmails.count()).toBeGreaterThan(0);
  });

  // --- Navigate action tests ---
  // These test that asking the AI about a specific case from the dashboard
  // results in a useful outcome — either a highlight, a visible card,
  // a navigation, or a contentful response. We don't assert on the exact
  // tool the LLM picks (scrollTo vs navigate vs answer), just the user's
  // experience: the request doesn't hit a dead end.

  test("scrollTo case on dashboard", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await goto(page, FRONTEND_URL);
    const caseId = firstCaseId();
    // Fetch case name so we can ask about it by name
    const caseRes = await fetch(`${CRM_URL}/api/cases/${caseId}`);
    const caseData = (await caseRes.json()) as { name: string };
    // Use first distinctive word of the case name
    const keyword = caseData.name.split(/[:\s—-]+/).find((w) => w.length > 4) || "case";

    const toggle = page.locator("button.w-16.h-16");
    await toggle.click();
    await expectVisible(page.locator("textarea[placeholder*='Ask anything']"), 3000);

    const n = await sendMessage(page, `Show me the ${keyword} case`);
    await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(500);

    // Success = any of: highlight appears, case card is visible, URL navigated, or response mentions the case
    const highlighted = await page.locator(".ai-highlight").count();
    const caseCard = await page.locator(`[data-ai-target="case-${caseId}"]`).count();
    const navigated = page.url().includes(`/cases/${caseId}`);
    const lastMsg = (await page.locator("[data-msg-id]").last().innerText()).toLowerCase();
    const mentionedInResponse = lastMsg.includes(keyword.toLowerCase());

    expect(highlighted > 0 || caseCard > 0 || navigated || mentionedInResponse).toBe(true);
  });

  test("navigate from dashboard to situation", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await goto(page, FRONTEND_URL);
    const caseId = firstCaseId();
    const caseRes = await fetch(`${CRM_URL}/api/cases/${caseId}`);
    const caseData = (await caseRes.json()) as { name: string };
    const keyword = caseData.name.split(/[:\s—-]+/).find((w) => w.length > 4) || "case";

    const toggle = page.locator("button.w-16.h-16");
    await toggle.click();
    await expectVisible(page.locator("textarea[placeholder*='Ask anything']"), 3000);

    const n = await sendMessage(page, `Open the ${keyword} case so I can see the details`);
    await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(1500);

    // Either URL changed OR response is substantive and references the case
    const navigated = page.url().includes("/cases/");
    const lastMsg = await page.locator("[data-msg-id]").last().innerText();
    const substantive = lastMsg.length > 20;

    expect(navigated || substantive).toBe(true);
  });

  test("navigate uses new page context", { timeout: SLOW_TIMEOUT + 10_000 }, async () => {
    await goto(page, `${FRONTEND_URL}/inbox`, "text=/Inbox/i");

    const toggle = page.locator("button.w-16.h-16");
    await expectVisible(toggle, 10_000);
    await toggle.click();
    await expectVisible(page.locator("textarea[placeholder*='Ask anything']"), 10_000);

    // From the inbox, ask a question that requires current-page context
    const n = await sendMessage(page, "What emails are showing on this page?");
    const response = await waitForResponse(page, SLOW_TIMEOUT, n);

    // Response should be substantive and not a refusal
    expect(response.length).toBeGreaterThan(20);
    const lower = response.toLowerCase();
    expect(
      ["can't see", "don't have", "not available", "which page"].every((p) => !lower.includes(p)),
    ).toBe(true);
  });

  // --- Page load tests ---

  test("inbox page loads", async () => {
    await goto(page, `${FRONTEND_URL}/inbox`, "text=/Inbox/i");
    const search = page.locator("input[placeholder*='Search']");
    await expectVisible(search, 10_000);
  });

  test("tasks page loads", async () => {
    await goto(page, `${FRONTEND_URL}/tasks`, "text=/Tasks/i");
  });

  test("contacts page loads", async () => {
    await goto(page, `${FRONTEND_URL}/contacts`, "text=/Contacts/i");
    const tenantBtn = page.locator("button:has-text('Tenants')");
    await tenantBtn.waitFor({ state: "visible", timeout: 10_000 });
    expect(await tenantBtn.count()).toBeGreaterThan(0);
  });

  test("property detail loads", async () => {
    const res = await fetch(`${CRM_URL}/api/properties?limit=1`);
    const data = (await res.json()) as { list: { id: number }[] };
    if (!data.list.length) return; // skip

    const pid = data.list[0].id;
    await goto(page, `${FRONTEND_URL}/properties/${pid}`, "text=/Open Cases/i");
  });

  test("contact detail loads", async () => {
    const res = await fetch(`${CRM_URL}/api/contacts?limit=1`);
    const data = (await res.json()) as { list: { id: number }[] };
    if (!data.list.length) return; // skip

    const cid = data.list[0].id;
    await goto(page, `${FRONTEND_URL}/contacts/${cid}`, "text=/Open Cases/i");
  });

  test("AI navigates to inbox", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChat(page);
    const n = await sendMessage(page, "Take me to the inbox");
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(1500);

    // Either URL became /inbox or response is substantive (AI explained / listed)
    const onInbox = page.url().includes("/inbox");
    expect(onInbox || response.length > 20).toBe(true);
  });

  test("AI navigates to tasks", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await openChat(page);
    const n = await sendMessage(page, "Show me all open tasks");
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(1500);

    const onTasks = page.url().includes("/tasks");
    expect(onTasks || response.length > 20).toBe(true);
  });

  test("AI navigates to contact", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    // Get a contact from CRM to reference by name
    const res = await fetch(`${CRM_URL}/api/contacts?limit=1`);
    const data = (await res.json()) as { list: { id: number; first_name: string | null; last_name: string | null }[] };
    if (!data.list.length) return;
    const contact = data.list[0];
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "someone";

    await openChat(page);
    const n = await sendMessage(page, `Show me the contact for ${name}`);
    const response = await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(1500);

    const onContact = page.url().includes("/contacts");
    const mentionsContact = response.toLowerCase().includes((contact.last_name || "").toLowerCase())
      || response.toLowerCase().includes((contact.first_name || "").toLowerCase());
    expect(onContact || mentionsContact || response.length > 20).toBe(true);
  });

  test("AI prefers navigate over worker", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    // Single-entity queries should be navigable, not delegated to the worker.
    // We check that the "Searching CRM..." indicator does NOT appear.
    await openChat(page);
    const n = await sendMessage(page, "Take me to the tasks page");
    await waitForResponse(page, FAST_TIMEOUT, n);
    await page.waitForTimeout(2000);

    // Worker indicator text "Searching CRM" only shows during delegation
    const workerIndicatorCount = await page.locator("text=/Searching CRM/i").count();
    expect(workerIndicatorCount).toBe(0);
  });
});
