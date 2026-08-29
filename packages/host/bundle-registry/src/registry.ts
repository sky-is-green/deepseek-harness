/**
 * Bundle registry — read profile manifests and compute closure.
 * Pure + fs-bound helpers, easy to test.
 * @module @deepseek-ai/dsh-host-bundle-registry/registry
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

/** One profile manifest (cordis.yml shape, read-only). */
export interface ProfileManifest {
  /** Profile id (directory name or manifest id). */
  id: string
  /** Plugin rows. */
  plugins: unknown[]
  /** Raw manifest. */
  raw: Record<string, unknown>
}

/** Merged closure over many profiles. */
export interface BundleClosure {
  /** All plugin ids in closure order. */
  pluginIds: string[]
  /** Profile ids that contributed. */
  profileIds: string[]
  /** Raw manifests keyed by profile id. */
  manifests: Record<string, ProfileManifest>
}

/**
 * Read one profile manifest.
 * @param profileDir - directory containing cordis.yml.
 * @returns manifest or null if absent.
 */
export function readProfileManifest(profileDir: string): ProfileManifest | null {
  const file = join(profileDir, 'cordis.yml')
  if (!existsSync(file)) return null
  const raw = yaml.load(readFileSync(file, 'utf8')) as Record<string, unknown>
  const id = (raw.id as string | undefined) ?? profileDir.split('/').pop() ?? 'unknown'
  const plugins = Array.isArray(raw.plugins) ? (raw.plugins as unknown[]) : []
  return { id, plugins, raw }
}

/**
 * List profile directories under a root.
 * @param root - profiles root (e.g. apps/cli/config/agent-presets or bundle root).
 * @returns sorted profile ids (directory names).
 */
export function listProfiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
}

/**
 * Compute bundle closure over a set of profiles.
 * Reads each profile's cordis.yml and collects plugin ids.
 * @param root - profiles root.
 * @param profileIds - profile ids to include (if omitted, all under root).
 * @returns closure with pluginIds in encounter order, deduped.
 */
export function getBundleClosure(root: string, profileIds?: string[]): BundleClosure {
  const ids = profileIds ?? listProfiles(root)
  const manifests: Record<string, ProfileManifest> = {}
  const seen = new Set<string>()
  const pluginIds: string[] = []

  for (const pid of ids) {
    const dir = join(root, pid)
    const m = readProfileManifest(dir)
    if (!m) continue
    manifests[pid] = m
    for (const p of m.plugins) {
      const row = p as Record<string, unknown>
      const candidate = (row.id as string | undefined) ?? (row.name as string | undefined) ?? JSON.stringify(row)
      if (!seen.has(candidate)) {
        seen.add(candidate)
        pluginIds.push(candidate)
      }
    }
  }

  return { pluginIds, profileIds: Object.keys(manifests), manifests }
}
