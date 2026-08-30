import { describe, it, expect } from 'vitest'
import { resolveEngine, describeEngineFailure, isLinuxEngine, DEFAULT_ENGINE } from '../src/selector.ts'

describe('engine-selector', () => {
  it('defaults to windows-vulkan when engine missing', () => {
    expect(resolveEngine({})).toBe('windows-vulkan')
    expect(resolveEngine({ engine: undefined })).toBe('windows-vulkan')
    expect(DEFAULT_ENGINE).toBe('windows-vulkan')
  })

  it('accepts both valid engines', () => {
    expect(resolveEngine({ engine: 'windows-vulkan' })).toBe('windows-vulkan')
    expect(resolveEngine({ engine: 'linux-rocm-docker' })).toBe('linux-rocm-docker')
  })

  it('throws loud for unsupported engine', () => {
    expect(() => resolveEngine({ engine: 'vllm' })).toThrow(/unsupported engine/)
    expect(() => resolveEngine({ engine: 'cuda' })).toThrow(/use windows-vulkan/)
    expect(() => resolveEngine(null)).toThrow(/must be an object/)
  })

  it('describeEngineFailure returns actionable fix', () => {
    expect(describeEngineFailure('linux-rocm-docker', 'vhdx-not-mounted', '/mnt/dsh_storage')).toContain('Mount_AI_Drive.bat')
    expect(describeEngineFailure('linux-rocm-docker', 'docker-not-running')).toContain('Docker')
    expect(describeEngineFailure('linux-rocm-docker', 'rocm-not-available')).toContain('/dev/kfd')
    expect(describeEngineFailure('windows-vulkan', 'model-not-found', 'E:\\models')).toContain('model not found')
    expect(describeEngineFailure('linux-rocm-docker', 'port-in-use', '8000')).toContain('port in use')
  })

  it('isLinuxEngine discriminates', () => {
    expect(isLinuxEngine('linux-rocm-docker')).toBe(true)
    expect(isLinuxEngine('windows-vulkan')).toBe(false)
  })
})
