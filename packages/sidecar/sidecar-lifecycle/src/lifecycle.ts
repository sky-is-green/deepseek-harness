/**
 * Sidecar lifecycle — dispatches to Windows Vulkan or Linux ROCm Docker based on engine selector.
 * Pure state helpers; Cordis service wiring is in `index.ts`.
 * @module @deepseek-ai/dsh-sidecar-lifecycle/lifecycle
 */
import { describeEngineFailure, type EngineKind } from '@deepseek-ai/dsh-models-engine-selector'

/** Lifecycle state. */
export type SidecarState = 'stopped' | 'starting' | 'running' | 'failed'

/** Status snapshot. */
export interface SidecarStatus {
  state: SidecarState
  port: number
  engine: EngineKind
  detail?: string
}

/**
 * Build a failed status with actionable fix.
 * @param engine - selected engine.
 * @param reason - failure reason.
 * @param detail - optional detail.
 * @returns failed status.
 */
export function failedStatus(engine: EngineKind, reason: Parameters<typeof describeEngineFailure>[1], detail?: string): SidecarStatus {
  return {
    state: 'failed',
    port: 8000,
    engine,
    detail: describeEngineFailure(engine, reason, detail),
  }
}

/**
 * Resolve which port the sidecar should expose.
 * @param engine - selected engine.
 * @returns port.
 */
export function portForEngine(engine: EngineKind): number {
  return engine === 'linux-rocm-docker' ? 8000 : 8765
}
