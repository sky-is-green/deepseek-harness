import { describe, it, expect } from 'vitest'
import { failedStatus, portForEngine } from '../src/lifecycle.ts'

describe('lifecycle', () => {
  it('failedStatus is loud with fix', () => {
    const s = failedStatus('linux-rocm-docker', 'vhdx-not-mounted', '/mnt/dsh_storage')
    expect(s.state).toBe('failed')
    expect(s.detail).toContain('VHDX not mounted')
    expect(s.engine).toBe('linux-rocm-docker')
  })

  it('portForEngine', () => {
    expect(portForEngine('windows-vulkan')).toBe(8765)
    expect(portForEngine('linux-rocm-docker')).toBe(8000)
  })
})
