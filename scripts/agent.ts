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
  if (!resp.ok) throw new Error(`Wake failed: ${resp.status}`);

  const { taskId } = (await resp.json()) as { taskId: string };
  console.log(`Task ${taskId} started. Polling CRM for shift completion...`);

  // Wait for shift record to appear
  let shiftId: number | null = null;
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    try {
      const r = await fetch(
        `${CRM_URL}/api/shifts?status=in_progress&limit=1`,
        { signal: AbortSignal.timeout(10_000) },
      );
      const data = (await r.json()) as { list: { id: number }[] };
      if (data.list?.length) {
        shiftId = data.list[0].id;
        break;
      }
    } catch {
      // retry
    }
  }

  if (!shiftId) {
    console.log("Warning: could not find in-progress shift record, polling task status instead");
    while (true) {
      await sleep(3000);
      try {
        const r = await fetch(`${AGENT_URL}/v1/status/${taskId}`, {
          signal: AbortSignal.timeout(10_000),
        });
        const data = (await r.json()) as { status: string; result?: string };
        if (data.status === "completed" || data.status === "failed") {
          console.log(`\nTask ${data.status}.`);
          if (data.result) console.log(data.result);
          break;
        }
        process.stdout.write(".");
      } catch (e) {
        console.error(`\nPolling error: ${e}`);
        break;
      }
    }
    return;
  }

  console.log(`Shift ${shiftId} in progress. Polling...`);
  while (true) {
    await sleep(3000);
    try {
      const r = await fetch(`${CRM_URL}/api/shifts/${shiftId}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const data = (await r.json()) as { status: string; summary?: string };
      if (data.status === "completed" || data.status === "failed") {
        console.log(`\nShift ${data.status}.`);
        if (data.summary) console.log(data.summary);
        break;
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
