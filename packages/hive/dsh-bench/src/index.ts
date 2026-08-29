/**
 * HiveBench Studio benchmark surface (dsh-bench).
 *
 * The `/bench` command launches a HiveBench protocol run through the hive
 * sidecar (`POST /v1/protocol/run` â€” the sidecar starts `generate_data` in a
 * background process and returns immediately) and summarizes the finished
 * run report (`GET /v1/report/<name>`: post-run PES + P1-P11 verdicts).
 *
 * The launch and summary are recorded as a log-only `bench/run` session
 * event (never model-visible). When the sidecar is down or the run is still
 * in flight, the command reports that instead of failing the session.
 *
 * S18 adds the dashboard history surface: PES/tok/s points extracted from
 * reports and an SVG sparkline path helper consumed by `ui-sidecar-panel`.
 *
 * @module @deepseek-ai/dsh-bench
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type { Session } from '@deepseek-ai/dsh-session'

export type { BenchHistoryPoint, BenchReportForHistory } from './history.ts'
export {
  buildSparklinePath,
  fetchBenchHistory,
  normalizeHistory,
  pesOfReport,
  tokPerSecOfReport,
  toHistoryPoint,
} from './history.ts'

/** Cordis plugin name used by loader diagnostics and profile composition. */
export const name = 'dsh-bench'

/** The command registry that owns slash commands. */
export const inject = ['commands']

/** Default sidecar origin (the harness binds 127.0.0.1:8765 locally). */
export const DEFAULT_SIDECAR_URL = 'http://127.0.0.1:8765'

/**
 * Benchmark surface configuration. Invalid values fail plugin load.
 */
export interface Config {
  /** Sidecar origin, e.g. `http://127.0.0.1:8765`. */
  sidecarUrl?: string
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Master switch (off == the `/bench` command is absent). */
  enabled?: boolean
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  sidecarUrl: z.string().default(DEFAULT_SIDECAR_URL),
  timeoutMs: z.number().default(15_000),
  enabled: z.boolean().default(true),
})

export type { PesBaseline, GateDecision } from './gate.ts'
export { evaluateGate, exitCodeFor, pesOf } from './gate.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * One benchmark run launched from this session. Log-only and independent
     * of its trigger; it never enters model context or derived history.
     */
    'bench/run': {
      mode: 'live' | 'mock'
      runDir: string
      pid: number
      ok: boolean
      summary?: string
    }
  }
}

/** Response of the sidecar's POST /v1/protocol/run. */
export interface ProtocolRunResponse {
  run_dir: string
  pid: number
}

/** Parsed run report block the summary reads. */
export interface RunReportSummary {
  post_run_pes?: { pes?: number; band?: string }
  protocol?: { id: string; status: string }[]
}

const USAGE = 'Usage: /bench [live|mock] [max-convs] | /bench <run-name>'

/**
 * Parse `mode`/`max-convs` or a collect run name from the raw command input.
 * @param rawInput - raw command input after `/bench`.
 * @returns resolved mode and conversation cap, plus the collect run name when the input names one.
 */
export function parseBenchInput(rawInput: string): { mode: 'live' | 'mock'; maxConvs: number; collect?: string } {
  const parts = rawInput.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  if (/^protocol_\d+/.test(first)) {
    return { mode: 'mock', maxConvs: 5, collect: first }
  }
  let mode: 'live' | 'mock' = 'mock'
  let maxConvs = 5
  for (const part of parts) {
    if (part === 'live' || part === 'mock') {
      mode = part
    } else if (/^\d+$/.test(part)) {
      maxConvs = Number.parseInt(part, 10)
    }
  }
  return { mode, maxConvs }
}

/**
 * Fetch and summarize an existing run report by its run name.
 * @param sidecarUrl - hive sidecar base URL.
 * @param runName - protocol run directory name.
 * @param timeoutMs - request budget before the fetch aborts.
 * @returns ok with a user-facing summary line, or not-ok with failure copy.
 */
export async function collectReport(
  sidecarUrl: string,
  runName: string,
  timeoutMs: number,
): Promise<{ ok: boolean; text: string }> {
  const base = sidecarUrl.replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort(new Error('sidecar request timed out')) }, timeoutMs)
  try {
    const res = await fetch(`${base}/v1/report/${encodeURIComponent(runName)}`, {
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, text: `Run ${runName}: no report yet (${res.status}) â€” in flight or unknown` }
    }
    const report = await res.json() as RunReportSummary
    return { ok: true, text: `${runName}: ${summarizeReport(report)}` }
  } catch {
    return { ok: false, text: `Sidecar unreachable at ${base}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Summarize a run report into one headline line.
 * @param report - parsed run report block.
 * @returns single-line PES and protocol verdict summary.
 */
export function summarizeReport(report: RunReportSummary): string {
  const pes = report.post_run_pes
  const pesText = pes?.pes !== undefined
    ? `PES ${pes.pes} (${pes.band ?? '?'})`
    : 'PES n/a'
  const verdicts = report.protocol ?? []
  const pass = verdicts.filter(v => v.status === 'PASS').length
  const fail = verdicts.filter(v => v.status === 'FAIL').length
  const skip = verdicts.filter(v => v.status === 'SKIP' || v.status === 'REPORT').length
  const protocolText = verdicts.length > 0
    ? `protocol: ${pass} PASS / ${fail} FAIL / ${skip} SKIP`
    : 'protocol: none'
  return `${pesText} | ${protocolText}`
}

/**
 * POST /v1/protocol/run, then read and summarize the report.
 * @param sidecarUrl - hive sidecar base URL.
 * @param mode - live model traffic or recorded mock conversations.
 * @param maxConvs - conversation cap handed to the runner.
 * @param timeoutMs - request budget before the fetch aborts.
 * @returns launch outcome with the run directory and pid when accepted.
 */
export async function runBench(
  sidecarUrl: string,
  mode: 'live' | 'mock',
  maxConvs: number,
  timeoutMs: number,
): Promise<{ ok: boolean; text: string; runDir?: string; pid?: number }> {
  const base = sidecarUrl.replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort(new Error('sidecar request timed out')) }, timeoutMs)
  try {
    const launch = await fetch(`${base}/v1/protocol/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, args: { max_convs: maxConvs, protocol: true, checkpoint_every: 5 } }),
      signal: controller.signal,
    })
    if (!launch.ok) {
      return { ok: false, text: `Sidecar rejected the run: HTTP ${launch.status}` }
    }
    const launched = await launch.json() as ProtocolRunResponse
    const runName = launched.run_dir.split(/[\\/]/).filter(Boolean).at(-1) ?? 'run'
    // The report appears once the run finishes; try once now (in-flight runs
    // report "pending" and the user re-runs /bench to collect).
    let summary = ''
    try {
      const reportRes = await fetch(`${base}/v1/report/${encodeURIComponent(runName)}`, {
        signal: controller.signal,
      })
      if (reportRes.ok) {
        const report = await reportRes.json() as RunReportSummary
        summary = summarizeReport(report)
      }
    } catch {
      // Report not ready (or the in-flight run holds it) â€” keep the pending text.
    }
    const text = summary
      ? `${runName} (pid ${launched.pid}): ${summary}`
      : `${runName} launched (pid ${launched.pid}); report pending â€” re-run /bench later`
    return { ok: true, text, runDir: runName, pid: launched.pid }
  } catch {
    return { ok: false, text: `Sidecar unreachable at ${base}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Record the launch as a log-only session event.
 * @param session - session receiving the durable bench/run event.
 * @param event - launch outcome snapshot.
 */
export function recordBenchRun(
  session: Session,
  event: { mode: 'live' | 'mock'; runDir: string; pid: number; ok: boolean; summary?: string },
): void {
  session.append('bench/run', event)
}

/**
 * Register the `/bench` command for the lifetime of `ctx`.
 * @param ctx - plugin context; the command is disposed with it.
 * @param config - sidecar wiring.
 */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  ctx.commands.register({
    name: 'bench',
    description: 'launch a HiveBench protocol run through the sidecar and summarize its report',
    input: { hint: '[live|mock] [max-convs]' },
    recordInput: false,
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      const parsed = parseBenchInput(invocation.rawInput)
      if (parsed.collect !== undefined) {
        const collected = await collectReport(config.sidecarUrl ?? DEFAULT_SIDECAR_URL, parsed.collect, config.timeoutMs ?? 15_000)
        return collected.ok
          ? { kind: 'success', text: collected.text }
          : { kind: 'error', text: `${collected.text}\n${USAGE}` }
      }
      const result = await runBench(config.sidecarUrl ?? DEFAULT_SIDECAR_URL, parsed.mode, parsed.maxConvs, config.timeoutMs ?? 15_000)
      recordBenchRun(invocation.agent.session, {
        mode: parsed.mode,
        runDir: result.runDir ?? 'unknown',
        pid: result.pid ?? -1,
        ok: result.ok,
        summary: result.text,
      })
      return result.ok
        ? { kind: 'success', text: result.text }
        : { kind: 'error', text: `${result.text}\n${USAGE}` }
    },
  })
}
