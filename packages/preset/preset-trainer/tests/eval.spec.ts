import { describe, expect, it } from 'vitest'
import { compareRuns, summarizeEvalRun } from '@deepseek-ai/dsh-preset-trainer'
import type { EvalRun } from '@deepseek-ai/dsh-preset-trainer'

function run(label: string, pes: number | undefined, tasks: Record<string, boolean>): EvalRun {
  return {
    label,
    generatedAt: 1_700_000_000_000,
    ...(pes !== undefined && { pes }),
    tasks: Object.entries(tasks).map(([taskId, passed]) => ({ taskId, passed })),
  }
}

const BASELINE = run('baseline', 0.82, { t1: true, t2: true, t3: false, t4: true })
const THRESHOLDS = { maxPesDrop: 0.05 }

describe('summarizeEvalRun', () => {
  it('computes pass rate and surfaces the run-level PES', () => {
    expect(summarizeEvalRun(BASELINE)).toEqual({ passRate: 3 / 4, pes: 0.82 })
  })

  it('returns a zero rate for an empty run and null PES when absent', () => {
    expect(summarizeEvalRun(run('empty', undefined, {}))).toEqual({ passRate: 0, pes: null })
  })
})

describe('compareRuns', () => {
  it('passes an identical candidate with zero deltas and no findings', () => {
    const comparison = compareRuns(BASELINE, run('candidate', 0.82, { t1: true, t2: true, t3: false, t4: true }), THRESHOLDS)
    expect(comparison.ok).toBe(true)
    expect(comparison.reasons).toEqual([])
    expect(comparison.regressions).toEqual([])
    expect(comparison.gains).toEqual([])
    expect(comparison.pesDelta).toBe(0)
  })

  it('fails when the PES drop exceeds the allowance and names the numbers', () => {
    const comparison = compareRuns(BASELINE, run('candidate', 0.70, { t1: true, t2: true, t3: false, t4: true }), THRESHOLDS)
    expect(comparison.ok).toBe(false)
    expect(comparison.pesDelta).toBeCloseTo(-0.12)
    expect(comparison.reasons.join(' ')).toMatch(/PES dropped 0\.12.*allowance 0\.05.*0\.82 -> 0\.7/)
  })

  it('tolerates a PES drop inside the allowance', () => {
    const comparison = compareRuns(BASELINE, run('candidate', 0.78, { t1: true, t2: true, t3: false, t4: true }), { maxPesDrop: 0.05 })
    expect(comparison.ok).toBe(true)
  })

  it('skips only the PES rule when a side has no PES', () => {
    const comparison = compareRuns(
      run('baseline', undefined, { t1: true }),
      run('candidate', 0.5, { t1: true }),
      THRESHOLDS,
    )
    expect(comparison.ok).toBe(true)
    expect(comparison.pesDelta).toBeNull()
    expect(comparison.baselinePes).toBeNull()
    expect(comparison.candidatePes).toBe(0.5)
  })

  it('counts net new failures against the default zero allowance', () => {
    const comparison = compareRuns(BASELINE, run('candidate', 0.82, { t1: true, t2: false, t3: false, t4: true }), THRESHOLDS)
    expect(comparison.ok).toBe(false)
    expect(comparison.regressions).toEqual([{ taskId: 't2', from: true, to: false }])
    expect(comparison.gains).toEqual([])
    expect(comparison.reasons.join(' ')).toMatch(/net new failures 1 exceed allowance 0/)
  })

  it('nets gains against regressions before judging the failure allowance', () => {
    const candidate = run('candidate', 0.82, { t1: true, t2: false, t3: true, t4: true })
    expect(compareRuns(BASELINE, candidate, THRESHOLDS).ok).toBe(true)
    expect(compareRuns(BASELINE, candidate, { maxPesDrop: 0.05, allowNewFailures: 1 }).ok).toBe(true)
  })

  it('honors an explicit nonzero failure allowance', () => {
    const candidate = run('candidate', 0.82, { t1: false, t2: true, t3: false, t4: true })
    expect(compareRuns(BASELINE, candidate, { maxPesDrop: 0.05 }).ok).toBe(false)
    expect(compareRuns(BASELINE, candidate, { maxPesDrop: 0.05, allowNewFailures: 1 }).ok).toBe(true)
  })

  it('fails loud when the candidate skipped baseline tasks', () => {
    const comparison = compareRuns(BASELINE, run('candidate', 0.9, { t1: true, t2: true }), THRESHOLDS)
    expect(comparison.ok).toBe(false)
    expect(comparison.missingTasks).toEqual(['t3', 't4'])
    expect(comparison.reasons.join(' ')).toMatch(/did not execute 2 baseline task\(s\): t3, t4/)
  })

  it('reports extra candidate tasks without penalizing them', () => {
    const comparison = compareRuns(BASELINE, run('candidate', 0.82, { t1: true, t2: true, t3: false, t4: true, t5: true }), THRESHOLDS)
    expect(comparison.ok).toBe(true)
    expect(comparison.extraTasks).toEqual(['t5'])
  })

  it('throws on duplicate task ids inside either run', () => {
    const duplicated = run('candidate', 0.5, {})
    duplicated.tasks.push({ taskId: 't1', passed: true }, { taskId: 't1', passed: false })
    expect(() => compareRuns(BASELINE, duplicated, THRESHOLDS)).toThrow(/lists task "t1" twice/)
    expect(() => compareRuns(duplicated, BASELINE, THRESHOLDS)).toThrow(/run "candidate" lists task "t1" twice/)
  })
})
