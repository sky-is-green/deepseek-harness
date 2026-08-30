/**
 * Engine selector — Windows quick vs Linux large.
 * Fail-loud contract: every invalid or unusable engine reports an actionable fix, never silently falls back.
 * @module @deepseek-ai/dsh-models-engine-selector/selector
 */

/** Supported engine backends. */
export type EngineKind = 'windows-vulkan' | 'linux-rocm-docker'

/** Validated engine Config. */
export interface Config {
  /** Which host backend to use. */
  engine: EngineKind
}

/** Default engine for quick setup. */
export const DEFAULT_ENGINE: EngineKind = 'windows-vulkan'

const VALID: ReadonlySet<EngineKind> = new Set<EngineKind>(['windows-vulkan', 'linux-rocm-docker'])

/**
 * Resolve raw Config into validated EngineKind.
 * @param raw - untrusted config value from cordis.yml.
 * @returns validated engine kind.
 * @throws when engine is not one of the two supported values.
 */
export function resolveEngine(raw: unknown): EngineKind {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('engine-selector: Config must be an object with { engine } — fix: set engine: windows-vulkan or linux-rocm-docker in cordis.yml')
  }
  const rec = raw as Record<string, unknown>
  const engine = rec.engine
  if (engine === undefined) return DEFAULT_ENGINE
  if (typeof engine !== 'string' || !VALID.has(engine as EngineKind)) {
    throw new Error(`engine-selector: unsupported engine "${JSON.stringify(engine)}" — fix: use windows-vulkan (quick, E:\\models) or linux-rocm-docker (large, /mnt/dsh_storage + docker). Got: ${JSON.stringify(engine)}`)
  }
  return engine as EngineKind
}

/** Failure reason for a selected engine that cannot start. */
export type EngineFailureReason =
  | 'vhdx-not-mounted'
  | 'docker-not-running'
  | 'rocm-not-available'
  | 'model-not-found'
  | 'port-in-use'
  | 'unknown'

/**
 * Build an actionable failure message for a loud engine failure.
 * @param kind - selected engine.
 * @param reason - why it failed.
 * @param detail - optional extra detail (path, port).
 * @returns human-readable fix.
 */
export function describeEngineFailure(kind: EngineKind, reason: EngineFailureReason, detail?: string): string {
  const d = detail ? ` (${detail})` : ''
  switch (reason) {
    case 'vhdx-not-mounted':
      return `engine ${kind} failed: VHDX not mounted${d} — fix: run Mount_AI_Drive.bat as Admin or wsl --mount --vhd E:\\dsh_storage.vhdx --bare && mount /dev/sdX1 /mnt/dsh_storage`
    case 'docker-not-running':
      return `engine ${kind} failed: Docker/WSL not running${d} — fix: start Docker Desktop and wsl -d Ubuntu -e docker ps`
    case 'rocm-not-available':
      return `engine ${kind} failed: ROCm not available${d} — fix: check /dev/kfd and /dev/dri, group_add video/render, HSA_OVERRIDE_GFX_VERSION=11.0.0 for Navi31`
    case 'model-not-found':
      return `engine ${kind} failed: model not found${d} — fix: check modelsDir or /workspace/models and ensure *-00001-of-*.gguf shards exist`
    case 'port-in-use':
      return `engine ${kind} failed: port in use${d} — fix: free 8000 or change docker-compose.yml ports`
    case 'unknown':
    default:
      return `engine ${kind} failed${d} — fix: check sidecar/status and docker logs dsh-compute-backend`
  }
}

/**
 * Whether the kind is the Linux large tier.
 * @param kind - engine kind.
 * @returns true for linux-rocm-docker.
 */
export function isLinuxEngine(kind: EngineKind): boolean {
  return kind === 'linux-rocm-docker'
}
