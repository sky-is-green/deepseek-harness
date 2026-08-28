/**
 * Host sidecar lifecycle: spawn, health-check, and bootstrap the Hive sidecar
 * so users never run `pip`. The sidecar is a local FastAPI app (`harness`
 * in `hive-memory`) exposing `/v1/hive/curate`, `/v1/hive/observe`,
 * `/v1/protocol/run` and `/openapi.json`. This service owns one subprocess.
 * @module @deepseek-ai/dsh-sidecar-lifecycle
 */

import { Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sidecarLifecycle: SidecarLifecycle
  }
  interface Events {
    /** Sidecar lifecycle status change. */
    'sidecar/status': { state: SidecarState; port?: number; error?: string }
  }
}

/** Observable lifecycle state. */
export type SidecarState = 'stopped' | 'starting' | 'running' | 'failed'

/** Snapshot returned by `status()`. */
export interface SidecarStatus {
  state: SidecarState
  port?: number
  pid?: number
  error?: string
}

/**
 * Configuration for the lifecycle service. All deployment-varying choices are
 * validated fields, changeable from `cordis.yml`.
 */
export interface SidecarLifecycleConfig {
  /** Port the sidecar listens on. */
  port: number
  /** Optional absolute path to a frozen binary (PyInstaller). When missing or absent, falls back to `python -m harness`. */
  binaryPath?: string
  /** Python executable when falling back to module mode. */
  pythonBin: string
  /** Working directory for the sidecar (where `harness/` is resolvable). */
  cwd?: string
  /** Startup timeout before health polling gives up. */
  startupTimeoutMs: number
  /** Poll interval for `/openapi.json` health. */
  healthPollMs: number
  /** Extra args appended to the spawn command. */
  extraArgs: string[]
}

const DEFAULT_PORT = 8765
const DEFAULT_STARTUP_TIMEOUT_MS = 15_000
const DEFAULT_HEALTH_POLL_MS = 250

/** Schemastery schema for {@link SidecarLifecycleConfig}. */
export const Config: z<SidecarLifecycleConfig> = z.object({
  port: z.number().step(1).min(1).max(65_535).default(DEFAULT_PORT),
  binaryPath: (z.string() as unknown as { default: (v: unknown) => ReturnType<typeof z.string> }).default(undefined),
  pythonBin: z.string().default('python'),
  cwd: (z.string() as unknown as { default: (v: unknown) => ReturnType<typeof z.string> }).default(undefined),
  startupTimeoutMs: z.natural().default(DEFAULT_STARTUP_TIMEOUT_MS),
  healthPollMs: z.natural().default(DEFAULT_HEALTH_POLL_MS),
  extraArgs: z.array(z.string()).default([]),
})

/**
 * Resolve the argv to spawn the sidecar. Prefers a frozen binary when it
 * exists on disk; otherwise falls back to `python -m harness`.
 * @param config - validated config.
 * @returns argv array for `ctx.subprocess.spawn`.
 */
export function resolveSidecarArgv(config: SidecarLifecycleConfig): string[] {
  if (config.binaryPath) {
    const abs = resolve(config.binaryPath)
    if (existsSync(abs)) return [abs, ...config.extraArgs]
  }
  return [config.pythonBin, '-m', 'harness', ...config.extraArgs]
}

/** Sentinel for abort vs failure. */
class AbortError extends Error {
  constructor() {
    super('sidecar lifecycle: aborted')
    this.name = 'AbortError'
  }
}

/**
 * One-process sidecar lifecycle. Concurrent starts refuse loud; stop is idempotent.
 */
export class SidecarLifecycle extends Service {
  static inject = ['subprocess']

  private _status: SidecarStatus = { state: 'stopped' }
  private handle: SubprocessHandle | undefined
  private startAbort: AbortController | undefined

  constructor(
    ctx: import('@deepseek-ai/cordis').Context,
    private readonly config: SidecarLifecycleConfig,
  ) {
    super(ctx, 'sidecarLifecycle')
    ctx.effect(() => {
      return async () => {
        await this.stop().catch(() => {})
      }
    }, 'sidecar-lifecycle teardown')
  }

  /** Current snapshot (pure). */
  status(): SidecarStatus {
    return { ...this._status }
  }

  /**
   * Whether the sidecar binary or fallback is resolvable on this host.
   * The frozen binary path, when configured, is checked first.
   * @returns true when a spawn would have an argv to run.
   */
  bootstrapReady(): boolean {
    if (this.config.binaryPath && existsSync(resolve(this.config.binaryPath))) return true
    // Fallback `python -m harness` is always attemptable; true even when python is missing
    // so callers can try and surface the spawn error via status.
    return true
  }

  /**
   * Start the sidecar and wait for `/openapi.json` health.
   * @param signal - optional external abort signal.
   */
  async start(signal?: AbortSignal): Promise<SidecarStatus> {
    if (this._status.state === 'starting' || this._status.state === 'running') {
      throw new Error(`sidecar lifecycle: already ${this._status.state}`)
    }
    this.commit({ state: 'starting', port: this.config.port })
    const controller = new AbortController()
    this.startAbort = controller
    const onExternal = (): void => { controller.abort() }
    signal?.addEventListener('abort', onExternal, { once: true })
    try {
      const argv = resolveSidecarArgv(this.config)
      const handle = this.ctx.subprocess.spawn({
        argv,
        ...(this.config.cwd ? { cwd: this.config.cwd } : {}),
        stdio: { stdin: 'ignore', stdout: { maxBytes: 64 * 1024 }, stderr: { maxBytes: 64 * 1024 } },
        graceMs: 5_000,
      } as never)
      this.handle = handle
      // Surface unexpected exit: handle.done rejects on non-zero.
      void handle.done.catch((error: unknown) => {
        if (this._status.state === 'starting' || this._status.state === 'running') {
          const message = error instanceof Error ? error.message : String(error)
          this.commit({ state: 'failed', error: message, port: this.config.port })
        }
      })
      await this.awaitHealthy(controller.signal)
      if (controller.signal.aborted || signal?.aborted === true) throw new AbortError()
      {
        const pid = (handle as unknown as { pid?: number }).pid
        if (pid !== undefined) this.commit({ state: 'running', port: this.config.port, pid })
        else this.commit({ state: 'running', port: this.config.port })
      }
      return this.status()
    } catch (error) {
      if (controller.signal.aborted || signal?.aborted === true) {
        await this.terminate()
        this.commit({ state: 'stopped', port: this.config.port })
        throw new Error('sidecar lifecycle: start aborted')
      }
      const message = error instanceof Error ? error.message : String(error)
      this.commit({ state: 'failed', error: message, port: this.config.port })
      await this.terminate()
      throw error
    } finally {
      signal?.removeEventListener('abort', onExternal)
      this.startAbort = undefined
    }
  }

  /** Stop the sidecar when running or starting. Idempotent. */
  async stop(): Promise<SidecarStatus> {
    this.startAbort?.abort()
    if (this.handle) await this.terminate()
    this.commit({ state: 'stopped', port: this.config.port })
    return this.status()
  }

  /** Whether `GET /openapi.json` responds. */
  async probeHealth(signal?: AbortSignal): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.config.port}/openapi.json`, {
        signal: signal ?? AbortSignal.timeout(this.config.healthPollMs),
      })
      return res.ok
    } catch {
      return false
    }
  }

  private async awaitHealthy(signal: AbortSignal): Promise<void> {
    const deadline = Date.now() + this.config.startupTimeoutMs
    while (Date.now() < deadline && !signal.aborted) {
      if (await this.probeHealth(signal)) return
      await new Promise<void>((resolve) => { setTimeout(resolve, this.config.healthPollMs) })
    }
    if (signal.aborted) throw new AbortError()
    throw new Error(`sidecar /openapi.json not ready within ${this.config.startupTimeoutMs}ms`)
  }

  private async terminate(): Promise<void> {
    const h = this.handle
    this.handle = undefined
    if (!h) return
    h.terminate()
    await h.done.catch(() => {})
  }

  private commit(next: SidecarStatus): void {
    this._status = next
    const payload: { state: SidecarState; port?: number; error?: string } = { state: next.state }
    if (next.port !== undefined) payload.port = next.port
    if (next.error !== undefined) payload.error = next.error
    ;(this.ctx.emit)('sidecar/status', payload)
  }
}

export default SidecarLifecycle
