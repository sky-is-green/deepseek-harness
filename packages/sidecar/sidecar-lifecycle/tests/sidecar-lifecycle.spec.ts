import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSidecarArgv } from '@deepseek-ai/dsh-sidecar-lifecycle'
import { SidecarLifecycle } from '@deepseek-ai/dsh-sidecar-lifecycle'

function fakeCtx(subprocess: unknown) {
  return {
    subprocess,
    emit: vi.fn(),
    effect: (fn: () => () => void | Promise<void>, _name: string) => {
      const disposer = fn()
      return disposer as unknown as never
    },
    on: vi.fn(),
    reflect: { provide: vi.fn() },
  } as unknown as never
}

function fakeSubprocess() {
  return {
    spawn: vi.fn(() => ({
      pid: 1234,
      done: Promise.resolve(),
      terminate: vi.fn(),
    })),
  }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('sidecar lifecycle', () => {
  it('prefers frozen binary when it exists (existsSync mocked via actual file)', async () => {
    expect(resolveSidecarArgv({ port: 8765, pythonBin: 'python', startupTimeoutMs: 15000, healthPollMs: 250, extraArgs: [] })).toEqual([
      'python',
      '-m',
      'harness',
    ])
  })

  it('respects extraArgs in fallback', () => {
    expect(resolveSidecarArgv({ port: 8765, pythonBin: 'python', startupTimeoutMs: 15000, healthPollMs: 250, extraArgs: ['--log-level', 'debug'] })).toEqual([
      'python',
      '-m',
      'harness',
      '--log-level',
      'debug',
    ])
  })

  it('starts and stops via subprocess', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as unknown as Response))
    const subprocess = fakeSubprocess() as unknown as never
    const ctx = fakeCtx(subprocess)
    const svc = new SidecarLifecycle(ctx, {
      port: 8765,
      pythonBin: 'python',
      startupTimeoutMs: 200,
      healthPollMs: 20,
      extraArgs: [],
    })
    const started = await svc.start()
    expect(started.state).toBe('running')
    expect(svc.status().state).toBe('running')
    const stopped = await svc.stop()
    expect(stopped.state).toBe('stopped')
  })

  it('refuses concurrent start', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as unknown as Response))
    const subprocess = fakeSubprocess() as unknown as never
    const ctx = fakeCtx(subprocess)
    const svc = new SidecarLifecycle(ctx, {
      port: 8765,
      pythonBin: 'python',
      startupTimeoutMs: 200,
      healthPollMs: 20,
      extraArgs: [],
    })
    await svc.start()
    await expect(svc.start()).rejects.toThrow(/already/)
    await svc.stop()
  })

  it('fails when health never appears', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as unknown as Response))
    const subprocess = fakeSubprocess() as unknown as never
    const ctx = fakeCtx(subprocess)
    const svc = new SidecarLifecycle(ctx, {
      port: 8765,
      pythonBin: 'python',
      startupTimeoutMs: 80,
      healthPollMs: 10,
      extraArgs: [],
    })
    await expect(svc.start()).rejects.toThrow(/not ready/)
    expect(svc.status().state).toBe('failed')
  })
})
