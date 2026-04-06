/**
 * Configuration schema and loader.
 *
 * Validates config.json at startup using Zod, providing clear error messages
 * for misconfiguration. Supports file-based system prompts (paths starting
 * with ./ are resolved relative to config directory).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AgentConfigSchema = z.object({
  backend: z.enum(["claude-sdk", "messages-api"]),
  model: z.string(),
  systemPrompt: z.string().optional(),
  cwd: z.string().optional(),
  permissions: z.enum(["bypass", "auto-approve", "default"]).default("default"),
  maxTurns: z.number().int().positive().default(10),
  tools: z.array(z.string()).optional(),
});

const GatewaySchema = z.object({
  port: z.number().int().positive().default(8001),
  cors: z.array(z.string()).default(["*"]),
});

const DelegationSchema = z.object({
  maxDepth: z.number().int().positive().default(3),
  defaultTimeout: z.number().positive().default(300),
});

export const ConfigSchema = z.object({
  gateway: GatewaySchema.default(() => ({ port: 8001, cors: ["*"] })),
  agents: z.record(z.string(), AgentConfigSchema),
  delegation: DelegationSchema.default(() => ({ maxDepth: 3, defaultTimeout: 300 })),
});

export type Config = z.infer<typeof ConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadConfig(configPath: string): Config {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw);
  const config = ConfigSchema.parse(parsed);

  // Resolve file-based system prompts relative to config directory
  const configDir = dirname(resolve(configPath));
  for (const [name, agent] of Object.entries(config.agents)) {
    if (agent.systemPrompt?.startsWith("./")) {
      const promptPath = resolve(configDir, agent.systemPrompt);
      try {
        agent.systemPrompt = readFileSync(promptPath, "utf-8");
      } catch (err) {
        throw new Error(
          `Agent "${name}": could not read systemPrompt from ${promptPath}: ${err}`
        );
      }
    }
  }

  return config;
}
