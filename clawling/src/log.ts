/**
 * Minimal structured logger.
 */

const ts = () => new Date().toISOString().slice(11, 23);

export const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`${ts()} [clawling] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`${ts()} [clawling] WARN ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`${ts()} [clawling] ERROR ${msg}`, ...args),
};
