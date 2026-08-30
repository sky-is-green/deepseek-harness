/**
 * Setup wizard — pure helpers for engine/drive/health/tier/leak.
 * Links `engine-selector` (engine), `vhdx` (drive), `dsh-bench estimator` (tier), and `resource-monitor` (health) into one wizard state.
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

/** Tier metrics for the wizard's fit estimate. */
export interface TierMetrics {
  totalFootprintGb: number
  tier1VramGb: number
  tier2RamGb: number
  tier3NvmeGb: number
}

/** Tier flags for the wizard's guard. */
export interface TierFlags {
  ioLatencyWarning: boolean
  diskFull: boolean
  recommendCap: number
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

/** FP8 KV per token for DeepSeek-V4-Flash (≈70MB per 1K). */
const KV_PER_TOKEN_GB = 0.07 / 1024
const MODEL_GB = 104
const VRAM_PER_GPU = 20
const WSL_RAM = 24
const NVME_CAP = 1000

/**
 * Calculate tiered allocation for the wizard's fit estimate (pure, no host import).
 * Mirrors `dsh-bench/estimator` so the wizard and bench agree without cross-plugin import.
 * @param contextTokens - requested context.
 * @param dual - dual GPU.
 * @returns metrics and flags.
 */
export function calculateTier(contextTokens: number, dual: boolean): { metrics: TierMetrics; flags: TierFlags } {
  const vram = VRAM_PER_GPU * (dual ? 2 : 1)
  const kv = contextTokens * KV_PER_TOKEN_GB
  const tier1 = Math.min(MODEL_GB, vram)
  const rem = MODEL_GB - tier1
  const ramW = Math.min(rem, WSL_RAM)
  const wNvme = rem - ramW
  const ramLeft = WSL_RAM - ramW
  const ramKv = Math.min(kv, Math.max(0, ramLeft))
  const kvNvme = kv - ramKv
  const tier3 = wNvme + kvNvme
  const tier2 = ramW + ramKv
  const total = MODEL_GB + kv
  return {
    metrics: {
      totalFootprintGb: Math.round(total * 100) / 100,
      tier1VramGb: Math.round(tier1 * 100) / 100,
      tier2RamGb: Math.round(tier2 * 100) / 100,
      tier3NvmeGb: Math.round(tier3 * 100) / 100,
    },
    flags: {
      ioLatencyWarning: tier3 > 0 || contextTokens > 128_000,
      diskFull: tier3 > NVME_CAP * 0.8,
      recommendCap: dual ? 131_072 : 32_768,
    },
  }
}

/** Unified wizard status linking engine + drive + health + tier. */
export interface WizardStatus {
  state: WizardState
  health: HealthSnapshot
  tier: ReturnType<typeof calculateTier>
  complete: boolean
}

/**
 * Build unified wizard status for the UI card.
 * @param state - wizard state.
 * @param health - health snapshot.
 * @param contextTokens - tier context.
 * @param dual - dual GPU.
 * @returns status.
 */
export function buildWizardStatus(
  state: WizardState,
  health: HealthSnapshot,
  contextTokens: number,
  dual: boolean,
): WizardStatus {
  return {
    state,
    health,
    tier: calculateTier(contextTokens, dual),
    complete: isSetupComplete(state),
  }
}
