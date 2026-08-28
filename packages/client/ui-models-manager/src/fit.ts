/**
 * Pre-load fit estimator: compares one model's weight size to the host's
 * available hardware memory. The estimator is the join between the
 * `dsh-hardware-probe` (GPU/VRAM + total RAM) and the `dsh-gguf-metadata`
 * (`sizeBytes`) seams. The rule is intentionally narrow: file size vs the
 * largest memory-bearing device, falling back to system RAM when no device
 * reports `memoryBytes`. Context-length KV overhead is omitted; the file size
 * dominates and the overhead depends on hidden architecture parameters the
 * catalog does not carry.
 * @module @deepseek-ai/dsh-client-ui-models-manager/fit
 */
import type { HardwareDevice, HardwareSummary } from '@deepseek-ai/dsh-models'

/** GB with one decimal — mirrors the card meta helper. */
export function formatGigabytes(bytes: number): string {
  return `${(Math.round(bytes / (1024 * 1024 * 1024) * 10) / 10).toFixed(1)} GB`
}

/** Pick the largest memory-bearing device, or fall back to system RAM. */
function pickAvailable(hardware: HardwareSummary): { availableBytes: number; device?: HardwareDevice } {
  let best: HardwareDevice | undefined
  let bestMem = -1
  for (const device of hardware.devices) {
    if (device.memoryBytes !== undefined && device.memoryBytes > bestMem) {
      bestMem = device.memoryBytes
      best = device
    }
  }
  if (best !== undefined && best.memoryBytes !== undefined) {
    return { availableBytes: best.memoryBytes, device: best }
  }
  return { availableBytes: hardware.totalRamBytes }
}

/** Result of one fit check against live hardware. */
export interface FitEstimate {
  /** File size the model needs (bytes). */
  readonly needsBytes: number
  /** Host memory chosen as the budget (bytes). */
  readonly availableBytes: number
  /** Whether `needsBytes <= availableBytes`. */
  readonly fits: boolean
  /** `needsBytes / availableBytes` (handy for a bar). */
  readonly ratio: number
  /** Chosen budget device when one reported memory. */
  readonly device?: HardwareDevice
  /** Formatted labels matching the card meta style. */
  readonly needsLabel: string
  readonly availableLabel: string
}

/**
 * Estimate whether one model fits the host.
 * @param sizeBytes - catalog `sizeBytes` for the entry, or `bytesTotal` for a download.
 * @param hardware - probed host summary; `null`/`undefined` yields `null` (unknown).
 * @returns the estimate, or `null` when hardware is unknown or unusable.
 */
export function estimateFit(
  sizeBytes: number,
  hardware: HardwareSummary | null | undefined,
): FitEstimate | null {
  if (hardware === undefined || hardware === null) return null
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return null
  const { availableBytes, device } = pickAvailable(hardware)
  if (!Number.isFinite(availableBytes) || availableBytes <= 0) return null
  const fits = sizeBytes <= availableBytes
  return {
    needsBytes: sizeBytes,
    availableBytes,
    fits,
    ratio: availableBytes === 0 ? 0 : sizeBytes / availableBytes,
    ...(device !== undefined && { device }),
    needsLabel: formatGigabytes(sizeBytes),
    availableLabel: formatGigabytes(availableBytes),
  }
}
