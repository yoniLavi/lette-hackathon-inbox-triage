/**
 * Integration tests for the clawling gateway API.
 *
 * Requires the full Docker Compose stack to be running:
 *   docker compose up -d
 */

import { test, expect, beforeAll, afterAll } from "vitest";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8001";

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(300_000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data as Record<string, unknown> };
}

beforeAll(async () => {
  await api("POST", "/session/restart");
});

afterAll(async () => {
  await api("POST", "/session/restart");
});

test("health", async () => {
  const { status, data } = await api("GET", "/health");
  expect(status).toBe(200);
  expect(data.status).toBe("ok");
});

test("session status idle", async () => {
  const { status, data } = await api("GET", "/session/status");
  expect(status).toBe(200);
  expect(data.active).toBe(false);
  expect(data.busy).toBe(false);
});

test("session restart", async () => {
  const { status, data } = await api("POST", "/session/restart");
  expect(status).toBe(200);
  expect(data.status).toBe("restarted");
});

test("chat completions unknown agent", async () => {
  const { status } = await api("POST", "/v1/chat/completions", {
    model: "clawling/nonexistent",
    messages: [{ role: "user", content: "hello" }],
  });
  expect(status).toBe(404);
});

test("chat completions no user message", async () => {
  const { status } = await api("POST", "/v1/chat/completions", {
    model: "clawling/frontend",
    messages: [],
  });
  expect(status).toBe(400);
});

test("chat completions streaming", async () => {
  const res = await fetch(`${AGENT_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "clawling/frontend",
      stream: true,
      messages: [{ role: "user", content: "Say hello in exactly 3 words." }],
    }),
    signal: AbortSignal.timeout(300_000),
  });
  expect(res.status).toBe(200);

  const text = await res.text();
  const lines = text.split("\n");
  const gotData = lines.some((l) => l.startsWith("data: "));
  const gotDone = lines.some((l) => l === "data: [DONE]");
  expect(gotData).toBe(true);
  expect(gotDone).toBe(true);
});

test("chat completions non-streaming", async () => {
  const { status, data } = await api("POST", "/v1/chat/completions", {
    model: "clawling/frontend",
    stream: false,
    messages: [{ role: "user", content: "Say hello in exactly 3 words." }],
  });
  expect(status).toBe(200);
  expect(data.object).toBe("chat.completion");
  expect((data.choices as Record<string, unknown>[]).length).toBe(1);
  const msg = (data.choices as { message: { content: string } }[])[0].message
    .content;
  expect(msg.length).toBeGreaterThan(0);
  expect(data).toHaveProperty("clawling");
  expect(
    (data.clawling as Record<string, unknown>).sessionId,
  ).toBeDefined();
});

test("wake unknown agent", async () => {
  const { status } = await api("POST", "/v1/wake/nonexistent", {
    prompt: "/shift",
  });
  expect(status).toBe(404);
});

test("wake missing prompt", async () => {
  const { status } = await api("POST", "/v1/wake/worker", {});
  expect(status).toBe(400);
});

test("status unknown task", async () => {
  const { status, data } = await api("GET", "/v1/status/nonexistent-id");
  expect(status).toBe(404);
  expect(data.status).toBe("not_found");
});

test("multi-block response separates text blocks", async () => {
  // Bug reproducer: when the LLM generates text, calls a tool, then generates
  // more text, the text blocks were concatenated with no separator — producing
  // "wordA.WordB" where two sentences run together.
  //
  // Use a prompt with rich page context that typically triggers: text → tool → text.
  const { status, data } = await api("POST", "/v1/chat/completions", {
    model: "clawling/frontend",
    stream: false,
    messages: [
      {
        role: "user",
        content:
          '[Page context: {"page":"dashboard","openCaseCount":10,"stats":{"urgentCount":5,"pendingTasks":25},"topCases":[{"id":1,"name":"Fire safety compliance at Citynorth Quarter","priority":"urgent","description":"Dublin Fire Brigade deadline missed by 19 days"},{"id":2,"name":"Overdue Crest Electrical payment","priority":"urgent","description":"61 days past due, threatening work hold"}]}]\n\nQuick overview please - what should I tackle first?',
      },
    ],
  });
  expect(status).toBe(200);

  const content = (
    data.choices as { message: { content: string } }[]
  )[0].message.content;

  // Look for run-on sentence pattern: ".Word" (period immediately followed by capital letter,
  // no whitespace). This is the bug signature from multi-block concatenation.
  const runOnMatch = content.match(/\.([A-Z][a-z])/);
  expect(
    runOnMatch,
    `Run-on sentences detected — text blocks not separated. Content: ${JSON.stringify(content)}`,
  ).toBeNull();
});

test("wake worker returns task id", async () => {
  const { status, data } = await api("POST", "/v1/wake/worker", {
    prompt: "echo hello",
  });
  expect(status).toBe(200);
  expect(data).toHaveProperty("taskId");
  expect((data.taskId as string).length).toBeGreaterThan(0);
});
