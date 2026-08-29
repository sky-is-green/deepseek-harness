/**
 * Generation-stamp display for persona drafts.
 * @module @deepseek-ai/dsh-client-ui-preset-editor/client/stamp
 */

/**
 * Format a generation stamp for display.
 * Stamp is ISO timestamp or opaque string from loader.
 * @param stamp - generation stamp.
 * @returns display string.
 */
export function formatStamp(stamp: string | undefined): string {
  if (!stamp || stamp.trim().length === 0) return 'no stamp'
  const t = stamp.trim()
  // Try ISO parse for pretty date
  const d = new Date(t)
  if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(t)) {
    return `generated ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
  }
  return `stamp: ${t}`
}

/**
 * Whether a draft is stamped.
 * @param draft - draft with optional stamp.
 * @returns true if stamped.
 */
export function hasStamp(draft: { generationStamp?: string }): boolean {
  return typeof draft.generationStamp === 'string' && draft.generationStamp.trim().length > 0
}
