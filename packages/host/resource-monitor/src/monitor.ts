/**
 * Leak gate — VRAM/RAM reclaim assert.
 * Pure helpers; probe executes load/unload and checks via `sidecar/status` + `docker stats`.
 * @module @deepseek-ai/dsh-host-resource-monitor/monitor
 */

/** Snapshot of host resources. */
export interface ResourceSnapshot {
  vramMb: number
  ramMb: number
  timestamp: number
}

/** Tolerance for reclaim (5% default). */
export const RECLAIM_TOLERANCE = 0.05

/**
 * Whether `after` reclaimed to within tolerance of `before`.
 * @param before - baseline before load.
 * @param after - after unload.
 * @param tolerance - fractional tolerance (0.05 = 5%).
 * @returns true if reclaimed.
 */
export function isReclaimed(before: ResourceSnapshot, after: ResourceSnapshot, tolerance = RECLAIM_TOLERANCE): boolean {
  const vramOk = Math.abs(after.vramMb - before.vramMb) <= before.vramMb * tolerance + 50
  const ramOk = Math.abs(after.ramMb - before.ramMb) <= before.ramMb * tolerance + 50
  return vramOk && ramOk
}

/**
 * Detect monotonic leak across a history.
 * @param history - ordered snapshots after each unload.
 * @param tolerance - reclaim tolerance.
 * @returns true if leak detected (growth beyond tolerance).
 */
export function detectLeak(history: ResourceSnapshot[], tolerance = RECLAIM_TOLERANCE): boolean {
  if (history.length < 2) return false
  const first = history[0]
  const last = history[history.length - 1]
  if (!first || !last) return false
  return !isReclaimed(first, last, tolerance) && last.vramMb > first.vramMb && last.ramMb >= first.ramMb
}

/**
 * Build a leak report for one iteration.
 * @param iteration - loop index.
 * @param before - before snapshot.
 * @param after - after snapshot.
 * @returns report line.
 */
export function leakReport(iteration: number, before: ResourceSnapshot, after: ResourceSnapshot): string {
  const ok = isReclaimed(before, after)
  return `iter ${iteration}: ${ok ? 'ok' : 'LEAK'} before=${before.vramMb}/${before.ramMb} after=${after.vramMb}/${after.ramMb}`
}
