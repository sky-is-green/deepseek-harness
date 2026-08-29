/**
 * Models directory resolution for LM Studio default + fallback.
 * Pure functions, no side effects — easy to test.
 * @module @deepseek-ai/dsh-client-ui-models-manager/client/models-dir
 */

/** LM Studio default models directory per OS. */
export function lmStudioDefaultDir(platform: string, homeDir: string): string {
  if (platform === 'win32') return `${homeDir}\\.lmstudio\\models`
  return `${homeDir}/.lmstudio/models`
}

/** Fallback when no LM Studio install is detected. */
export const FALLBACK_MODELS_DIR = 'models/gguf'

/**
 * Resolve the effective models directory.
 * @param preferred - user-picked directory (if any).
 * @param lmStudioDir - LM Studio default (if installed).
 * @param fallback - project-local fallback.
 * @returns resolved directory.
 */
export function resolveModelsDir(
  preferred: string | undefined,
  lmStudioDir: string | undefined,
  fallback: string = FALLBACK_MODELS_DIR,
): string {
  if (preferred && preferred.trim().length > 0) return preferred.trim()
  if (lmStudioDir && lmStudioDir.trim().length > 0) return lmStudioDir.trim()
  return fallback
}

/**
 * One-line picker hint for UI.
 * @param lmStudioDir - LM Studio dir if present.
 * @returns hint text.
 */
export function pickerHint(lmStudioDir: string | undefined): string {
  if (lmStudioDir) return `LM Studio default: ${lmStudioDir} — or pick fallback ${FALLBACK_MODELS_DIR}`
  return `No LM Studio found — using ${FALLBACK_MODELS_DIR}. Pick a folder to override.`
}
