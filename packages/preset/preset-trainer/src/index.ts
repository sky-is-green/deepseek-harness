/**
 * Preset trainer evidence and evaluation passes: pure folds plus runners
 * that turn durable logs into per-preset training evidence and scored
 * candidate/baseline comparisons.
 *
 * @module @deepseek-ai/dsh-preset-trainer
 */

export { collectEvidence, NO_PRESET } from './evidence.ts'
export { compareRuns, summarizeEvalRun } from './eval.ts'
export { mineEvidence } from './mine.ts'
export type {
  EvalComparison, EvalRun, EvalThresholds, EvidenceReport, FailureModes, PresetEvidence, TaskFlip, TaskScore,
} from './types.ts'
