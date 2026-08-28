import { describe, expect, it } from 'vitest'
import { estimateFit, formatGigabytes } from '../src/fit.ts'
import type { HardwareSummary } from '@deepseek-ai/dsh-models'

const GiB = 1024 * 1024 * 1024

function hw(devices: HardwareSummary['devices'], totalRamBytes: number): HardwareSummary {
  return { devices, totalRamBytes }
}

describe('fit estimator', () => {
  it('formats gigabytes with one decimal', () => {
    expect(formatGigabytes(0)).toBe('0.0 GB')
    expect(formatGigabytes(GiB)).toBe('1.0 GB')
    expect(formatGigabytes(4 * GiB)).toBe('4.0 GB')
    expect(formatGigabytes(6.2 * GiB)).toBe('6.2 GB')
    expect(formatGigabytes(1.55 * GiB)).toBe('1.6 GB')
  })

  it('returns null when hardware is null', () => {
    expect(estimateFit(4 * GiB, null)).toBeNull()
    expect(estimateFit(4 * GiB, undefined)).toBeNull()
  })

  it('returns null for non-finite or negative sizes', () => {
    const h = hw([], 8 * GiB)
    expect(estimateFit(NaN, h)).toBeNull()
    expect(estimateFit(-1, h)).toBeNull()
  })

  it('returns null when hardware reports no usable memory', () => {
    expect(estimateFit(1 * GiB, hw([], 0))).toBeNull()
  })

  it('uses system RAM when no device reports memory', () => {
    const est = estimateFit(4 * GiB, hw([], 8 * GiB))!
    expect(est.availableBytes).toBe(8 * GiB)
    expect(est.device).toBeUndefined()
    expect(est.fits).toBe(true)
    expect(est.needsLabel).toBe('4.0 GB')
    expect(est.availableLabel).toBe('8.0 GB')
    expect(est.ratio).toBeCloseTo(0.5)
  })

  it('picks the largest device memory when multiple devices report', () => {
    const est = estimateFit(4 * GiB, hw([
      { backend: 'cuda', name: 'RTX 3060', memoryBytes: 12 * GiB },
      { backend: 'vulkan', name: 'iGPU' },
      { backend: 'cuda', name: 'RTX 4090', memoryBytes: 24 * GiB },
    ], 32 * GiB))!
    expect(est.availableBytes).toBe(24 * GiB)
    expect(est.device?.name).toBe('RTX 4090')
    expect(est.fits).toBe(true)
  })

  it('prefers device memory over system RAM (unified memory case)', () => {
    const est = estimateFit(6.2 * GiB, hw([
      { backend: 'metal', name: 'Apple Silicon (unified memory)', memoryBytes: 16 * GiB },
    ], 16 * GiB))!
    expect(est.availableBytes).toBe(16 * GiB)
    expect(est.device?.backend).toBe('metal')
    expect(est.fits).toBe(true)
  })

  it('reports too-large when file exceeds budget', () => {
    const est = estimateFit(16 * GiB, hw([], 8 * GiB))!
    expect(est.fits).toBe(false)
    expect(est.ratio).toBe(2)
    expect(est.needsLabel).toBe('16.0 GB')
    expect(est.availableLabel).toBe('8.0 GB')
  })

  it('boundary: equality fits', () => {
    const est = estimateFit(8 * GiB, hw([], 8 * GiB))!
    expect(est.fits).toBe(true)
  })

  it('zero-byte model fits any positive budget', () => {
    const est = estimateFit(0, hw([], 8 * GiB))!
    expect(est.fits).toBe(true)
    expect(est.needsLabel).toBe('0.0 GB')
  })
})
