/**
 * Announcer — deliver child agent results back to parent sessions.
 *
 * Results are stored for polling via GET /v1/status/:taskId.
 * Optionally injects results into the parent's Messages API session
 * for conversation continuity.
 */

import { DelegationTracker } from "./tracker.js";
import { getMessagesSession } from "../agents/messages-backend.js";
import { log } from "../log.js";

export class Announcer {
  // Completed results waiting to be polled
  private pendingResults = new Map<string, { text: string; taskId: string }>();

  constructor(private tracker: DelegationTracker) {}

  /**
   * Deliver a child result. Stores for polling and injects into parent
   * Messages API session if available.
   */
  deliver(taskId: string, result: string): void {
    const record = this.tracker.get(taskId);

    // Store for polling
    this.pendingResults.set(taskId, { text: result, taskId });

    // Inject into parent's Messages API session for context continuity
    if (record) {
      const parentSession = getMessagesSession(record.parentSessionId);
      if (parentSession) {
        parentSession.injectWorkerResult(result);
        log.info(
          `[announcer] injected result into parent session=${record.parentSessionId.slice(0, 8)}`
        );
      }
    }

    log.info(
      `[announcer] delivered task=${taskId} (${result.length} chars)`
    );
  }

  /**
   * Poll for a result. Returns and clears it (consumed once).
   */
  poll(taskId: string): { text: string; taskId: string } | undefined {
    const result = this.pendingResults.get(taskId);
    if (result) {
      this.pendingResults.delete(taskId);
    }
    return result;
  }

  /**
   * Check if a task has a pending result (without consuming it).
   */
  hasPendingResult(taskId: string): boolean {
    return this.pendingResults.has(taskId);
  }
}
