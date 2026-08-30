import { describe, it, expect } from 'vitest'
import { isReclaimed, detectLeak, leakReport } from '../src/monitor.ts'

describe('reclaim', () => {
  it('isReclaimed within tolerance', () => {
    const before = { vramMb: 1000, ramMb: 2000, timestamp: 1 }
    const after = { vramMb: 1020, ramMb: 2050, timestamp: 2 }
    expect(isReclaimed(before, after)).toBe(true)
    expect(isReclaimed(before, { vramMb: 2000, ramMb: 2000, timestamp: 2 })).toBe(false)
  })

  it('detectLeak monotonic', () => {
    const h = [
      { vramMb: 1000, ramMb: 2000, timestamp: 1 },
      { vramMb: 1100, ramMb: 2100, timestamp: 2 },
      { vramMb: 1200, ramMb: 2200, timestamp: 3 },
    ]
    expect(detectLeak(h)).toBe(true)
    const ok = [
      { vramMb: 1000, ramMb: 2000, timestamp: 1 },
      { vramMb: 1010, ramMb: 2010, timestamp: 2 },
    ]
    expect(detectLeak(ok)).toBe(false)
  })

  it('leakReport', () => {
    const r = leakReport(1, { vramMb: 1000, ramMb: 2000, timestamp: 1 }, { vramMb: 1000, ramMb: 2000, timestamp: 2 })
    expect(r).toContain('ok')
    const r2 = leakReport(2, { vramMb: 1000, ramMb: 2000, timestamp: 1 }, { vramMb: 2000, ramMb: 3000, timestamp: 2 })
    expect(r2).toContain('LEAK')
  })
})
