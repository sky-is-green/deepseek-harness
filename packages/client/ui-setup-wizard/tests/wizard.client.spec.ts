// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { validateEngine, buildHealthSnapshot, isSetupComplete, describeDriveFailure, DEFAULT_STATE, calculateTier, buildWizardStatus } from '../src/client/wizard.ts'

describe('wizard', () => {
  it('validateEngine', () => {
    expect(validateEngine('windows-vulkan')).toBe('windows-vulkan')
    expect(validateEngine('linux-rocm-docker')).toBe('linux-rocm-docker')
    expect(() => validateEngine('vllm')).toThrow(/invalid engine/)
  })

  it('buildHealthSnapshot', () => {
    const s = buildHealthSnapshot({ state: 'running', port: 8765 }, { state: 'stopped', port: 8000, vhdxMounted: false, dockerRunning: false })
    expect(s.windows.port).toBe(8765)
    expect(s.linux.vhdxMounted).toBe(false)
  })

  it('isSetupComplete', () => {
    expect(isSetupComplete(DEFAULT_STATE)).toBe(true)
    expect(isSetupComplete({ ...DEFAULT_STATE, vhdxPath: '' })).toBe(false)
  })

  it('describeDriveFailure', () => {
    expect(describeDriveFailure('not-found')).toContain('VHDX not found')
    expect(describeDriveFailure('not-mounted')).toContain('not mounted')
  })

  it('calculateTier mirrors bench estimator', () => {
    const r = calculateTier(32_768, false)
    expect(r.metrics.tier1VramGb).toBe(20)
    expect(r.flags.recommendCap).toBe(32_768)
    expect(r.flags.ioLatencyWarning).toBe(true)
    const dual = calculateTier(32_768, true)
    expect(dual.metrics.tier1VramGb).toBe(40)
    expect(dual.flags.recommendCap).toBe(131_072)
  })

  it('buildWizardStatus links all', () => {
    const health = buildHealthSnapshot({ state: 'running', port: 8765 }, { state: 'running', port: 8000, vhdxMounted: true, dockerRunning: true })
    const status = buildWizardStatus(DEFAULT_STATE, health, 32_768, false)
    expect(status.complete).toBe(true)
    expect(status.health.linux.vhdxMounted).toBe(true)
    expect(status.tier.metrics.totalFootprintGb).toBeGreaterThan(100)
  })
})
