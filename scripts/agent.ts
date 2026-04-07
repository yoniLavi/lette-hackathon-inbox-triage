/**
 * Run a prompt against the CRM agent via clawling.
 *
 * Usage:
 *   npx tsx scripts/agent.ts "List all emails in the CRM"
 *   npx tsx scripts/agent.ts --status     Show gateway health
 *   npx tsx scripts/agent.ts --shift      Start a batch email processing shift
 */

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8001";
const CRM_URL = process.env.CRM_API_URL || "http://localhost:8002";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function agentFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    die(`Error: cannot connect to clawling at ${AGENT_URL}\nIs clawling running? Try: docker compose up -d`);
  }
}

async function runShift(): Promise<void> {
  console.log("Starting shift (batch email processing)...");
  const resp = await agentFetch(`${AGENT_URL}/v1/wake/worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "/shift" }),
    signal: AbortSignal.timeout(30_000),
  });

  if (resp.status === 409) {
    console.error("Error: agent is busy with another request");
    process.exit(1);
  }
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Wake failed (${resp.status}): ${body}`);
  }

  const wakeData = (await resp.json()) as { taskId: string; shiftId?: number };
  const { taskId } = wakeData;
  let shiftId: number | null = wakeData.shiftId ?? null;
  console.log(`Task ${taskId} started.${shiftId ? ` Shift ${shiftId} created.` : ""} Waiting...`);

  // If the wake endpoint didn't return a shiftId, poll for it
  if (!shiftId) {
    for (let i = 0; i < 15; i++) {
      await sleep(2000);

      // Check task status first — surface failures immediately
      try {
        const tr = await fetch(`${AGENT_URL}/v1/status/${taskId}`, {
          signal: AbortSignal.timeout(5_000),
        });
        const task = (await tr.json()) as { status: string; result?: string };
        if (task.status === "failed") {
          console.error(`\nShift failed: ${task.result || "(no details)"}`);
          process.exit(1);
        }
        if (task.status === "completed") {
          console.log(`\nTask completed.`);
          if (task.result) console.log(task.result);
          return;
        }
      } catch {
        // task status endpoint unavailable, continue to CRM poll
      }

      // Check CRM for in-progress shift
      try {
        const r = await fetch(
          `${CRM_URL}/api/shifts?status=in_progress&limit=1`,
          { signal: AbortSignal.timeout(5_000) },
        );
        const data = (await r.json()) as { list: { id: number }[] };
        if (data.list?.length) {
          shiftId = data.list[0].id;
          break;
        }
      } catch {
        // CRM unavailable, retry
      }
      process.stdout.write(".");
    }
  }

  if (!shiftId) {
    console.error("\nError: shift never started — no in-progress shift record found and task did not complete.");
    console.error("Check clawling logs: docker compose logs clawling --tail 50");
    process.exit(1);
  }

  console.log(`\nShift ${shiftId} in progress. Polling...`);
  while (true) {
    await sleep(3000);
    // Check task status — the worker may finish without updating the CRM shift record
    try {
      const tr = await fetch(`${AGENT_URL}/v1/status/${taskId}`, {
        signal: AbortSignal.timeout(5_000),
      });
      const task = (await tr.json()) as { status: string; result?: string };
      if (task.status === "failed") {
        console.error(`\nShift failed: ${task.result || "(no details)"}`);
        process.exit(1);
      }
      if (task.status === "completed") {
        console.log(`\nShift completed.`);
        if (task.result) console.log(task.result);
        break;
      }
    } catch {
      // task status unavailable, fall through to CRM poll
    }

    // Also check CRM shift record (worker may have updated it directly)
    try {
      const r = await fetch(`${CRM_URL}/api/shifts/${shiftId}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!r.ok) throw new Error(`CRM returned ${r.status}`);
      const data = (await r.json()) as { status: string; summary?: string };
      if (data.status === "completed") {
        console.log(`\nShift completed.`);
        if (data.summary) console.log(data.summary);
        break;
      }
      if (data.status === "failed") {
        console.error(`\nShift failed.`);
        if (data.summary) console.error(data.summary);
        process.exit(1);
      }
      process.stdout.write(".");
    } catch (e) {
      console.error(`\nPolling error: ${e}`);
      break;
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "--shift") return runShift();

  if (args[0] === "--status") {
    const r = await fetch(`${AGENT_URL}/health`);
    console.log(await r.json());
    return;
  }

  const prompt = args.length > 0 ? args.join(" ") : null;
  if (!prompt) {
    console.log(
      'Usage:\n  npx tsx scripts/agent.ts "prompt"\n  npx tsx scripts/agent.ts --status\n  npx tsx scripts/agent.ts --shift',
    );
    process.exit(1);
  }

  const resp = await agentFetch(`${AGENT_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "clawling/frontend",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (resp.status === 409) {
    console.error("Error: agent is busy processing another prompt");
    process.exit(1);
  }
  if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);

  const data = (await resp.json()) as {
    choices: { message: { content: string } }[];
  };
  console.log(data.choices?.[0]?.message?.content || "");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
