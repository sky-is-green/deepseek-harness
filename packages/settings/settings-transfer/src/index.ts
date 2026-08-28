/**
 * Settings-transfer bundle (`ctx.settingsTransfer`): export the user layers of
 * every registered settings namespace (including per-model profiles) plus
 * locally-authored presets into one versioned JSON bundle, and apply such a
 * bundle back on this or another host.
 *
 * Trust model, unchanged from the seams it builds on: settings import writes
 * only through namespaces already registered on THIS host (each section is
 * validated by its owner's schema before persisting; unknown namespaces are
 * skipped, never invented), and preset import byte-copies files into the
 * user-writable root only — ids are validated, existing presets are never
 * overwritten unless the caller passes `overwritePresets`, and system roots
 * are unreachable. A transfer therefore grants an importing host nothing its
 * own registered owners would not have accepted anyway.
 * @module @deepseek-ai/dsh-settings-transfer
 */

import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve, sep } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { writableRoot, readComposition } from '@deepseek-ai/dsh-agent-presets/src/authoring.ts'
import { COMPOSITION_FILE, discoverPresets } from '@deepseek-ai/dsh-agent-presets/src/discovery.ts'
import { PRESET_ID } from '@deepseek-ai/dsh-agent-presets/src/preset.ts'
import type { PresetRoot } from '@deepseek-ai/dsh-agent-presets/src/preset.ts'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { TransferBundle, ImportReport, TransferPreset } from './types.ts'

export type { ImportReport, TransferBundle, TransferPreset } from './types.ts'

/** The only bundle version this build reads. */
export const TRANSFER_FORMAT_VERSION = 1 as const

/** Thrown by {@link SettingsTransfer.readBundle} for unparseable or future-version bundles. */
export class TransferFormatError extends Error {
  constructor(message: string) {
    super(`settings-transfer: ${message}`)
    this.name = 'TransferFormatError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Export/import of settings and authored-preset bundles. */
    settingsTransfer: SettingsTransfer
  }
}

/** Structural check over untrusted JSON: every field the bundle contract names, nothing more. */
function isBundleShape(value: unknown): value is TransferBundle {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.formatVersion === TRANSFER_FORMAT_VERSION
    && typeof candidate.exportedAt === 'string'
    && typeof candidate.settings === 'object' && candidate.settings !== null && !Array.isArray(candidate.settings)
    && Array.isArray(candidate.presets)
  )
}

/** Options for {@link SettingsTransfer.importBundle}. */
export interface ImportOptions {
  /**
   * Write a bundled preset over an existing same-id preset. Defaults to
   * `false`: an import never destroys local work silently.
   */
  overwritePresets?: boolean
}

/**
 * Export/import of settings and authored-preset bundles. Reads require no
 * settings provider (an empty document exports); applying one requires a
 * mounted, writable provider because a skipped write would report success
 * while dropping the user's data.
 */
export class SettingsTransfer extends Service {
  private presetRoots: readonly PresetRoot[] | undefined

  constructor(ctx: Context) {
    super(ctx, 'settingsTransfer')
  }

  /**
   * Bind the preset roots used by {@link importBundle}. Kept explicit and
   * optional so hosts without the presets plugin can still transfer settings.
   * @param roots - configured preset roots in precedence order.
   */
  bindPresetRoots(roots: readonly PresetRoot[]): void {
    this.presetRoots = roots
  }

  /**
   * Collect the raw user sections of every registered namespace that has one.
   * Composition `base` layers and schema defaults are deliberately excluded:
   * they belong to the importing host's own deployment, and re-importing them
   * would freeze this machine's composition into another's document.
   * @returns sections keyed by namespace, detached and JSON-safe.
   */
  exportSettings(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (!this.ctx.get('settings')) return out
    for (const d of this.ctx.settings.describe()) {
      if (d.user !== undefined) out[String(d.ns)] = structuredClone(d.user)
    }
    return out
  }

  /**
   * Capture every locally-authored preset (user-trusted roots only) as id +
   * composition contents. Shipped system presets are deployment-owned and
   * excluded.
   * @param roots - the host's configured preset roots in precedence order.
   * @returns one entry per discovered user preset.
   */
  async exportUserPresets(roots: readonly PresetRoot[]): Promise<TransferPreset[]> {
    const presets = await discoverPresets(roots)
    const out: TransferPreset[] = []
    for (const preset of presets) {
      if (preset.trust !== 'user') continue
      const composition = await readComposition(preset)
      out.push({ id: preset.id, files: { [COMPOSITION_FILE]: composition } })
    }
    return out
  }

  /**
   * Assemble a complete bundle: exported settings plus (when roots are given)
   * authored presets.
   * @param roots - preset roots for the presets slice; omit to export settings only.
   * @returns the assembled in-memory bundle.
   */
  async buildBundle(roots?: readonly PresetRoot[]): Promise<TransferBundle> {
    const presets = roots === undefined ? [] : await this.exportUserPresets(roots)
    return {
      formatVersion: TRANSFER_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      settings: this.exportSettings(),
      presets,
    }
  }

  /**
   * Write a bundle to disk as pretty-printed JSON (atomically).
   * @param bundle - the bundle to serialize.
   * @param filePath - destination file; parent directories must exist.
   */
  async writeBundle(bundle: TransferBundle, filePath: string): Promise<void> {
    await writeFileAtomic(filePath, JSON.stringify(bundle, null, 2) + '\n', { mode: 0o600, dirMode: 0o700 })
  }

  /**
   * Read and shape-check a bundle from disk.
   * @param filePath - source file.
   * @returns the parsed bundle.
   * @throws {@link TransferFormatError} on invalid JSON, wrong shape, or a
   * `formatVersion` this build does not read.
   */
  async readBundle(filePath: string): Promise<TransferBundle> {
    let parsed: unknown
    try {
      parsed = JSON.parse(await readFile(filePath, 'utf8'))
    } catch (error) {
      throw new TransferFormatError(`cannot read bundle ${filePath}: ${(error as Error).message}`)
    }
    if (!isBundleShape(parsed)) {
      throw new TransferFormatError(
        `${filePath} is not a format-${String(TRANSFER_FORMAT_VERSION)} settings-transfer bundle`,
      )
    }
    return parsed
  }

  /**
   * Apply a bundle to this host: replace the stored user section of every
   * registered namespace named in the bundle, and write bundled presets into
   * the user root. Namespaces with no registered owner here are skipped (an
   * import never invents owners), and each applied section passes that
   * owner's schema before anything persists.
   * @param bundle - the bundle to apply.
   * @param options - preset-overwrite switch.
   * @returns what was applied and what was skipped, with reasons.
   */
  async importBundle(bundle: TransferBundle, options: ImportOptions = {}): Promise<ImportReport> {
    const appliedNamespaces: string[] = []
    const skippedNamespaces: Array<{ ns: string; reason: string }> = []
    const writtenPresets: string[] = []
    const skippedPresets: Array<{ id: string; reason: string }> = []

    const settings = this.ctx.get('settings')
    if (!settings) {
      skippedNamespaces.push({ ns: '*', reason: 'no settings provider is mounted' })
    } else {
      const registered = new Set(settings.describe().map(d => String(d.ns)))
      for (const [ns, section] of Object.entries(bundle.settings)) {
        if (!registered.has(ns)) {
          skippedNamespaces.push({ ns, reason: 'namespace is not registered on this host' })
          continue
        }
        if (typeof section !== 'object' || section === null || Array.isArray(section)) {
          skippedNamespaces.push({ ns, reason: 'bundle section is not an object' })
          continue
        }
        try {
          await settings.replace(settingsNamespace(ns), section)
          appliedNamespaces.push(ns)
        } catch (error) {
          // The owner's schema refused this section for THIS host; record and
          // continue so one bad namespace does not block the rest of the bundle.
          skippedNamespaces.push({ ns, reason: (error as Error).message })
        }
      }
    }

    const roots = this.presetRoots
    if (roots === undefined) {
      if (bundle.presets.length > 0) {
        skippedPresets.push({ id: '*', reason: 'no preset roots are bound on this host' })
      }
    } else {
      for (const preset of bundle.presets) {
        try {
          await this.writeUserPreset(preset, roots, options.overwritePresets === true)
          writtenPresets.push(preset.id)
        } catch (error) {
          skippedPresets.push({ id: preset.id, reason: (error as Error).message })
        }
      }
    }

    return { appliedNamespaces, skippedNamespaces, writtenPresets, skippedPresets }
  }

  /**
   * Byte-copy one bundled preset under the user root. Mirrors the authoring
   * seam's guards: validated id, user root only, no silent overwrite.
   * @param preset - the bundled preset.
   * @param roots - configured preset roots.
   * @param overwrite - replace an existing same-id preset instead of skipping.
   */
  private async writeUserPreset(
    preset: TransferPreset,
    roots: readonly PresetRoot[],
    overwrite: boolean,
  ): Promise<void> {
    if (!PRESET_ID.test(preset.id)) {
      throw new Error(`preset id ${JSON.stringify(preset.id)} is not a valid preset directory name`)
    }
    const root = resolve(writableRoot(roots))
    const presetDir = resolve(join(root, preset.id))
    const existing = await readdir(root).catch(() => [] as string[])
    if (!overwrite && existing.includes(preset.id)) {
      throw new Error(`preset "${preset.id}" already exists; pass overwritePresets to replace it`)
    }
    for (const [rel, content] of Object.entries(preset.files)) {
      const normalized = rel.split('\\').join('/')
      if (normalized === '' || isAbsolute(normalized) || normalized.split('/').includes('..')) {
        throw new Error(`preset "${preset.id}" file path ${JSON.stringify(rel)} escapes the preset directory`)
      }
      const target = resolve(join(presetDir, ...normalized.split('/')))
      if (!target.startsWith(presetDir + sep)) {
        throw new Error(`preset "${preset.id}" file path ${JSON.stringify(rel)} escapes the preset directory`)
      }
      await writeFileAtomic(target, content, { mode: 0o600, dirMode: 0o700 })
    }
  }
}

export default SettingsTransfer
