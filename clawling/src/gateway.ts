/**
 * HTTP gateway — OpenAI-compatible /v1/chat/completions with SSE streaming.
 *
 * Routes to agents via the model field (e.g., "clawling/frontend").
 * Supports delegation, wake (autonomous work), status polling, and CORS.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { Config } from "./config.js";
import type { AgentRegistry } from "./agents/registry.js";
import type { Spawner } from "./delegation/spawner.js";
import type { DelegationTracker } from "./delegation/tracker.js";
import type { Announcer } from "./delegation/announcer.js";
import type { AgentEvent } from "./agents/types.js";
import { getMessagesSession } from "./agents/messages-backend.js";
import { log } from "./log.js";

interface GatewayDeps {
  config: Config;
  registry: AgentRegistry;
  spawner: Spawner;
  tracker: DelegationTracker;
  announcer: Announcer;
}

// Track busy state per agent
const busyAgents = new Set<string>();

export function createGateway(deps: GatewayDeps): Hono {
  const { config, registry, spawner, tracker, announcer } = deps;
  const app = new Hono();

  // CORS — if config has ["*"], use wildcard string; otherwise pass array
  const corsOrigin = config.gateway.cors.length === 1 && config.gateway.cors[0] === "*"
    ? "*"
    : config.gateway.cors;
  app.use("*", cors({
    origin: corsOrigin,
    allowHeaders: ["Content-Type", "x-clawling-session-id"],
    exposeHeaders: ["x-clawling-session-id"],
  }));

  // Optional bearer token auth
  const token = process.env.CLAWLING_GATEWAY_TOKEN;
  if (token) {
    app.use("/v1/*", async (c, next) => {
      const auth = c.req.header("Authorization");
      if (auth !== `Bearer ${token}`) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      return next();
    });
  }

  // -----------------------------------------------------------------------
  // POST /v1/chat/completions — OpenAI-compatible with SSE streaming
  // -----------------------------------------------------------------------
  app.post("/v1/chat/completions", async (c) => {
    const body = await c.req.json();
    const modelField: string = body.model ?? "";
    const stream: boolean = body.stream ?? false;
    const messages: Array<{ role: string; content: string }> =
      body.messages ?? [];

    // Extract agent name from model field: "clawling/frontend" -> "frontend"
    const agentName = modelField.startsWith("clawling/")
      ? modelField.slice("clawling/".length)
      : modelField;

    const backend = registry.get(agentName);
    if (!backend) {
      return c.json({ error: `Unknown agent: "${agentName}"` }, 404);
    }

    if (busyAgents.has(agentName)) {
      return c.json({ error: "Agent is busy with another request" }, 409);
    }

    // Extract user message (last message with role "user")
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) {
      return c.json({ error: "No user message found" }, 400);
    }

    const sessionId =
      c.req.header("x-clawling-session-id") ?? undefined;

    busyAgents.add(agentName);

    try {
      const session = sessionId
        ? await backend.resumeSession(sessionId)
        : await backend.createSession({ agentName });

      // Wire up delegation handler for Messages API sessions
      const msgsSession = getMessagesSession(session.sessionId);
      if (msgsSession) {
        msgsSession.delegateHandler = async (prompt: string) => {
          return spawner.spawn(session.sessionId, "worker", prompt);
        };
      }

      if (!stream) {
        // Non-streaming: collect all events, return final text
        const textParts: string[] = [];
        let delegationTaskId: string | undefined;
        for await (const event of session.prompt(lastUserMsg.content)) {
          if (event.type === "text_delta") textParts.push(event.text);
          if (event.type === "delegation") delegationTaskId = event.taskId;
        }
        return c.json({
          id: `chatcmpl-${session.sessionId.slice(0, 8)}`,
          object: "chat.completion",
          model: modelField,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: textParts.join("") },
              finish_reason: "stop",
            },
          ],
          clawling: {
            sessionId: session.sessionId,
            ...(delegationTaskId ? { delegationTaskId } : {}),
          },
        });
      }

      // Streaming SSE response
      return streamSSE(c, async (sseStream) => {
        try {
          for await (const event of session.prompt(lastUserMsg.content)) {
            const chunk = eventToSSEChunk(event, modelField, session.sessionId);
            if (chunk) {
              await sseStream.write(chunk);
            }
          }
          await sseStream.write("data: [DONE]\n\n");
        } catch (err) {
          log.error(`[gateway] stream error:`, err);
          await sseStream.write(
            `data: ${JSON.stringify({ error: String(err) })}\n\n`
          );
        }
      });
    } finally {
      busyAgents.delete(agentName);
    }
  });

  // -----------------------------------------------------------------------
  // POST /v1/wake/:agent — trigger autonomous work (e.g., shifts)
  // -----------------------------------------------------------------------
  app.post("/v1/wake/:agent", async (c) => {
    const agentName = c.req.param("agent");
    const body = await c.req.json();
    const prompt: string = body.prompt ?? "";

    if (!prompt) {
      return c.json({ error: "prompt is required" }, 400);
    }

    const backend = registry.get(agentName);
    if (!backend) {
      return c.json({ error: `Unknown agent: "${agentName}"` }, 404);
    }

    if (busyAgents.has(agentName)) {
      return c.json({ error: "Agent is busy" }, 409);
    }

    // For shift prompts, create the shift record in CRM before spawning the worker.
    // The worker expects to find an in-progress shift record as its first step.
    let shiftId: number | undefined;
    if (prompt.trim() === "/shift") {
      const crmUrl = process.env.CRM_API_URL || "http://localhost:8002";
      try {
        const resp = await fetch(`${crmUrl}/api/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress", started_at: new Date().toISOString() }),
        });
        if (resp.status === 201) {
          const data = await resp.json() as { id: number };
          shiftId = data.id;
          log.info(`[gateway] created shift record ${shiftId} in CRM`);
        } else {
          const text = await resp.text();
          log.error(`[gateway] failed to create shift record: ${resp.status} ${text}`);
          return c.json({ error: `Failed to create shift record: ${resp.status}` }, 500);
        }
      } catch (err) {
        log.error(`[gateway] CRM unreachable for shift creation:`, err);
        return c.json({ error: `CRM unreachable: ${err}` }, 502);
      }
    }

    // Spawn as a top-level delegation (no parent)
    try {
      busyAgents.add(agentName);
      const taskId = await spawner.spawn("__wake__", agentName, prompt);

      // Clear busy state and update CRM shift record when the task completes
      const clearBusy = setInterval(async () => {
        const record = tracker.get(taskId);
        if (record && record.status !== "running") {
          busyAgents.delete(agentName);
          clearInterval(clearBusy);

          // Mark the CRM shift record as completed/failed
          if (shiftId != null) {
            const crmUrl = process.env.CRM_API_URL || "http://localhost:8002";
            const shiftStatus = record.status === "completed" ? "completed" : "failed";
            try {
              await fetch(`${crmUrl}/api/shifts/${shiftId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: shiftStatus,
                  completed_at: new Date().toISOString(),
                  summary: record.result?.slice(0, 5000) ?? null,
                }),
              });
              log.info(`[gateway] marked shift ${shiftId} as ${shiftStatus}`);
            } catch (err) {
              log.error(`[gateway] failed to update shift ${shiftId}:`, err);
            }
          }
        }
      }, 3000);

      return c.json({ taskId, shiftId });
    } catch (err) {
      busyAgents.delete(agentName);
      return c.json({ error: String(err) }, 500);
    }
  });

  // -----------------------------------------------------------------------
  // GET /v1/status/:taskId — poll for delegation result
  // -----------------------------------------------------------------------
  app.get("/v1/status/:taskId", (c) => {
    const taskId = c.req.param("taskId");

    // Check announcer for consumed-once results
    const result = announcer.poll(taskId);
    if (result) {
      return c.json({
        status: "completed",
        result: result.text,
        taskId: result.taskId,
      });
    }

    // Check tracker for running tasks
    const record = tracker.get(taskId);
    if (record) {
      return c.json({
        status: record.status,
        result: record.status === "running" ? null : record.result,
        taskId,
      });
    }

    return c.json({ status: "not_found", result: null, taskId }, 404);
  });

  // -----------------------------------------------------------------------
  // GET /session/status — compatibility with frontend shifts page
  // -----------------------------------------------------------------------
  app.get("/session/status", (c) => {
    const workerBusy = busyAgents.has("worker");
    const runningTask = tracker.getRunningByAgent("worker");
    return c.json({
      active: busyAgents.size > 0,
      busy: workerBusy || !!runningTask,
      shift_active: workerBusy || !!runningTask ? true : null,
      taskId: runningTask?.taskId ?? null,
    });
  });

  // -----------------------------------------------------------------------
  // POST /session/restart — compatibility with frontend shifts page
  // -----------------------------------------------------------------------
  app.post("/session/restart", (c) => {
    // In clawling, sessions are per-request — just clear busy state
    busyAgents.clear();
    return c.json({ status: "restarted" });
  });

  // -----------------------------------------------------------------------
  // GET /health
  // -----------------------------------------------------------------------
  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}

// ---------------------------------------------------------------------------
// Convert AgentEvent to OpenAI-compatible SSE chunk
// ---------------------------------------------------------------------------

function eventToSSEChunk(
  event: AgentEvent,
  model: string,
  sessionId: string
): string | undefined {
  const base = {
    id: `chatcmpl-${sessionId.slice(0, 8)}`,
    object: "chat.completion.chunk",
    model,
  };

  switch (event.type) {
    case "text_delta":
      return `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta: { content: event.text } }],
      })}\n\n`;

    case "tool_call":
    case "tool_call_update":
    case "delegation":
    case "action":
    case "progress":
    case "cost":
      // Extension events in the clawling namespace
      return `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta: {} }],
        clawling: event,
      })}\n\n`;

    case "done":
      return `data: ${JSON.stringify({
        ...base,
        choices: [
          { index: 0, delta: {}, finish_reason: event.stopReason },
        ],
        clawling: { sessionId },
      })}\n\n`;

    case "error":
      return `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta: {} }],
        clawling: { type: "error", message: event.message },
      })}\n\n`;

    case "text_done":
      return undefined; // Already streamed via text_delta

    default:
      return undefined;
  }
}
