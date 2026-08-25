/**
 * Detection orchestration: NVIDIA over `nvidia-smi`, Apple silicon as one
 * unified-memory Metal device, Vulkan over `vulkaninfo --summary`, and a CPU
 * fallback when nothing discrete answers. Every probe is skip-on-failure —
 * absence of detection information is normal (drivers, SDK tools, and
 * platforms vary), while total RAM always reports.
 * @module
 */

import { createNodeProbeEnvironment } from './environment.ts'
import type { HardwareDevice, HardwareSummary } from '@deepseek-ai/dsh-models'
import type { HardwareProbeOptions, ProbeEnvironment } from './types.ts'

/** One nvidia-smi CSV row's memory field, in MiB. */
const MIB = 1024 * 1024

/**
 * Parse one `nvidia-smi --format=csv,noheader,nounits` output line. Names may
 * be quoted and contain commas, so the memory field is read from the end.
 * @param line - one CSV row.
 * @returns the GPU name and VRAM in bytes, or `null` for an unparseable row.
 */
export function parseNvidiaSmiRow(line: string): { name: string; memoryBytes: number } | null {
  const trimmed = line.trim()
  const lastComma = trimmed.lastIndexOf(',')
  if (lastComma < 0) return null
  const nameField = trimmed.slice(0, lastComma).trim()
  const memoryField = trimmed.slice(lastComma + 1).trim()
  const mib = Number.parseInt(memoryField, 10)
  if (nameField.length === 0 || !Number.isFinite(mib) || mib <= 0) return null
  const name = nameField.startsWith('"') && nameField.endsWith('"') && nameField.length >= 2
    ? nameField.slice(1, -1)
    : nameField
  return { name, memoryBytes: mib * MIB }
}

/**
 * Parse `vulkaninfo --summary` output into device entries.
 * @param output - the command's stdout.
 * @returns every listed device with its name, type-derived placement, and no memory figure (vulkaninfo does not report VRAM).
 */
export function parseVulkanInfo(output: string): Array<{ name: string; integrated: boolean }> {
  const devices: Array<{ name: string; integrated: boolean }> = []
  const lines = output.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const nameMatch = /^\s*deviceName\s*=\s*(.+)$/.exec(lines[index] ?? '')
    if (nameMatch === null || nameMatch[1] === undefined) continue
    let integrated = false
    for (let scan = index + 1; scan < Math.min(index + 8, lines.length); scan += 1) {
      const typeMatch = /^\s*deviceType\s*=\s*(\S+)/.exec(lines[scan] ?? '')
      if (typeMatch !== null) {
        integrated = typeMatch[1] === 'INTEGRATED_GPU'
        break
      }
    }
    devices.push({ name: nameMatch[1].trim(), integrated })
  }
  return devices
}

async function probeNvidia(environment: ProbeEnvironment, signal?: AbortSignal): Promise<HardwareDevice[]> {
  const executable = await environment.which('nvidia-smi')
  if (executable === null) return []
  try {
    const output = await environment.run(
      { file: executable, args: ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'] },
      signal,
    )
    return output.split(/\r?\n/).flatMap((line): HardwareDevice[] => {
      const parsed = parseNvidiaSmiRow(line)
      return parsed === null ? [] : [{ backend: 'cuda', name: parsed.name, memoryBytes: parsed.memoryBytes }]
    })
  } catch {
    // A present but failing nvidia-smi means unknown NVIDIA state; report the
    // rest of the host rather than failing hardware() wholesale.
    return []
  }
}

async function probeVulkan(environment: ProbeEnvironment, signal?: AbortSignal): Promise<HardwareDevice[]> {
  const executable = await environment.which('vulkaninfo')
  if (executable === null) return []
  try {
    const output = await environment.run({ file: executable, args: ['--summary'] }, signal)
    return parseVulkanInfo(output).map((device): HardwareDevice => ({
      backend: 'vulkan',
      name: device.name,
    }))
  } catch {
    return []
  }
}

/**
 * Probe this host's compute devices and RAM.
 * @param options - injected environment and abort signal; defaults to the real Node host.
 * @returns detected devices plus total system RAM; an empty device list never occurs — CPU-only hosts report one `cpu` entry.
 * @throws when the abort signal fires before probing completes.
 */
export async function probeHardware(options: HardwareProbeOptions = {}): Promise<HardwareSummary> {
  const environment = options.environment ?? createNodeProbeEnvironment()
  const { signal } = options
  const devices: HardwareDevice[] = []

  if (environment.platform === 'darwin' && environment.arch === 'arm64') {
    devices.push({ backend: 'metal', name: 'Apple Silicon (unified memory)', memoryBytes: environment.totalMemBytes })
  }

  devices.push(...await probeNvidia(environment, signal))
  devices.push(...await probeVulkan(environment, signal))

  if (devices.length === 0) {
    devices.push(...environment.cpuModel !== undefined
      ? [{ backend: 'cpu' as const, name: environment.cpuModel }]
      : [{ backend: 'cpu' as const }])
  }

  return { devices, totalRamBytes: environment.totalMemBytes }
}
