/**
 * Session store — framework-level session tracking.
 *
 * Tracks active sessions and their metadata. Agent-internal persistence
 * (conversation history) is handled by each backend. This store tracks
 * framework concerns: which agent, when created, message counts.
 */

import { log } from "../log.js";
import type { SessionInfo } from "../agents/types.js";

export class SessionStore {
  private sessions = new Map<string, SessionInfo>();

  register(info: SessionInfo): void {
    this.sessions.set(info.sessionId, info);
  }

  get(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  update(sessionId: string, patch: Partial<SessionInfo>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, patch);
    }
  }

  list(agentName?: string): SessionInfo[] {
    const all = [...this.sessions.values()];
    return agentName ? all.filter((s) => s.agentName === agentName) : all;
  }

  incrementMessageCount(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount++;
      session.lastActivityAt = new Date().toISOString();
    }
  }
}
