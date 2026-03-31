/**
 * Messages API backend — lightweight, fast agent for frontend chat.
 *
 * Wraps @anthropic-ai/bedrock-sdk Messages API with in-process conversation
 * history and framework-defined tool execution (delegate_to_worker, page_action).
 * Optimized for <3s responses from page context.
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

// Tool definitions for the Messages API (same schema as current Python TOOLS)
const TOOLS = [
  {
    name: "delegate_to_worker",
    description:
      "Delegate a CRM query to the Worker AI. Returns a task ID immediately. " +
      "The worker runs in the background — you will NOT get the result back. " +
      "After calling this tool, tell the user you're looking into it and end your turn. " +
      "The system will deliver the worker's result to the user automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string" as const,
          description: "A clear CRM query or action for the worker.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "page_action",
    description:
      "Trigger a UI action on the user's page. Use this to draw the user's " +
      "attention to a specific element. Call at most once per turn. " +
      "Do NOT combine with delegate_to_worker in the same turn.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string" as const,
          enum: ["scrollTo", "expand", "navigate"],
          description:
            "scrollTo: scroll to and highlight an element. " +
            "expand: expand a collapsed thread. " +
            "navigate: navigate to a different page.",
        },
        target: {
          type: "object" as const,
          description: "The element to target.",
          properties: {
            type: {
              type: "string" as const,
              enum: [
                "case", "email", "thread", "task", "draft", "note",
                "dashboard", "properties", "property", "contacts", "contact",
                "inbox", "tasks", "search", "shifts",
              ],
            },
            id: { type: "string" as const, description: "Element/entity ID." },
            query: {
              type: "string" as const,
              description: "Search query. Only for navigate to search.",
            },
          },
          required: ["type"],
        },
      },
      required: ["action", "target"],
    },
  },
];

// ---------------------------------------------------------------------------
// Types for Anthropic Messages API response (minimal, avoid SDK dep in types)
// ---------------------------------------------------------------------------
interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface MessagesResponse {
  stop_reason: string;
  content: ContentBlock[];
}

// Delegate handler type — injected by the gateway/spawner
export type DelegateHandler = (prompt: string) => Promise<string>;

export class MessagesAPIBackend implements AgentBackend {
  readonly backendType = "messages-api";

  constructor(
    private name: string,
    private agentConfig: AgentConfig,
    private globalConfig: Config
  ) {}

  async createSession(config: SessionConfig): Promise<AgentSession> {
    const sessionId = config.sessionId ?? randomUUID();
    return new MessagesAPISession(
      sessionId,
      config.agentName,
      this.agentConfig
    );
  }

  async resumeSession(sessionId: string): Promise<AgentSession> {
    // Look up existing in-memory session
    const existing = sessionStore.get(sessionId);
    if (existing) {
      log.info(`[${this.name}] Resuming session ${sessionId.slice(0, 8)} (${existing.messages.length} messages)`);
      return existing;
    }
    log.warn(
      `[${this.name}] Session ${sessionId.slice(0, 8)} not found; creating fresh session`
    );
    return new MessagesAPISession(sessionId, this.name, this.agentConfig);
  }
}

// Per-session state (lives for the lifetime of the clawling process)
const sessionStore = new Map<string, MessagesAPISession>();

class MessagesAPISession implements AgentSession {
  readonly sessionId: string;
  readonly agentName: string;
  messages: Array<{ role: string; content: unknown }> = [];
  private cancelled = false;
  private client: unknown = null;

  // Injected by the gateway before prompting
  delegateHandler?: DelegateHandler;

  constructor(
    sessionId: string,
    agentName: string,
    private agentConfig: AgentConfig
  ) {
    this.sessionId = sessionId;
    this.agentName = agentName;
    sessionStore.set(sessionId, this);
  }

  async *prompt(message: string): AsyncGenerator<AgentEvent> {
    this.messages.push({ role: "user", content: message });

    const client = await this.getClient();
    const maxTurns = this.agentConfig.maxTurns;

    const allText: string[] = [];

    for (let turn = 0; turn < maxTurns; turn++) {
      if (this.cancelled) break;

      log.info(`[${this.agentName}] Messages API turn ${turn}`);

      const response = (await (client as any).messages.create({
        model: this.agentConfig.model,
        max_tokens: 4096,
        system: this.agentConfig.systemPrompt ?? "",
        messages: this.messages,
        tools: TOOLS,
      })) as MessagesResponse;

      // Serialize response to conversation history
      const serialized = response.content
        .map((b) => serializeBlock(b))
        .filter(
          (b) => !(b.type === "text" && !b.text)
        );
      if (serialized.length === 0) {
        serialized.push({ type: "text", text: "(empty response)" });
      }
      this.messages.push({ role: "assistant", content: serialized });

      // Process content blocks
      const toolUses: ContentBlock[] = [];

      for (const block of response.content) {
        if (block.type === "text" && block.text) {
          allText.push(block.text);
          yield { type: "text_delta", text: block.text };
        } else if (block.type === "tool_use") {
          toolUses.push(block);
        }
      }

      // No tool calls → done
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        yield { type: "done", stopReason: response.stop_reason };
        break;
      }

      // Execute tools
      const toolResults: Array<Record<string, unknown>> = [];

      for (const tu of toolUses) {
        if (tu.name === "delegate_to_worker") {
          if (this.delegateHandler) {
            try {
              const taskId = await this.delegateHandler(
                (tu.input as Record<string, string>).prompt
              );
              yield {
                type: "delegation",
                childAgent: "worker",
                taskId,
                prompt: (tu.input as Record<string, string>).prompt,
              };
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({
                  task_id: taskId,
                  status: "queued",
                  note: "Worker is running. End your turn now — the system will deliver results to the user.",
                }),
              });
            } catch (e) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ error: String(e) }),
                is_error: true,
              });
            }
          } else {
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify({
                error: "No delegate handler configured",
              }),
              is_error: true,
            });
          }
        } else if (tu.name === "page_action") {
          const input = tu.input as Record<string, unknown>;
          yield {
            type: "action",
            action: input.action as string,
            target: input.target as Record<string, unknown>,
          };
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify({
              status: "executed",
              note: "Action sent to the user's browser.",
            }),
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify({ error: `Unknown tool: ${tu.name}` }),
            is_error: true,
          });
        }
      }

      this.messages.push({ role: "user", content: toolResults });
    }

    const fullText = allText.join("\n\n");
    if (fullText) {
      yield { type: "text_done", text: fullText };
    }
  }

  /** Inject worker result into conversation for context continuity. */
  injectWorkerResult(result: string): void {
    this.messages.push({
      role: "user",
      content:
        "[Internal: worker result — do NOT repeat this verbatim. " +
        "Summarize conversationally in 2-4 sentences. Highlight only " +
        "what matters most. The user can see the full data on the page.]\n\n" +
        result,
    });
  }

  cancel(): void {
    this.cancelled = true;
  }

  close(): void {
    this.cancelled = true;
    sessionStore.delete(this.sessionId);
  }

  reset(): void {
    this.messages = [];
  }

  private async getClient(): Promise<unknown> {
    if (this.client) return this.client;

    const region = process.env.AWS_REGION ?? "eu-west-1";
    const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK ?? "";

    const { AnthropicBedrock } = await import("@anthropic-ai/bedrock-sdk");

    if (bearerToken) {
      log.info(
        `[${this.agentName}] Creating Bedrock client (bearer token, region=${region})`
      );
      // Skip SigV4 for bearer token auth — pass token via default header
      this.client = new AnthropicBedrock({
        awsRegion: region,
        skipAuth: true,
        defaultHeaders: { Authorization: `Bearer ${bearerToken}` },
      });
    } else {
      log.info(
        `[${this.agentName}] Creating Bedrock client (IAM credentials, region=${region})`
      );
      this.client = new AnthropicBedrock({ awsRegion: region });
    }

    return this.client;
  }
}

function serializeBlock(
  block: ContentBlock
): Record<string, unknown> {
  if (block.type === "text") {
    return { type: "text", text: block.text ?? "" };
  } else if (block.type === "tool_use") {
    return { type: "tool_use", id: block.id, name: block.name, input: block.input };
  }
  return { type: block.type };
}

/** Get an existing Messages API session for worker result injection. */
export function getMessagesSession(
  sessionId: string
): MessagesAPISession | undefined {
  return sessionStore.get(sessionId);
}
