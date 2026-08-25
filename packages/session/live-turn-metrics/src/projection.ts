/**
 * The `liveTurnMetrics` projection unit: a pure fold of step boundaries,
 * token-delta chunks, and assembled assistant messages into the most recent
 * step's live TTFT and decode-throughput readout.
 *
 * The view tracks ONE step at a time — the currently streaming one, or the
 * last that assembled a message. While tokens stream, throughput is an
 * estimate (one unit per non-empty token delta, the same granularity most
 * providers stream at); the assembled message replaces it with provider-exact
 * figures when its usage record carries output tokens. A cancelled or failed
 * step closes via `step/end` without a message: the previous settled view
 * stays on screen rather than flashing away.
 *
 * @module @deepseek-ai/dsh-session-live-turn-metrics/projection
 */

import { z } from 'zod'
import { isTokenDelta } from '@deepseek-ai/dsh-llm/message'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { LiveTurnMetricsView } from './types.ts'

/** Fold state: the open step's boundary facts plus the published view. */
interface LiveTurnMetricsState {
  /** The streaming step's boundaries; null outside a step or once its message assembled. */
  open: {
    turn: number
    step: number
    startTime: number
    firstTokenTime: number | null
    /** Non-empty token deltas counted since the first token (the estimate's numerator). */
    deltaCount: number
    lastTokenTime: number | null
  } | null
  view: LiveTurnMetricsView | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    liveTurnMetrics: LiveTurnMetricsState
  }
}

const liveTurnMetricsSchema = z.object({
  phase: z.enum(['streaming', 'settled']),
  turn: z.number().int().nonnegative(),
  ttftMs: z.number().nonnegative().optional(),
  tokensPerSecond: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
}).strict()

/**
 * The fold state's shape (boundaries plus view), validated on persisted-cache
 * rows after their `ver` gate — the unit's input boundary.
 */
const liveTurnMetricsStateSchema = z.object({
  open: z.object({
    turn: z.number().int().nonnegative(),
    step: z.number().int().nonnegative(),
    startTime: z.number().nonnegative(),
    firstTokenTime: z.number().nonnegative().nullable(),
    deltaCount: z.number().int().nonnegative(),
    lastTokenTime: z.number().nonnegative().nullable(),
  }).nullable(),
  view: liveTurnMetricsSchema.nullable(),
}).strict()

/**
 * Provider-reported completion tokens, guarded the way the window fold guards
 * node usage.
 * @param usage - the assistant/message event's optional usage record.
 * @returns the output-token count, or null when unreported or invalid.
 */
function usageOutputTokens(usage: unknown): number | null {
  if (typeof usage !== 'object' || usage === null) return null
  const value = (usage as { outputTokens?: unknown }).outputTokens
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Throughput over a measured span; undefined while the span is still zero so
 * the readout never divides by zero on the first token.
 * @param units - counted token deltas (or provider output tokens).
 * @param spanMs - first-token → latest-token wall time, ms.
 * @returns tokens per second, or undefined before two timed points exist.
 */
function tokensPerSecond(units: number, spanMs: number): number | undefined {
  if (!(spanMs > 0)) return undefined
  return units / (spanMs / 1000)
}

/** The `liveTurnMetrics` unit registered on `ctx.sessionProjections` (exported for the unit spec). */
export const liveTurnMetricsProjectionDefinition = {
  key: 'liveTurnMetrics',
  stateVersion: 1,
  stateSchema: liveTurnMetricsStateSchema,
  init: () => ({ open: null, view: null }),
  apply: (state, event) => {
    // Every uninteresting event returns the same reference (Object.is gates the change feed).
    switch (event.type) {
      case 'step/start':
        // The previous settled view stays visible until the new step's first
        // token arrives, so the readout does not flash off between steps.
        return {
          ...state,
          open: {
            turn: event.data.turn,
            step: event.data.step,
            startTime: event.time,
            firstTokenTime: null,
            deltaCount: 0,
            lastTokenTime: null,
          },
        }
      case 'assistant/chunk': {
        const open = state.open
        if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return state
        if (!isTokenDelta(event.data.chunk)) return state
        const firstTokenTime = open.firstTokenTime ?? event.time
        const deltaCount = open.deltaCount + 1
        const ttftMs = Math.max(0, firstTokenTime - open.startTime)
        const streamingTps = tokensPerSecond(deltaCount - 1, Math.max(0, event.time - firstTokenTime))
        return {
          ...state,
          open: { ...open, firstTokenTime, deltaCount, lastTokenTime: event.time },
          view: {
            phase: 'streaming',
            turn: open.turn,
            ttftMs,
            ...(streamingTps === undefined ? {} : { tokensPerSecond: streamingTps }),
          },
        }
      }
      case 'assistant/message': {
        const open = state.open
        if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return state
        const settled: LiveTurnMetricsView = { phase: 'settled', turn: open.turn }
        if (open.firstTokenTime !== null) {
          settled.ttftMs = Math.max(0, open.firstTokenTime - open.startTime)
          const decodeSpanMs = Math.max(0, event.time - open.firstTokenTime)
          const outputTokens = usageOutputTokens(event.data.usage)
          const settledTps = outputTokens !== null ? tokensPerSecond(outputTokens, decodeSpanMs) : undefined
          if (settledTps !== undefined && outputTokens !== null) {
            settled.tokensPerSecond = settledTps
            settled.outputTokens = outputTokens
          } else if (open.lastTokenTime !== null) {
            // No usable provider report: freeze the estimate at the last delta.
            const estimate = tokensPerSecond(open.deltaCount - 1, Math.max(0, open.lastTokenTime - open.firstTokenTime))
            if (estimate !== undefined) settled.tokensPerSecond = estimate
          }
        }
        return { ...state, open: null, view: settled }
      }
      case 'step/end':
        if (state.open === null) return state
        // Cancelled/failed step: drop the boundaries, keep showing the last
        // settled figures instead of flashing the readout away.
        return { ...state, open: null }
      default:
        return state
    }
  },
  wire: {
    viewSchema: liveTurnMetricsSchema.nullable(),
    view: state => state.view,
  },
} satisfies ProjectionDefinition<'liveTurnMetrics', LiveTurnMetricsState>
