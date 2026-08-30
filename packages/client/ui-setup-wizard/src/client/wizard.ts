/**
 * Setup wizard — pure helpers for engine/drive/health.
 * @module @deepseek-ai/dsh-client-ui-setup-wizard/client/wizard
 */

export type EngineKind = 'windows-vulkan' | 'linux-rocm-docker'

export interface WizardState {
  engine: EngineKind
  vhdxPath: string
  modelsDir: string
  mountPoint: string
}

export const DEFAULT_STATE: WizardState = {
  engine: 'windows-vulkan',
  vhdxPath: 'E:\\dsh_storage.vhdx',
  modelsDir: 'E:\\models',
  mountPoint: '/mnt/dsh_storage',
}

/**
 * Validate engine kind.
 * @param raw - untrusted value.
 * @returns validated or throws.
 */
export function validateEngine(raw: unknown): EngineKind {
  if (raw === 'windows-vulkan' || raw === 'linux-rocm-docker') return raw
  throw new Error(`invalid engine "${String(raw)}" — use windows-vulkan or linux-rocm-docker`)
}

/** Health snapshot for unified panel. */
export interface HealthSnapshot {
  windows: { state: string; port: number }
  linux: { state: string; port: number; vhdxMounted: boolean; dockerRunning: boolean }
}

/**
 * Build health snapshot from raw lifecycle statuses.
 * @param win - windows status.
 * @param lin - linux status.
 * @returns snapshot.
 */
export function buildHealthSnapshot(
  win: { state: string; port: number },
  lin: { state: string; port: number; vhdxMounted: boolean; dockerRunning: boolean },
): HealthSnapshot {
  return { windows: win, linux: lin }
}

/**
 * Whether setup is complete (engine + path present).
 * @param s - wizard state.
 * @returns true if complete.
 */
export function isSetupComplete(s: WizardState): boolean {
  return s.vhdxPath.length > 0 && s.modelsDir.length > 0
}

/**
 * Describe drive failure with fix.
 * @param reason - why drive failed.
 * @returns fix copy.
 */
export function describeDriveFailure(reason: 'not-found' | 'not-mounted'): string {
  if (reason === 'not-found') return 'VHDX not found — fix: set E:\\dsh_storage.vhdx in wizard'
  return 'VHDX not mounted — fix: run Mount_AI_Drive.bat as Admin'
}
