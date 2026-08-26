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

/** Pass/fail outcome of one bench task executed under one preset. */
export interface TaskScore {
  /** Stable task identifier from the evaluation task list. */
  taskId: string
  /** Terminal verdict of the task under this preset. */
  passed: boolean
}

/** One complete evaluation run: a task list executed under one preset label. */
export interface EvalRun {
  /** Preset id the tasks ran under; `baseline`/`candidate` are conventions, not enforced roles. */
  label: string
  /** Unix epoch ms of the run. */
  generatedAt: number
  /** Run-level PES when the executor's scorer reports one (mirrors the sidecar's `post_run_pes.pes`). */
  pes?: number
  tasks: TaskScore[]
}

/** Explicit acceptance thresholds applied when comparing a candidate against a baseline. */
export interface EvalThresholds {
  /** Candidate PES may not fall more than this below the baseline PES. */
  maxPesDrop: number
  /** Tolerated *net* new task failures (regressions minus gains) before the comparison regresses. */
  allowNewFailures?: number
}

/** One per-task pass→fail or fail→pass flip between two runs. */
export interface TaskFlip {
  taskId: string
  from: boolean
  to: boolean
}

/** Verdict of comparing one candidate run against one baseline run. */
export interface EvalComparison {
  baselineLabel: string
  candidateLabel: string
  baselinePassRate: number
  candidatePassRate: number
  baselinePes: number | null
  candidatePes: number | null
  /** `candidate - baseline` PES delta; `null` when either side lacks a PES. */
  pesDelta: number | null
  /** Tasks that passed under baseline and fail under candidate. */
  regressions: TaskFlip[]
  /** Tasks that failed under baseline and pass under candidate. */
  gains: TaskFlip[]
  /** Baseline tasks the candidate run never executed; always a regression. */
  missingTasks: string[]
  /** Candidate tasks absent from the baseline run; reported, never penalized. */
  extraTasks: string[]
  /** `true` when every threshold holds and the candidate run is complete. */
  ok: boolean
  /** Human-readable regression causes; empty exactly when `ok`. */
  reasons: string[]
}
