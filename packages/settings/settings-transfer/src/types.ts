/**
 * Vocabulary for the settings-transfer bundle (`ctx.settingsTransfer`). Types
 * only — runtime code lives in `index.ts`.
 * @module
 */

/** One locally-authored preset captured as its relative file paths and UTF-8 contents. */
export interface TransferPreset {
  /** Preset id; also the directory name under the importing host's user root. */
  readonly id: string
  /** Relative file path inside the preset directory to UTF-8 content. */
  readonly files: Record<string, string>
}

/** Versioned transfer bundle: settings user sections plus authored presets. */
export interface TransferBundle {
  /** Bump on any incompatible shape change; import refuses other versions. */
  readonly formatVersion: 1
  /** ISO-8601 export timestamp (advisory metadata). */
  readonly exportedAt: string
  /** Raw settings user sections keyed by registered namespace. */
  readonly settings: Record<string, unknown>
  readonly presets: readonly TransferPreset[]
}

/** Outcome of applying one bundle to this host. */
export interface ImportReport {
  /** Namespaces whose stored user section was replaced wholesale. */
  readonly appliedNamespaces: readonly string[]
  /** Namespaces present in the bundle but not applicable here, with the reason. */
  readonly skippedNamespaces: ReadonlyArray<{ ns: string; reason: string }>
  /** Preset ids written under the user root. */
  readonly writtenPresets: readonly string[]
  /** Presets present in the bundle but not written, with the reason. */
  readonly skippedPresets: ReadonlyArray<{ id: string; reason: string }>
}
