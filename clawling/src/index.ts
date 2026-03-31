/**
 * Clawling — lightweight agent orchestration with multi-level delegation.
 *
 * Entry point: loads config, initializes agent registry, starts HTTP gateway.
 */

import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { AgentRegistry } from "./agents/registry.js";
import { DelegationTracker } from "./delegation/tracker.js";
import { Spawner } from "./delegation/spawner.js";
import { Announcer } from "./delegation/announcer.js";
import { createGateway } from "./gateway.js";
import { log } from "./log.js";

const CONFIG_PATH = process.env.CLAWLING_CONFIG ?? "./config.json";

async function main() {
  log.info("Starting clawling...");

  // Load and validate config
  const config = loadConfig(resolve(CONFIG_PATH));
  log.info(
    `Config loaded — ${Object.keys(config.agents).length} agent(s), port ${config.gateway.port}`
  );

  // Initialize agent registry
  const registry = new AgentRegistry(config);
  await registry.initialize();

  // Initialize delegation system
  const tracker = new DelegationTracker(config.delegation);
  const announcer = new Announcer(tracker);
  const spawner = new Spawner(registry, tracker, announcer, config.delegation);

  // Recover orphaned delegations from previous process
  tracker.recoverOrphans();

  // Start HTTP gateway
  const app = createGateway({ config, registry, spawner, tracker, announcer });

  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port: config.gateway.port }, (info) => {
    log.info(`Gateway listening on http://localhost:${info.port}`);
    log.info(`Agents: ${registry.agentNames().join(", ")}`);
  });
}

main().catch((err) => {
  log.error("Fatal:", err);
  process.exit(1);
});
