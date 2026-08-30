import { describe, it, expect } from 'vitest'
import { buildRocmService, healthUrl, describeDockerFailure, CONTAINER_MODEL_PATH } from '../src/docker.ts'

describe('docker', () => {
  it('builds rocm service', () => {
    const svc = buildRocmService('/mnt/dsh_storage/models', CONTAINER_MODEL_PATH)
    expect(svc.image).toBe('custom-dsh-rocm-backend:latest')
    expect(svc.devices).toContain('/dev/kfd:/dev/kfd')
    expect((svc.environment as string[]).join(' ')).toContain('HSA_OVERRIDE_GFX_VERSION=11.0.0')
  })

  it('health url', () => {
    expect(healthUrl(8000)).toBe('http://127.0.0.1:8000/health')
    expect(healthUrl(8765)).toContain('8765')
  })

  it('describes docker failures', () => {
    expect(describeDockerFailure('not-running')).toContain('Docker not running')
    expect(describeDockerFailure('rocm-missing')).toContain('ROCm')
    expect(describeDockerFailure('port-in-use', '8000')).toContain('port in use')
    expect(describeDockerFailure('image-missing')).toContain('image missing')
  })
})
