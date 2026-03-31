/**
 * Delegation tracker — parent-child bookkeeping.
 *
 * Tracks active delegations, detects timeouts, and recovers orphans on startup.
 */

import type { Config } from "../config.js";
import { log } from "../log.js";

export interface DelegationRecord {
  taskId: string;
  parentSessionId: string;
  childSessionId: string;
  childAgentName: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  result?: string;
  startedAt: number;
  completedAt?: number;
  timeout: number;
  depth: number;
}

export class DelegationTracker {
  private records = new Map<string, DelegationRecord>();

  constructor(
    private delegationConfig: Config["delegation"]
  ) {}

  register(record: DelegationRecord): void {
    this.records.set(record.taskId, record);
    log.info(
      `[tracker] registered task=${record.taskId} parent=${record.parentSessionId.slice(0, 8)} child=${record.childAgentName}`
    );
  }

  complete(taskId: string, result: string): void {
    const record = this.records.get(taskId);
    if (!record) return;
    record.status = "completed";
    record.result = result;
    record.completedAt = Date.now();
    log.info(
      `[tracker] completed task=${taskId} (${result.length} chars)`
    );
  }

  fail(taskId: string, error: string): void {
    const record = this.records.get(taskId);
    if (!record) return;
    record.status = "failed";
    record.result = error;
    record.completedAt = Date.now();
    log.warn(`[tracker] failed task=${taskId}: ${error}`);
  }

  get(taskId: string): DelegationRecord | undefined {
    return this.records.get(taskId);
  }

  getByParent(parentSessionId: string): DelegationRecord[] {
    return [...this.records.values()].filter(
      (r) => r.parentSessionId === parentSessionId
    );
  }

  /** Consume a completed/failed result — returns it once, then clears. */
  consumeResult(taskId: string): DelegationRecord | undefined {
    const record = this.records.get(taskId);
    if (!record || record.status === "running") return undefined;
    this.records.delete(taskId);
    return record;
  }

  /** Check depth limit for nested delegation. */
  checkDepth(parentSessionId: string): number {
    let depth = 0;
    for (const r of this.records.values()) {
      if (r.childSessionId === parentSessionId && r.status === "running") {
        depth = Math.max(depth, r.depth);
      }
    }
    return depth;
  }

  /** Mark orphaned running delegations as failed (called on startup). */
  recoverOrphans(): void {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.status === "running") {
        record.status = "failed";
        record.result = "Delegation interrupted (clawling restarted)";
        record.completedAt = Date.now();
        count++;
      }
    }
    if (count > 0) {
      log.info(`[tracker] recovered ${count} orphaned delegation(s)`);
    }
  }

  /** Check for timed-out delegations. */
  checkTimeouts(): void {
    const now = Date.now();
    for (const record of this.records.values()) {
      if (
        record.status === "running" &&
        now - record.startedAt > record.timeout * 1000
      ) {
        this.fail(
          record.taskId,
          `Delegation timed out after ${record.timeout}s`
        );
      }
    }
  }
}
