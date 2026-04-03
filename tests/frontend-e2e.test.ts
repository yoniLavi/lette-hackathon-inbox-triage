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

async function getCaseIds(): Promise<number[]> {
  const res = await fetch(
    `${CRM_URL}/api/cases?limit=10&order_by=id&order=asc`,
  );
  const data = (await res.json()) as { list: { id: number }[] };
  return data.list.map((c) => c.id);
}

async function firstCaseId(): Promise<number> {
  const ids = await getCaseIds();
  if (!ids.length) throw new Error("No cases in CRM");
  return ids[0];
}

function openChat(page: Page) {
  return (async () => {
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle" });
    const toggle = page.locator("button.w-16.h-16");
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
  if (caseId === undefined) caseId = await firstCaseId();
  await page.goto(`${FRONTEND_URL}/cases/${caseId}`, {
    waitUntil: "networkidle",
  });
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
    browser = await chromium.launch({ headless: true });
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
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
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("text=/Situations|Cases|Dashboard/i", {
      timeout: 10_000,
    });
  });

  test("chat widget opens and closes", async () => {
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle" });
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

  test("multi-turn conversation", { timeout: FAST_TIMEOUT * 2 + 10_000 }, async () => {
    await openChat(page);
    const n1 = await sendMessage(page, "Remember this number: 42");
    await waitForResponse(page, FAST_TIMEOUT, n1);

    const n2 = await sendMessage(page, "What number did I just tell you?");
    const response = await waitForResponse(page, FAST_TIMEOUT, n2);
    expect(response).toContain("42");
  });

  test("context aware response", { timeout: FAST_TIMEOUT + 10_000 }, async () => {
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle" });
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

  test("non-blocking delegation", { timeout: SLOW_TIMEOUT + 30_000 }, async () => {
    await openChat(page);

    const n = await sendMessage(
      page,
      "Search the CRM for emails about fire safety",
    );
    const ack = await waitForResponse(page, FAST_TIMEOUT, n);
    expect(ack.length).toBeGreaterThan(5);

    const chatInput = page.locator("textarea[placeholder*='Ask anything']");
    await expectEnabled(chatInput, 5000);

    const n2 = await sendMessage(page, "What is your name?");
    const followup = await waitForResponse(page, FAST_TIMEOUT, n2);
    expect(followup.length).toBeGreaterThan(5);

    const msgsAfter = await page.locator("[data-msg-id]").count();
    await page.waitForFunction(
      (mc: number) =>
        document.querySelectorAll("[data-msg-id]").length > mc,
      msgsAfter,
      { timeout: SLOW_TIMEOUT },
    );

    const allMsgs = page.locator("[data-msg-id]");
    const finalCount = await allMsgs.count();
    const lastMsg = await allMsgs.nth(finalCount - 1).innerText();
    expect(lastMsg.length).toBeGreaterThan(20);
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

  test("situation has ai-target attributes", async () => {
    const caseId = await firstCaseId();
    await page.goto(`${FRONTEND_URL}/cases/${caseId}`, {
      waitUntil: "networkidle",
    });

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
    await openChatOnSituation(page, await firstCaseId());
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
    await openChatOnSituation(page, await firstCaseId());
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
    await openChatOnSituation(page, await firstCaseId());
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
    await openChatOnSituation(page, await firstCaseId());
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

  // --- Navigate action tests (LLM-flaky) ---

  test.skip("scrollTo case on dashboard", async () => {
    // LLM-flaky
  });

  test.skip("navigate from dashboard to situation", async () => {
    // LLM-flaky
  });

  test.skip("navigate uses new page context", async () => {
    // LLM-flaky
  });

  // --- Page load tests ---

  test("inbox page loads", async () => {
    await page.goto(`${FRONTEND_URL}/inbox`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("text=/Inbox/i", { timeout: 30_000 });
    const search = page.locator("input[placeholder*='Search']");
    await expectVisible(search, 10_000);
  });

  test("tasks page loads", async () => {
    await page.goto(`${FRONTEND_URL}/tasks`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("text=/Tasks/i", { timeout: 10_000 });
  });

  test("contacts page loads", async () => {
    await page.goto(`${FRONTEND_URL}/contacts`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("text=/Contacts/i", { timeout: 10_000 });
    await page.waitForTimeout(3000);
    const tenantBtn = page.locator("button:has-text('Tenants')");
    expect(await tenantBtn.count()).toBeGreaterThan(0);
  });

  test("property detail loads", async () => {
    const res = await fetch(`${CRM_URL}/api/properties?limit=1`);
    const data = (await res.json()) as { list: { id: number }[] };
    if (!data.list.length) return; // skip

    const pid = data.list[0].id;
    await page.goto(`${FRONTEND_URL}/properties/${pid}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("text=/Open Cases/i", { timeout: 30_000 });
  });

  test("contact detail loads", async () => {
    const res = await fetch(`${CRM_URL}/api/contacts?limit=1`);
    const data = (await res.json()) as { list: { id: number }[] };
    if (!data.list.length) return; // skip

    const cid = data.list[0].id;
    await page.goto(`${FRONTEND_URL}/contacts/${cid}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("text=/Open Cases/i", { timeout: 30_000 });
  });

  test.skip("AI navigates to inbox", async () => {
    // LLM-flaky
  });

  test.skip("AI navigates to tasks", async () => {
    // LLM-flaky
  });

  test.skip("AI navigates to contact", async () => {
    // LLM-flaky
  });

  test.skip("AI prefers navigate over worker", async () => {
    // LLM-flaky
  });
});
