/**
 * MCP bridge — expose custom tools to agents via createSdkMcpServer.
 *
 * Reads tool definitions from config and registers them as MCP tools
 * that execute shell commands with template substitution.
 */

import { execSync } from "node:child_process";
import type { CustomToolConfig } from "../config.js";
import { log } from "../log.js";

/**
 * Build MCP tool definitions for the Claude SDK backend.
 * Returns a tools array compatible with the Agent SDK's mcpServers config.
 */
export function buildMCPTools(
  tools: Record<string, CustomToolConfig>
): Array<{ name: string; description: string; handler: (input: Record<string, string>) => string }> {
  return Object.entries(tools).map(([name, config]) => ({
    name,
    description: config.description,
    handler: (input: Record<string, string>) => {
      let command = config.command;
      // Template substitution: {{key}} -> value
      for (const [key, value] of Object.entries(input)) {
        command = command.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, "g"),
          value
        );
      }
      log.info(`[mcp-bridge] executing: ${command.slice(0, 120)}`);
      try {
        const output = execSync(command, {
          encoding: "utf-8",
          timeout: 30_000,
        });
        return output;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`[mcp-bridge] command failed: ${msg}`);
        return `Error: ${msg}`;
      }
    },
  }));
}
