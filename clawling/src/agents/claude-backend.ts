/**
 * Claude Agent SDK backend — full autonomous agent with tool execution.
 *
 * Wraps @anthropic-ai/claude-agent-sdk query() as an AgentSession that
 * yields AgentEvent. Supports persistent sessions (resume), cost tracking,
 * and postToolUse hooks for progress extraction.
 */

import { randomUUID } from "node:crypto";
import type { AgentConfig, Config } from "../config.js";
import type {
  AgentBackend,
  AgentEvent,
  AgentSession,
  SessionConfig,
} from "./types.js";
import { log } from "../log.js";

export class ClaudeSDKBackend implements AgentBackend {
  readonly backendType = "claude-sdk";

  constructor(
    private name: string,
    private agentConfig: AgentConfig,
    private globalConfig: Config
  ) {}

  async createSession(config: SessionConfig): Promise<AgentSession> {
    const sessionId = config.sessionId ?? randomUUID();
    return new ClaudeSDKSession(
      sessionId,
      config.agentName,
      this.agentConfig,
      this.globalConfig
    );
  }

  async resumeSession(sessionId: string): Promise<AgentSession> {
    return new ClaudeSDKSession(
      sessionId,
      this.name,
      this.agentConfig,
      this.globalConfig,
      true
    );
  }
}

class ClaudeSDKSession implements AgentSession {
  readonly sessionId: string;
  readonly agentName: string;
  private cancelled = false;

  constructor(
    sessionId: string,
    agentName: string,
    private agentConfig: AgentConfig,
    private globalConfig: Config,
    private resume = false
  ) {
    this.sessionId = sessionId;
    this.agentName = agentName;
  }

  async *prompt(message: string): AsyncGenerator<AgentEvent> {
    // Dynamic import to avoid loading the SDK at module level
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    const permissionMode =
      this.agentConfig.permissions === "bypass"
        ? "bypassPermissions"
        : this.agentConfig.permissions === "auto-approve"
          ? "acceptEdits"
          : "default";

    const options: Record<string, unknown> = {
      cwd: this.agentConfig.cwd,
      permissionMode,
      maxTurns: this.agentConfig.maxTurns,
      model: this.agentConfig.model,
    };

    if (this.agentConfig.systemPrompt) {
      options.systemPrompt = this.agentConfig.systemPrompt;
    }

    if (this.resume) {
      options.resume = this.sessionId;
    }

    log.info(
      `[${this.agentName}] query — session=${this.sessionId.slice(0, 8)} resume=${this.resume}`
    );

    const textParts: string[] = [];
    const q = query({ prompt: message, options });

    try {
      for await (const msg of q) {
        if (this.cancelled) break;

        // The SDK emits various message types — map them to AgentEvent
        const msgType = (msg as Record<string, unknown>).type as string;

        if (msgType === "assistant" || msgType === "stream_event") {
          const text =
            (msg as Record<string, unknown>).content as string | undefined;
          if (text) {
            textParts.push(text);
            yield { type: "text_delta", text };
          }
        } else if (msgType === "tool_use_summary") {
          const tool = msg as Record<string, unknown>;
          const toolName = (tool.tool_name ?? tool.name ?? "unknown") as string;
          const status = tool.status as string;
          const input = tool.input;

          if (status === "running" || !status) {
            yield { type: "tool_call", name: toolName, status: "running", input };

            // Extract progress from CRM CLI commands
            const progressMsg = extractProgress(toolName, input);
            if (progressMsg) {
              yield { type: "progress", message: progressMsg };
            }
          } else {
            yield {
              type: "tool_call_update",
              name: toolName,
              status: status === "error" ? "error" : "complete",
              output: tool.output as string | undefined,
            };
          }
        } else if (msgType === "result") {
          const result = msg as Record<string, unknown>;
          const costUsd = result.total_cost_usd as number | undefined;
          if (costUsd != null) {
            yield { type: "cost", totalUsd: costUsd };
          }
          const stopReason =
            (result.stop_reason as string) ?? "end_turn";
          yield { type: "done", stopReason };
          break;
        }
      }

      // If we exited the loop without a result message
      if (!this.cancelled) {
        const fullText = textParts.join("");
        if (fullText) {
          yield { type: "text_done", text: fullText };
        }
      }
    } catch (err) {
      log.error(`[${this.agentName}] error:`, err);
      yield {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  cancel(): void {
    this.cancelled = true;
  }

  close(): void {
    this.cancelled = true;
  }
}

// ---------------------------------------------------------------------------
// Progress extraction from tool calls (replaces Python regex parsing)
// ---------------------------------------------------------------------------

function extractProgress(
  toolName: string,
  input: unknown
): string | undefined {
  if (toolName !== "Bash" || !input) return undefined;
  const cmd =
    typeof input === "string"
      ? input
      : (input as Record<string, unknown>).command as string | undefined;
  if (!cmd?.startsWith("crm ")) return undefined;

  const parts = cmd.split(/\s+/);
  if (parts.length < 3) return undefined;
  const [, entity, action] = parts;

  // Extract detail from JSON payload for create commands
  let detail: string | undefined;
  if (action === "create") {
    const m = cmd.match(/\{.*\}/s);
    if (m) {
      try {
        const data = JSON.parse(m[0]);
        detail =
          data.subject ?? data.title ?? data.name ?? data.description ?? undefined;
        if (detail && detail.length > 60) detail = detail.slice(0, 60);
      } catch {
        // ignore parse errors
      }
    }
  }

  const ctx = detail ? `: ${detail}` : "...";

  if (entity === "shift" && action === "next") return "Fetching next thread...";
  if (entity === "shift" && action === "complete")
    return "Marking thread complete...";
  if (entity === "threads" && action === "get") return "Reading thread...";
  if (entity === "cases" && action === "create") return `Creating case${ctx}`;
  if (entity === "tasks" && action === "create") return `Creating task${ctx}`;
  if (entity === "emails" && action === "create") return `Drafting reply${ctx}`;
  if (entity === "notes" && action === "create")
    return `Writing case notes${ctx}`;

  return undefined;
}
