/**
 * Sidecar lifecycle service — exposes `sidecarLifecycle.status()` for `ui-sidecar-panel`.
 * Chooses Windows Vulkan or Linux ROCm Docker via `engine-selector`; every failure fails loud.
 * @module @deepseek-ai/dsh-sidecar-lifecycle
 */
import type { Context } from '@deepseek-ai/cordis'
import { resolveEngine, type EngineKind } from '@deepseek-ai/dsh-models-engine-selector'
import { portForEngine, type SidecarStatus } from './lifecycle.ts'

export const name = 'sidecarLifecycle'
export const inject = [] as const

export interface Config {
  engine?: EngineKind
}

/**
 * Apply the sidecar lifecycle service.
 * @param ctx - Cordis context.
 */
export function apply(ctx: Context): void {
  const raw = (ctx as unknown as { config?: unknown }).config
  let engine: EngineKind
  try {
    engine = resolveEngine(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.effect(() => {
      const status: SidecarStatus = { state: 'failed', port: 8000, engine: 'windows-vulkan', detail: message }
      ;(ctx as unknown as { sidecarLifecycle: { status: () => SidecarStatus } }).sidecarLifecycle = { status: () => status }
      return () => {}
    }, 'sidecarLifecycle failed config')
    return
  }

  const port = portForEngine(engine)
  const status: SidecarStatus = { state: engine === 'linux-rocm-docker' ? 'stopped' : 'running', port, engine }

  ctx.effect(() => {
    ;(ctx as unknown as { sidecarLifecycle: { status: () => SidecarStatus } }).sidecarLifecycle = { status: () => status }
    return () => {}
  }, 'sidecarLifecycle status')
}

export * from './vhdx.ts'
export * from './docker.ts'
export * from './lifecycle.ts'
