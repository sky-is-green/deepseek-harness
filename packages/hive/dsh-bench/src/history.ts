/**
 * Bench history helpers for S18 sparkline dashboard.
 * Pure functions over sidecar report payloads and stored history.
 * @module @deepseek-ai/dsh-bench/history
 */

/**
 * One point in the bench history series.
 * @param pes - post-run PES composite (0-100).
 * @param tokPerSec - measured generation throughput, tok/s.
 * @param runName - protocol run directory name (e.g. protocol_20250829_153000).
 * @param timestamp - epoch ms when the report was collected.
 */
export interface BenchHistoryPoint {
  pes: number
  tokPerSec: number
  runName: string
  timestamp: number
}

/**
 * Report shape subset we read for the dashboard.
 * @param post_run_pes - post-run PES block.
 * @param performance - optional tok/s block produced by the harness bench helper.
 */
export interface BenchReportForHistory {
  post_run_pes?: { pes?: number; composite?: number; band?: string } | null
  performance?: { tokPerSec?: number; tok_per_sec?: number; throughput?: number } | null
  metrics?: { tokPerSec?: number } | null
}

/**
 * Extract PES from a report, accepting both `pes` and `composite` shapes.
 * @param report - parsed run report.
 * @returns PES value or 0 when missing.
 */
export function pesOfReport(report: BenchReportForHistory): number {
  const post = report.post_run_pes ?? {}
  const raw = (post as { composite?: number; pes?: number }).composite ?? (post as { pes?: number }).pes
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
}

/**
 * Extract tok/s from a report, accepting several legacy keys.
 * @param report - parsed run report.
 * @returns tok/s or 0 when missing.
 */
export function tokPerSecOfReport(report: BenchReportForHistory): number {
  const p = report.performance ?? report.metrics ?? {}
  const raw =
    (p).tokPerSec ??
    (p as { tok_per_sec?: number }).tok_per_sec ??
    (p as { throughput?: number }).throughput
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
}

/**
 * Build a history point from a report and its run name.
 * @param report - parsed run report.
 * @param runName - run directory name.
 * @param timestamp - epoch ms; defaults to Date.now().
 * @returns history point.
 */
export function toHistoryPoint(
  report: BenchReportForHistory,
  runName: string,
  timestamp = Date.now(),
): BenchHistoryPoint {
  return {
    pes: pesOfReport(report),
    tokPerSec: tokPerSecOfReport(report),
    runName,
    timestamp,
  }
}

/**
 * Normalize an unordered history array into timestamp order and cap length.
 * @param points - unordered history points.
 * @param maxLen - maximum retained points (oldest dropped).
 * @returns ordered, capped copy.
 */
export function normalizeHistory(points: BenchHistoryPoint[], maxLen = 30): BenchHistoryPoint[] {
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  return sorted.length > maxLen ? sorted.slice(-maxLen) : sorted
}

/**
 * Build an SVG sparkline path for a numeric series.
 * Maps values to the box `[0,width] x [0,height]` with Y inverted (0 at top).
 * @param values - numeric series; empty returns empty string.
 * @param width - SVG width.
 * @param height - SVG height.
 * @returns SVG path `d` attribute (e.g. "M0,10 L10,0").
 */
export function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  if (values.length === 1) {
    const y = height / 2
    return `M0,${y.toFixed(2)} L${width.toFixed(2)},${y.toFixed(2)}`
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const pts = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / span) * height
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ')
}

/**
 * Fetch a list of run reports from the sidecar and convert to history points.
 * @param sidecarUrl - sidecar base URL.
 * @param runNames - run directory names to fetch.
 * @param timeoutMs - per-request timeout.
 * @returns history points in the same order as `runNames`, skipping failed fetches.
 */
export async function fetchBenchHistory(
  sidecarUrl: string,
  runNames: string[],
  timeoutMs = 15_000,
): Promise<BenchHistoryPoint[]> {
  const base = sidecarUrl.replace(/\/$/, '')
  const out: BenchHistoryPoint[] = []
  for (const runName of runNames) {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort(new Error('sidecar request timed out'))
    }, timeoutMs)
    try {
      const res = await fetch(`${base}/v1/report/${encodeURIComponent(runName)}`, {
        signal: controller.signal,
      })
      if (!res.ok) continue
      const report = (await res.json()) as BenchReportForHistory
      out.push(toHistoryPoint(report, runName))
    } catch {
      // Skip unreachable or timed-out runs; sparkline degrades gracefully.
    } finally {
      clearTimeout(timer)
    }
  }
  return out
}
