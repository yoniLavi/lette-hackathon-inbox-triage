/**
 * Core interfaces for agent backends, sessions, and the unified event stream.
 *
 * All agent backends (Claude SDK, Messages API, future ACP) implement
 * AgentBackend and emit AgentEvent through AgentSession.
 */

// ---------------------------------------------------------------------------
// Agent Events — unified stream emitted by all backends
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "text_done"; text: string }
  | { type: "tool_call"; name: string; input?: unknown; status: "running" }
  | {
      type: "tool_call_update";
      name: string;
      status: "complete" | "error";
      output?: string;
    }
  | { type: "delegation"; childAgent: string; taskId: string; prompt: string }
  | { type: "action"; action: string; target: Record<string, unknown> }
  | { type: "cost"; totalUsd: number; tokens?: TokenUsage }
  | { type: "progress"; message: string }
  | { type: "done"; stopReason: string }
  | { type: "error"; message: string };

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

// ---------------------------------------------------------------------------
// Session config — passed when creating/resuming sessions
// ---------------------------------------------------------------------------

export interface SessionConfig {
  agentName: string;
  cwd?: string;
  systemPrompt?: string;
  sessionId?: string; // resume existing
  parentSessionId?: string; // if spawned as child
}

// ---------------------------------------------------------------------------
// Agent session — returned by createSession/resumeSession
// ---------------------------------------------------------------------------

export interface AgentSession {
  readonly sessionId: string;
  readonly agentName: string;
  prompt(message: string): AsyncGenerator<AgentEvent>;
  cancel(): void;
  close(): void;
}

// ---------------------------------------------------------------------------
// Agent backend — factory for sessions
// ---------------------------------------------------------------------------

export interface AgentBackend {
  readonly backendType: string;
  createSession(config: SessionConfig): Promise<AgentSession>;
  resumeSession(sessionId: string): Promise<AgentSession>;
}

// ---------------------------------------------------------------------------
// Session info — for listing/introspection
// ---------------------------------------------------------------------------

export interface SessionInfo {
  sessionId: string;
  agentName: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
}
