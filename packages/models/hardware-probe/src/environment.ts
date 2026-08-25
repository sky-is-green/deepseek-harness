/**
 * The real Node probe environment: PATH resolution without dependencies and
 * bounded subprocess runs whose parent environment is scrubbed by the one
 * shared definition from the subprocess seam (this spawner cannot route
 * through `ctx.subprocess` — it is a plain library).
 * @module
 */

import { execFile } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import { delimiter, isAbsolute, join } from 'node:path'
import { arch, cpus, platform, totalmem } from 'node:os'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import type { ProbeCommand, ProbeEnvironment } from './types.ts'

/** Upper bound on one detection command; a wedged driver must not stall boot. */
export const PROBE_COMMAND_TIMEOUT_MS = 5_000

/** Executable suffixes tried in order on Windows; other platforms try the bare name. */
const WINDOWS_EXECUTABLE_SUFFIXES = ['.exe', '.cmd', '.bat']

async function executableCandidate(candidate: string): Promise<boolean> {
  try {
    await access(candidate, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve a bare name against the PATH (plus PATHEXT candidates on Windows).
 * @param file - bare executable name.
 * @returns the first existing candidate's path, or `null` when none exists.
 */
export async function whichPath(file: string): Promise<string | null> {
  if (file.includes('/') || file.includes('\\') || isAbsolute(file)) return null
  const directories = (process.env.PATH ?? '').split(delimiter).filter(entry => entry.length > 0)
  const suffixes = platform() === 'win32' ? WINDOWS_EXECUTABLE_SUFFIXES : ['']
  for (const directory of directories) {
    for (const suffix of suffixes) {
      const candidate = join(directory, `${file}${suffix}`)
      if (await executableCandidate(candidate)) return candidate
    }
  }
  return null
}

function runResolved(command: ProbeCommand, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command.file,
      [...command.args],
      {
        timeout: PROBE_COMMAND_TIMEOUT_MS,
        signal,
        env: scrubbedParentEnv(),
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error !== null) {
          reject(error instanceof Error ? error : new Error('probe command failed'))
          return
        }
        resolve(stdout)
      },
    )
  })
}

/**
 * Build the default {@link ProbeEnvironment} from this Node process.
 * @returns a probe environment bound to the live host.
 */
export function createNodeProbeEnvironment(): ProbeEnvironment {
  const firstCpuModel = cpus()[0]?.model
  return {
    platform: platform(),
    arch: arch(),
    totalMemBytes: totalmem(),
    ...firstCpuModel !== undefined && firstCpuModel.length > 0 ? { cpuModel: firstCpuModel } : {},
    which: whichPath,
    run: runResolved,
  }
}
