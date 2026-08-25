/**
 * Preset trainer evidence pass: pure folds plus a session-query runner that
 * turn durable logs into per-preset training evidence.
 *
 * @module @deepseek-ai/dsh-preset-trainer
 */

export { collectEvidence, NO_PRESET } from './evidence.ts'
export { mineEvidence } from './mine.ts'
export type {
  EvidenceReport, FailureModes, PresetEvidence, ToolEvidence,
} from './types.ts'
