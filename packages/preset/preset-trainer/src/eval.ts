/**
 * Evaluation scoring core for the preset trainer: summarize one evaluation
 * run and compare a candidate against a baseline under explicit thresholds.
 * Pure folds over plain results — execution, scoring sources, and job
 * orchestration live behind the callers that produce {@link EvalRun}s.
 * @module
 */

import type { EvalComparison, EvalRun, EvalThresholds, TaskFlip } from './types.ts'

/**
 * Summarize one run's headline numbers.
 * @param run - the executed run to summarize.
 * @returns pass rate over executed tasks (0 for an empty run) and the run-level PES when present.
 */
export function summarizeEvalRun(run: EvalRun): { passRate: number; pes: number | null } {
  const total = run.tasks.length
  const passed = run.tasks.filter(task => task.passed).length
  return { passRate: total === 0 ? 0 : passed / total, pes: run.pes ?? null }
}

/**
 * Compare one candidate run against one baseline run under explicit thresholds.
 *
 * Verdict rules, all required for `ok`: the candidate executed every baseline
 * task; net new failures (regressions minus gains) stay within
 * `allowNewFailures`; and the PES drop stays within `maxPesDrop`. A side
 * without a PES skips only that rule. Extra candidate tasks are reported,
 * never penalized. Duplicate task ids within either run throw — a run that
 * executed one task twice is a broken artifact, not comparable data.
 *
 * @param baseline - the reference run.
 * @param candidate - the run under evaluation.
 * @param thresholds - explicit acceptance bounds; nothing here defaults silently.
 * @returns the full comparison: numbers, flips, completeness findings, and verdict reasons.
 * @throws when either run contains duplicate task ids.
 */
export function compareRuns(baseline: EvalRun, candidate: EvalRun, thresholds: EvalThresholds): EvalComparison {
  const base = indexedTasks(baseline)
  const cand = indexedTasks(candidate)
  const baselinePassRate = passRate(baseline)
  const candidatePassRate = passRate(candidate)

  const regressions: TaskFlip[] = []
  const gains: TaskFlip[] = []
  for (const [taskId, basePassed] of base) {
    const candidatePassed = cand.get(taskId)
    if (candidatePassed === undefined || candidatePassed === basePassed) continue
    const flip = { taskId, from: basePassed, to: candidatePassed }
    if (basePassed) regressions.push(flip)
    else gains.push(flip)
  }

  const missingTasks = [...base.keys()].filter(taskId => !cand.has(taskId))
  const extraTasks = [...cand.keys()].filter(taskId => !base.has(taskId))

  const baselinePes = baseline.pes ?? null
  const candidatePes = candidate.pes ?? null
  const pesDelta = baselinePes !== null && candidatePes !== null ? candidatePes - baselinePes : null

  const netNewFailures = regressions.length - gains.length
  const allowedNewFailures = thresholds.allowNewFailures ?? 0

  const reasons: string[] = []
  if (missingTasks.length > 0) {
    reasons.push(`candidate did not execute ${missingTasks.length} baseline task(s): ${missingTasks.join(', ')}`)
  }
  if (netNewFailures > allowedNewFailures) {
    reasons.push(`net new failures ${netNewFailures} exceed allowance ${allowedNewFailures} (${regressions.length} regression(s), ${gains.length} gain(s))`)
  }
  if (pesDelta !== null && pesDelta < -thresholds.maxPesDrop) {
    reasons.push(`PES dropped ${formatDelta(-pesDelta)} beyond allowance ${thresholds.maxPesDrop} (${baselinePes} -> ${candidatePes})`)
  }

  return {
    baselineLabel: baseline.label,
    candidateLabel: candidate.label,
    baselinePassRate,
    candidatePassRate,
    baselinePes,
    candidatePes,
    pesDelta,
    regressions,
    gains,
    missingTasks,
    extraTasks,
    ok: reasons.length === 0,
    reasons,
  }
}

function indexedTasks(run: EvalRun): Map<string, boolean> {
  const index = new Map<string, boolean>()
  for (const task of run.tasks) {
    if (index.has(task.taskId)) {
      throw new Error(`preset-trainer: run "${run.label}" lists task "${task.taskId}" twice; runs must execute each task once`)
    }
    index.set(task.taskId, task.passed)
  }
  return index
}

function passRate(run: EvalRun): number {
  if (run.tasks.length === 0) return 0
  return run.tasks.filter(task => task.passed).length / run.tasks.length
}

function formatDelta(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
