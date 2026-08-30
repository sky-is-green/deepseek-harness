import { describe, it, expect } from 'vitest'
import { calculateHardwareAllocation, isDiskFull, shouldBlockLoad } from '../src/estimator.ts'

describe('estimator', () => {
  it('single GPU 32k fits without disk', () => {
    const r = calculateHardwareAllocation(32_768, false)
    expect(r.metrics.tier3NvmeGb).toBeGreaterThan(0) // weights spill
    expect(r.flags.ioLatencyWarning).toBe(true)
    expect(r.flags.diskFull).toBe(false)
    expect(r.flags.recommendCap).toBe(32_768)
    expect(shouldBlockLoad(r)).toBe(false)
  })

  it('single GPU 128k io warning flips', () => {
    const small = calculateHardwareAllocation(32_768, false)
    const large = calculateHardwareAllocation(128_000, false)
    expect(small.flags.ioLatencyWarning).toBe(true)
    expect(large.flags.ioLatencyWarning).toBe(true)
    expect(large.metrics.totalFootprintGb).toBeGreaterThan(small.metrics.totalFootprintGb)
  })

  it('1M on single 20GB spills heavily to NVMe', () => {
    const r = calculateHardwareAllocation(1_000_000, false)
    expect(r.metrics.tier3NvmeGb).toBeGreaterThan(100)
    expect(r.flags.ioLatencyWarning).toBe(true)
  })

  it('dual GPU has larger VRAM and higher cap', () => {
    const single = calculateHardwareAllocation(32_768, false)
    const dual = calculateHardwareAllocation(32_768, true)
    expect(dual.metrics.tier1VramGb).toBe(40)
    expect(single.metrics.tier1VramGb).toBe(20)
    expect(dual.flags.recommendCap).toBe(131_072)
  })

  it('disk full blocks load', () => {
    const r = calculateHardwareAllocation(32_768, false, { nvmeCapacityGb: 100, nvmeUsedGb: 90 })
    expect(r.flags.diskFull).toBe(true)
    expect(isDiskFull(r.metrics.tier3NvmeGb, 100, 90)).toBe(true)
    expect(shouldBlockLoad(r)).toBe(true)
  })

  it('isDiskFull helper', () => {
    expect(isDiskFull(10, 100, 0)).toBe(false)
    expect(isDiskFull(85, 100, 0)).toBe(true)
    expect(isDiskFull(10, 100, 75)).toBe(true)
  })
})
