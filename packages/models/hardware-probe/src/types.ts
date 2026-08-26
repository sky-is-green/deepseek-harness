/**
 * Vocabulary for the hardware probe. Types only — runtime code lives in
 * `environment.ts`, `probe.ts`, and `index.ts`.
 * @module
 */

/** One external command the probe may run. */
export interface ProbeCommand {
  readonly file: string
  readonly args: readonly string[]
}

/**
 * Everything the probe needs from its host, injected so detection is
 * reproducible offline. The Node default comes from {@link createNodeProbeEnvironment}.
 */
export interface ProbeEnvironment {
  /** Operating-system platform (`darwin`, `win32`, `linux`, ...). */
  readonly platform: string
  /** Machine architecture (`arm64`, `x64`, ...). */
  readonly arch: string
  /** Total system RAM in bytes. */
  readonly totalMemBytes: number
  /** First CPU's marketing name, when the host exposes one. */
  readonly cpuModel?: string
  /**
   * Resolve one bare executable name against the search path.
   * @param file - bare executable name (no separators).
   * @returns an absolute path, or `null` when nothing usable is on the path.
   */
  which(file: string): Promise<string | null>
  /**
   * Run one resolved command.
   * @param command - absolute executable and arguments.
   * @param signal - aborts the run.
   * @returns combined standard output.
   * @throws when the executable cannot start or exits nonzero.
   */
  run(command: ProbeCommand, signal?: AbortSignal): Promise<string>
}

/** Options for {@link probeHardware}. */
export interface HardwareProbeOptions {
  /** Detection seams; defaults to the real Node host. */
  readonly environment?: ProbeEnvironment
  /** Aborts outstanding probes. */
  readonly signal?: AbortSignal
}

export type { HardwareSummary } from '@deepseek-ai/dsh-models'
