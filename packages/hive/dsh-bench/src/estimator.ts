/**
 * Tiered hardware estimator — FP8 KV + disk guard.
 * Pure helpers for the 104GB DeepSeek-V4-Flash large-model tier.
 * @module @deepseek-ai/dsh-bench/estimator
 */

/** One hardware tier allocation. */
export interface TierMetrics {
  totalFootprintGb: number
  tier1VramGb: number
  tier2RamGb: number
  tier3NvmeGb: number
}

/** Estimator flags. */
export interface TierFlags {
  /** Any spill to NVMe causes latency (PCIe 7.5GB/s vs VRAM 960GB/s). */
  ioLatencyWarning: boolean
  /** NVMe spill exceeds 80% of available capacity. */
  diskFull: boolean
  /** OOM risk when Tier3 is large (kept for compat, now alias of diskFull). */
  oomRisk: boolean
  /** Recommended context cap for this hardware. */
  recommendCap: number
}

export interface TierResult {
  metrics: TierMetrics
  flags: TierFlags
}

export interface EstimatorOptions {
  modelSizeGb?: number
  vramPerGpuGb?: number
  wslRamGb?: number
  nvmeCapacityGb?: number
  nvmeUsedGb?: number
}

const MODEL_GB = 104
const VRAM_PER_GPU = 20
const WSL_RAM = 24
const NVME_CAP = 1000
const KV_PER_TOKEN_GB = 0.07 / 1024 // FP8, V4 Flash approx 70MB per 1K

/**
 * Calculate tiered allocation for a given context length.
 * @param contextTokens - requested context window.
 * @param dualGpuMode - whether 2x 7900 XT (40GB) is present.
 * @param opts - overrides for testing.
 * @returns metrics and flags.
 */
export function calculateHardwareAllocation(
  contextTokens: number,
  dualGpuMode: boolean,
  opts: EstimatorOptions = {},
): TierResult {
  const modelSize = opts.modelSizeGb ?? MODEL_GB
  const vram = (opts.vramPerGpuGb ?? VRAM_PER_GPU) * (dualGpuMode ? 2 : 1)
  const wslRam = opts.wslRamGb ?? WSL_RAM
  const nvmeCap = opts.nvmeCapacityGb ?? NVME_CAP
  const nvmeUsed = opts.nvmeUsedGb ?? 0

  const kvGb = contextTokens * KV_PER_TOKEN_GB

  const tier1 = Math.min(modelSize, vram)
  const remainingWeights = modelSize - tier1

  const ramForWeights = Math.min(remainingWeights, wslRam)
  const weightsToNvme = remainingWeights - ramForWeights

  const ramLeftForKv = wslRam - ramForWeights
  const ramForKv = Math.min(kvGb, Math.max(0, ramLeftForKv))
  const kvToNvme = kvGb - ramForKv

  const tier3 = weightsToNvme + kvToNvme
  const tier2 = ramForWeights + ramForKv

  const total = modelSize + kvGb
  const ioLatencyWarning = kvGb > 0 && (tier3 > 0 || contextTokens > 128_000)
  const diskFull = tier3 + nvmeUsed > nvmeCap * 0.8
  const recommendCap = dualGpuMode ? 131_072 : 32_768

  return {
    metrics: {
      totalFootprintGb: Math.round(total * 100) / 100,
      tier1VramGb: Math.round(tier1 * 100) / 100,
      tier2RamGb: Math.round(tier2 * 100) / 100,
      tier3NvmeGb: Math.round(tier3 * 100) / 100,
    },
    flags: {
      ioLatencyWarning,
      diskFull,
      oomRisk: diskFull,
      recommendCap,
    },
  }
}

/**
 * Whether a load should be blocked due to disk.
 * @param result - tier result.
 * @returns true if Tier3 would exceed 80% NVMe.
 */
export function shouldBlockLoad(result: TierResult): boolean {
  return result.flags.diskFull
}

/**
 * Guard that NVMe allocation stays under 80%.
 * @param tier3Gb - Tier3 allocation.
 * @param capacityGb - total NVMe capacity.
 * @param usedGb - already used.
 * @returns true if would exceed threshold.
 */
export function isDiskFull(tier3Gb: number, capacityGb = NVME_CAP, usedGb = 0): boolean {
  return tier3Gb + usedGb > capacityGb * 0.8
}
