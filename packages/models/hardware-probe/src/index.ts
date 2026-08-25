/**
 * Host compute detection for `ctx.models` fit estimates: NVIDIA devices via
 * `nvidia-smi`, Apple silicon as unified-memory Metal, Vulkan adapters via
 * `vulkaninfo`, and a CPU fallback. Detection is skip-on-failure and fully
 * injectable, so tests run offline; the future local model provider consumes
 * this inside its `ModelsRuntime.hardware()` implementation.
 * @module @deepseek-ai/dsh-hardware-probe
 */

export { createNodeProbeEnvironment } from './environment.ts'
export { parseNvidiaSmiRow, parseVulkanInfo, probeHardware } from './probe.ts'
export type {
  HardwareProbeOptions,
  HardwareSummary,
  ProbeCommand,
  ProbeEnvironment,
} from './types.ts'
