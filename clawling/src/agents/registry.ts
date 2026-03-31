/**
 * Agent registry — creates and manages backend instances from config.
 *
 * At startup, iterates agent definitions and instantiates the correct
 * backend (claude-sdk or messages-api). Provides lookup by agent name.
 */

import type { Config, AgentConfig } from "../config.js";
import type { AgentBackend } from "./types.js";
import { ClaudeSDKBackend } from "./claude-backend.js";
import { MessagesAPIBackend } from "./messages-backend.js";
import { log } from "../log.js";

export class AgentRegistry {
  private backends = new Map<string, AgentBackend>();
  private configs = new Map<string, AgentConfig>();

  constructor(private config: Config) {}

  async initialize(): Promise<void> {
    for (const [name, agentConfig] of Object.entries(this.config.agents) as [string, AgentConfig][]) {
      const backend = this.createBackend(name, agentConfig);
      this.backends.set(name, backend);
      this.configs.set(name, agentConfig);
      log.info(
        `Registered agent "${name}" — backend=${agentConfig.backend} model=${agentConfig.model}`
      );
    }
  }

  get(name: string): AgentBackend | undefined {
    return this.backends.get(name);
  }

  getConfig(name: string): AgentConfig | undefined {
    return this.configs.get(name);
  }

  agentNames(): string[] {
    return [...this.backends.keys()];
  }

  private createBackend(name: string, config: AgentConfig): AgentBackend {
    switch (config.backend) {
      case "claude-sdk":
        return new ClaudeSDKBackend(name, config, this.config);
      case "messages-api":
        return new MessagesAPIBackend(name, config, this.config);
      default:
        throw new Error(
          `Agent "${name}": unknown backend "${config.backend}"`
        );
    }
  }
}
