import { describe, expect, it } from 'vitest'
import {
  buildSparklinePath,
  normalizeHistory,
  pesOfReport,
  toHistoryPoint,
  tokPerSecOfReport,
} from '../src/history.ts'

describe('dsh-bench history helpers', () => {
  it('pesOfReport accepts composite and pes shapes', () => {
    expect(pesOfReport({ post_run_pes: { composite: 42 } })).toBe(42)
    expect(pesOfReport({ post_run_pes: { pes: 7 } })).toBe(7)
    expect(pesOfReport({ post_run_pes: null })).toBe(0)
    expect(pesOfReport({})).toBe(0)
  })

  it('tokPerSecOfReport accepts legacy keys', () => {
    expect(tokPerSecOfReport({ performance: { tokPerSec: 12.5 } })).toBe(12.5)
    expect(tokPerSecOfReport({ performance: { tok_per_sec: 9 } })).toBe(9)
    expect(tokPerSecOfReport({ performance: { throughput: 3 } })).toBe(3)
    expect(tokPerSecOfReport({ metrics: { tokPerSec: 4 } })).toBe(4)
    expect(tokPerSecOfReport({})).toBe(0)
  })

  it('toHistoryPoint builds a point with timestamp', () => {
    const p = toHistoryPoint({ post_run_pes: { pes: 80 }, performance: { tokPerSec: 15 } }, 'protocol_1', 1234)
    expect(p).toEqual({ pes: 80, tokPerSec: 15, runName: 'protocol_1', timestamp: 1234 })
  })

  it('normalizeHistory sorts and caps', () => {
    const pts = [
      { pes: 1, tokPerSec: 1, runName: 'b', timestamp: 2 },
      { pes: 1, tokPerSec: 1, runName: 'a', timestamp: 1 },
      { pes: 1, tokPerSec: 1, runName: 'c', timestamp: 3 },
    ]
    expect(normalizeHistory(pts, 2).map(p => p.runName)).toEqual(['b', 'c'])
  })

  it('buildSparklinePath handles empty, single, and multi-point', () => {
    expect(buildSparklinePath([], 100, 20)).toBe('')
    expect(buildSparklinePath([5], 100, 20)).toBe('M0,10.00 L100.00,10.00')
    const path = buildSparklinePath([0, 10, 5], 60, 20)
    expect(path).toMatch(/^M/)
    expect(path).toContain('L')
    // flat series should be horizontal middle line
    expect(buildSparklinePath([7, 7, 7], 60, 20)).toBe('M0.00,20.00 L30.00,20.00 L60.00,20.00')
  })

  it('buildSparklinePath maps min to bottom and max to top', () => {
    const path = buildSparklinePath([0, 100], 10, 10)
    // 0 -> y=10, 100 -> y=0
    expect(path).toBe('M0.00,10.00 L10.00,0.00')
  })
})
