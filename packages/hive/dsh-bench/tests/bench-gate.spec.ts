import { describe, expect, it } from 'vitest'
import { evaluateGate, exitCodeFor, pesOf } from '@deepseek-ai/dsh-bench'

const baseline = { pes: 73.1, band: 'YELLOW' }

describe('bench PES gate', () => {
  it('extracts PES', () => {
    expect(pesOf({ post_run_pes: { pes: 73.1 } })).toBe(73.1)
    expect(pesOf({ post_run_pes: {} })).toBeUndefined()
    expect(pesOf({})).toBeUndefined()
  })

  it('passes when actual equals baseline', () => {
    const d = evaluateGate({ post_run_pes: { pes: 73.1 } }, baseline, 0)
    expect(d.regression).toBe(false)
    expect(d.delta).toBe(0)
    expect(d.text).toContain('ok')
    expect(exitCodeFor(d)).toBe(0)
  })

  it('passes when actual above baseline', () => {
    const d = evaluateGate({ post_run_pes: { pes: 74 } }, baseline, 0)
    expect(d.regression).toBe(false)
    expect(exitCodeFor(d)).toBe(0)
  })

  it('fails on any drop with threshold 0', () => {
    const d = evaluateGate({ post_run_pes: { pes: 72.9 } }, baseline, 0)
    expect(d.regression).toBe(true)
    expect(d.text).toContain('REGRESSION')
    expect(exitCodeFor(d)).toBe(1)
  })

  it('respects threshold: small drop within tolerance passes', () => {
    const d = evaluateGate({ post_run_pes: { pes: 72.8 } }, baseline, 0.5)
    expect(d.regression).toBe(false)
    expect(exitCodeFor(d)).toBe(0)
  })

  it('respects threshold: large drop beyond tolerance fails', () => {
    const d = evaluateGate({ post_run_pes: { pes: 72 } }, baseline, 0.5)
    expect(d.regression).toBe(true)
    expect(exitCodeFor(d)).toBe(1)
  })

  it('boundary at exactly threshold is not regression', () => {
    const d = evaluateGate({ post_run_pes: { pes: 72.6 } }, baseline, 0.5)
    // delta = -0.5, threshold 0.5 => delta < -0.5 is false
    expect(d.regression).toBe(false)
  })

  it('skips gate when report has no PES', () => {
    const d = evaluateGate({}, baseline, 0)
    expect(d.regression).toBe(false)
    expect(d.text).toContain('gate skipped')
    expect(exitCodeFor(d)).toBe(0)
  })

  it('skips gate when post_run_pes is missing pes', () => {
    const d = evaluateGate({ post_run_pes: {} }, baseline, 0)
    expect(d.regression).toBe(false)
  })
})
