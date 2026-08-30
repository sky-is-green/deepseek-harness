// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { validateEngine, buildHealthSnapshot, isSetupComplete, describeDriveFailure, DEFAULT_STATE } from '../src/client/wizard.ts'

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
})
