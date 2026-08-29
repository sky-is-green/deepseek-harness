/**
 * Composition validation preview — loader-dialect check.
 * Pure helpers, no cordis loader needed.
 * @module @deepseek-ai/dsh-client-ui-preset-editor/client/validation
 */
import { validatePersona, validateSections } from './editor.ts'

/**
 * Validate a full persona draft as the loader would.
 * Checks persona, sections, and that persona + sections don't exceed token-ish limits.
 * @param draft - persona draft.
 * @returns null if valid, error preview otherwise.
 */
export function validateComposition(draft: { persona: string; promptSections?: string[] }): string | null {
  const pErr = validatePersona(draft.persona)
  if (pErr) return `persona: ${pErr}`
  const sErr = validateSections(draft.promptSections)
  if (sErr) return `sections: ${sErr}`
  const total = draft.persona.length + (draft.promptSections?.join('').length ?? 0)
  if (total > 10000) return 'composition too large (max 10000 chars)'
  return null
}

/**
 * One-line preview for UI.
 * @param draft - draft.
 * @returns preview text.
 */
export function compositionPreview(draft: { persona: string; promptSections?: string[] }): string {
  const err = validateComposition(draft)
  if (err) return `Invalid: ${err}`
  const n = draft.promptSections?.length ?? 0
  return `Valid — ${draft.persona.trim().slice(0, 40)}… + ${n} section(s)`
}
