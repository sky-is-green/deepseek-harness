/**
 * Pure types of the live-turn-metrics domain: the ONE home of the
 * `liveTurnMetrics` projection-key declaration, free of this package's
 * host-side value imports (cordis context, zod, the llm chunk predicate).
 * Two namespace projections serve it — `./types` for host consumers,
 * `./client` for client aggregates — with zero content duplication.
 *
 * @module @deepseek-ai/dsh-session-live-turn-metrics/types
 */

// Marks this file a module so the declaration below AUGMENTS the projection
// table instead of declaring an ambient module.
export {}

/** The readout's lifecycle phase within one assistant step. */
export type LiveTurnMetricsPhase =
  /** Tokens are arriving; figures update per streamed chunk. */
  | 'streaming'
  /** The step assembled its message; figures are provider-exact where reported. */
  | 'settled'

/**
 * The most recent assistant step's latency and decode-throughput readout,
 * updated live while its tokens stream. The view tracks exactly one step —
 * the currently streaming one, or the last one that assembled a message —
 * so a composer-beside renderer can show what the model is doing right now.
 */
export interface LiveTurnMetricsView {
  /** Whether the tracked step is still receiving tokens or has settled. */
  phase: LiveTurnMetricsPhase
  /** Turn of the tracked step. */
  turn: number
  /** `step/start` → first non-empty token delta, in ms; absent before the first token. */
  ttftMs?: number | undefined
  /**
   * Decode throughput in tokens/second. While `streaming`, an estimate: one
   * unit per non-empty token delta over first-token → latest-delta time.
   * Once `settled`, provider-reported output tokens over first-token →
   * message time when usage was reported, otherwise the same estimate frozen
   * at the last delta.
   */
  tokensPerSecond?: number | undefined
  /**
   * Provider-reported output tokens; present once `settled` and the
   * assembled message carried a valid usage record.
   */
  outputTokens?: number | undefined
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Live per-step tok/s and TTFT; null before the first tracked step. See {@link LiveTurnMetricsView}. */
    liveTurnMetrics: LiveTurnMetricsView | null
  }
}
