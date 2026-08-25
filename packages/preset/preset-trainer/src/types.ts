/**
 * Preset trainer evidence vocabulary: the per-preset report shape the
 * evidence pass emits. Everything is derived from durable session logs, so
 * replaying a log rebuilds identical numbers.
 * @module types
 */

/** Outcome stats for one tool name within a preset. */
export interface ToolEvidence {
  /** Model-facing tool name. */
  name: string
  /** Calls that settled with a non-error result. */
  ok: number
  /** Calls that settled with an error result. */
  errors: number
  /** Calls whose result never arrived before the turn ended. */
  unsettled: number
  /** Error-code histogram over `errors` (`error.code`, else `"isError"`). */
  byCode: Record<string, number>
}

/** Failure-mode counters for one preset. */
export interface FailureModes {
  /** Turns that ended with reason kind `error`. */
  modelErrors: number
  /** Provider retries recorded by `llm/retry` events. */
  retries: number
  /** Tool results carrying the structured `TOOL_TIMEOUT` code. */
  toolTimeouts: number
  /** Histogram over every classified failure code seen (tool and provider). */
  byCode: Record<string, number>
}

/** Evidence mined from every session attributed to one agent preset. */
export interface PresetEvidence {
  /** Resolved preset id; `(none)` when a session never declared one. */
  preset: string
  /** Number of sessions folded into this entry. */
  sessions: number
  /** Turns observed across those sessions. */
  turns: number
  /** Successful call→result pairs, the traces worth training on. */
  successfulTraces: number
  /** Per-tool outcome stats for tools that were called at least once. */
  tools: Record<string, ToolEvidence>
  /**
   * Tools present in the session's final assembled catalog but never called:
   * candidates for removal or for prompt guidance.
   */
  unusedTools: string[]
  failures: FailureModes
}

/** The complete evidence-pass artifact. */
export interface EvidenceReport {
  /** Unix epoch ms of generation. */
  generatedAt: number
  presets: PresetEvidence[]
}
