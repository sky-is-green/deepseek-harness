/**
 * PES regression gate for the HiveBench protocol runner.
 * Pure comparison: no I/O, no side effects. The CLI wrapper reads the
 * committed baseline and the live report and calls this module.
 * @module @deepseek-ai/dsh-bench/gate
 */

import type { RunReportSummary } from './index.ts'

/**
 * Committed baseline the gate compares against.
 */
export interface PesBaseline {
  /** Baseline PES value. */
  pes: number
  /** Optional baseline band (informational). */
  band?: string
}

/**
 * Gate outcome for one report vs the baseline.
 */
export interface GateDecision {
  /** True when the report PES is a regression beyond the allowed drop. */
  regression: boolean
  /** PES delta (actual - baseline). */
  delta: number
  /** Actual PES from the report (NaN when unavailable). */
  actual: number
  /** Baseline PES. */
  baseline: number
  /** Allowed drop before a gate failure (0 = any drop fails). */
  threshold: number
  /** Human-readable headline. */
  text: string
}

/**
 * Extract PES from a report summary.
 * @param report - parsed run report.
 * @returns PES value or undefined when missing.
 */
export function pesOf(report: RunReportSummary): number | undefined {
  return report.post_run_pes?.pes
}

/**
 * Decide whether a report is a regression vs the baseline.
 * A missing actual PES is never a regression (report not comparable).
 * @param report - parsed run report.
 * @param baseline - committed baseline.
 * @param threshold - allowed PES drop (default 0). Regression when delta < -threshold.
 * @returns gate decision.
 */
export function evaluateGate(report: RunReportSummary, baseline: PesBaseline, threshold = 0): GateDecision {
  const actual = pesOf(report)
  const delta = actual === undefined ? 0 : actual - baseline.pes
  const regression = actual !== undefined && delta < -threshold
  const text = actual === undefined
    ? `PES n/a vs baseline ${baseline.pes} — gate skipped`
    : regression
      ? `PES ${actual} vs baseline ${baseline.pes} (Δ ${delta.toFixed(2)} < -${threshold}): REGRESSION`
      : `PES ${actual} vs baseline ${baseline.pes} (Δ ${delta.toFixed(2)}): ok`
  return { regression, delta, actual: actual ?? Number.NaN, baseline: baseline.pes, threshold, text }
}

/**
 * Non-zero exit when regression; 0 otherwise. Mirrors CI gate semantics.
 * @param decision - gate decision.
 * @returns 1 on regression, 0 otherwise.
 */
export function exitCodeFor(decision: GateDecision): number {
  return decision.regression ? 1 : 0
}
