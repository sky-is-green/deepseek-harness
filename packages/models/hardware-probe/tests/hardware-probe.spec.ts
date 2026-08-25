import { describe, expect, it } from 'vitest'
import { parseNvidiaSmiRow, parseVulkanInfo, probeHardware } from '@deepseek-ai/dsh-hardware-probe'
import type { ProbeEnvironment } from '@deepseek-ai/dsh-hardware-probe'

const GIB = 1024 * 1024 * 1024

function fakeEnvironment(overrides: Partial<ProbeEnvironment> = {}): ProbeEnvironment {
  return {
    platform: 'linux',
    arch: 'x64',
    totalMemBytes: 32 * GIB,
    cpuModel: 'Test CPU 9000',
    which: () => Promise.resolve(null),
    run: () => Promise.reject(new Error('no commands scripted')),
    ...overrides,
  }
}

describe('hardware probe', () => {
  it('parses nvidia-smi rows including quoted names with commas and rejects malformed rows', () => {
    expect(parseNvidiaSmiRow('NVIDIA GeForce RTX 4090, 24564')).toEqual({
      name: 'NVIDIA GeForce RTX 4090',
      memoryBytes: 24564 * 1024 * 1024,
    })
    expect(parseNvidiaSmiRow('"GPU with, comma", 8192')).toEqual({
      name: 'GPU with, comma',
      memoryBytes: 8192 * 1024 * 1024,
    })
    expect(parseNvidiaSmiRow('')).toBeNull()
    expect(parseNvidiaSmiRow('no-memory-field')).toBeNull()
    expect(parseNvidiaSmiRow('Some GPU, not-a-number')).toBeNull()
    expect(parseNvidiaSmiRow('Some GPU, 0')).toBeNull()
  })

  it('parses vulkaninfo summary devices with their integration flag', () => {
    const output = [
      'Devices:',
      '--------',
      'GPU0:',
      '    deviceName        = AMD Radeon RX 7900 XT',
      '    deviceType        = DISCRETE_GPU',
      '    driverName        = radv',
      'GPU1:',
      '    deviceName        = AMD Ryzen iGPU',
      '    deviceType        = INTEGRATED_GPU',
    ].join('\n')
    expect(parseVulkanInfo(output)).toEqual([
      { name: 'AMD Radeon RX 7900 XT', integrated: false },
      { name: 'AMD Ryzen iGPU', integrated: true },
    ])
    expect(parseVulkanInfo('nothing here')).toEqual([])
  })

  it('reports NVIDIA devices when nvidia-smi answers', async () => {
    const summary = await probeHardware({
      environment: fakeEnvironment({
        which: file => Promise.resolve(file === 'nvidia-smi' ? '/usr/bin/nvidia-smi' : null),
        run: (command) => {
          expect(command.args).toContain('--query-gpu=name,memory.total')
          return Promise.resolve('NVIDIA GeForce RTX 4090, 24564\r\n"NVIDIA, Quadro", 8192\r\n')
        },
      }),
    })
    expect(summary.devices).toEqual([
      { backend: 'cuda', name: 'NVIDIA GeForce RTX 4090', memoryBytes: 24564 * 1024 * 1024 },
      { backend: 'cuda', name: 'NVIDIA, Quadro', memoryBytes: 8192 * 1024 * 1024 },
    ])
    expect(summary.totalRamBytes).toBe(32 * GIB)
  })

  it('skips a failing or absent detector instead of failing hardware()', async () => {
    const absent = await probeHardware({ environment: fakeEnvironment() })
    expect(absent.devices).toEqual([{ backend: 'cpu', name: 'Test CPU 9000' }])

    const failing = await probeHardware({
      environment: fakeEnvironment({
        which: file => Promise.resolve(`/usr/bin/${file}`),
        run: () => Promise.reject(new Error('driver crashed')),
      }),
    })
    expect(failing.devices).toEqual([{ backend: 'cpu', name: 'Test CPU 9000' }])
  })

  it('reports Apple silicon as one unified-memory Metal device ahead of others', async () => {
    const summary = await probeHardware({
      environment: fakeEnvironment({
        platform: 'darwin',
        arch: 'arm64',
        totalMemBytes: 36 * GIB,
        which: file => Promise.resolve(file === 'vulkaninfo' ? '/opt/homebrew/bin/vulkaninfo' : null),
        run: () => Promise.resolve('GPU0:\n    deviceName        = Apple M3 Max\n    deviceType        = DISCRETE_GPU\n'),
      }),
    })
    expect(summary.devices[0]).toEqual({
      backend: 'metal',
      name: 'Apple Silicon (unified memory)',
      memoryBytes: 36 * GIB,
    })
    expect(summary.devices[1]).toEqual({ backend: 'vulkan', name: 'Apple M3 Max' })
  })

  it('falls back to a bare cpu entry when the host exposes no CPU model', async () => {
    const { cpuModel: _omitted, ...withoutCpuModel } = fakeEnvironment()
    const summary = await probeHardware({ environment: withoutCpuModel })
    expect(summary.devices).toEqual([{ backend: 'cpu' }])
  })

  it('always reports total RAM from its environment', async () => {
    const summary = await probeHardware({ environment: fakeEnvironment() })
    expect(summary.totalRamBytes).toBe(32 * GIB)
  })
})
