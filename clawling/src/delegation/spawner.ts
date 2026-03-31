/**
 * Spawner — create child agent sessions for delegation.
 *
 * Non-blocking: spawn() returns a taskId immediately while the child
 * runs in the background. The announcer delivers results when done.
 */

import { randomUUID } from "node:crypto";
import type { AgentRegistry } from "../agents/registry.js";
import type { Config } from "../config.js";
import type { AgentEvent } from "../agents/types.js";
import { DelegationTracker } from "./tracker.js";
import { Announcer } from "./announcer.js";
import { log } from "../log.js";

export class Spawner {
  constructor(
    private registry: AgentRegistry,
    private tracker: DelegationTracker,
    private announcer: Announcer,
    private delegationConfig: Config["delegation"]
  ) {}

  /**
   * Spawn a child agent task. Returns taskId immediately (non-blocking).
   * The child runs in the background; results delivered via announcer.
   */
  async spawn(
    parentSessionId: string,
    childAgentName: string,
    prompt: string
  ): Promise<string> {
    // Check depth limit
    const currentDepth = this.tracker.checkDepth(parentSessionId);
    if (currentDepth >= this.delegationConfig.maxDepth) {
      throw new Error(
        `Delegation depth limit (${this.delegationConfig.maxDepth}) exceeded`
      );
    }

    const backend = this.registry.get(childAgentName);
    if (!backend) {
      throw new Error(`Unknown agent: "${childAgentName}"`);
    }

    const taskId = randomUUID().slice(0, 8);
    const childSession = await backend.createSession({
      agentName: childAgentName,
      parentSessionId,
    });

    this.tracker.register({
      taskId,
      parentSessionId,
      childSessionId: childSession.sessionId,
      childAgentName,
      prompt,
      status: "running",
      startedAt: Date.now(),
      timeout: this.delegationConfig.defaultTimeout,
      depth: currentDepth + 1,
    });

    // Run in background — don't await
    this.runChild(taskId, childSession, prompt).catch((err) => {
      log.error(`[spawner] background error task=${taskId}:`, err);
      this.tracker.fail(taskId, String(err));
    });

    log.info(
      `[spawner] spawned task=${taskId} agent=${childAgentName} parent=${parentSessionId.slice(0, 8)}`
    );
    return taskId;
  }

  /**
   * Spawn and wait for result. Blocks until the child completes.
   */
  async spawnAndWait(
    parentSessionId: string,
    childAgentName: string,
    prompt: string
  ): Promise<string> {
    const backend = this.registry.get(childAgentName);
    if (!backend) throw new Error(`Unknown agent: "${childAgentName}"`);

    const childSession = await backend.createSession({
      agentName: childAgentName,
      parentSessionId,
    });

    const textParts: string[] = [];
    for await (const event of childSession.prompt(prompt)) {
      if (event.type === "text_delta") {
        textParts.push(event.text);
      }
    }
    return textParts.join("") || "(no response)";
  }

  private async runChild(
    taskId: string,
    session: { prompt(msg: string): AsyncGenerator<AgentEvent> },
    prompt: string
  ): Promise<void> {
    const textParts: string[] = [];

    try {
      for await (const event of session.prompt(prompt)) {
        if (event.type === "text_delta") {
          textParts.push(event.text);
        } else if (event.type === "progress") {
          // Update tracker with progress info
          const record = this.tracker.get(taskId);
          if (record) {
            record.result = event.message; // temporary progress message
          }
        }
      }

      const result = textParts.join("") || "(no response)";
      this.tracker.complete(taskId, result);
      this.announcer.deliver(taskId, result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.tracker.fail(taskId, errorMsg);
      this.announcer.deliver(taskId, `Error: ${errorMsg}`);
    }
  }
}
