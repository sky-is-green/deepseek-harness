/**
 * Preset/persona editor — pure helpers over the presets seam.
 * Validates persona text, merges preset patches, no side effects.
 * @module @deepseek-ai/dsh-client-ui-preset-editor/client/editor
 */

export interface PersonaDraft {
  persona: string
  promptSections?: string[]
  generationStamp?: string
}

export interface PresetPatch {
  persona?: string
  promptSections?: string[]
}

/**
 * Validate persona text.
 * @param persona - persona text.
 * @returns null if valid, error message otherwise.
 */
export function validatePersona(persona: string): string | null {
  const t = persona.trim()
  if (t.length === 0) return 'persona is required'
  if (t.length < 10) return 'persona too short (min 10 chars)'
  if (t.length > 8000) return 'persona too long (max 8000 chars)'
  return null
}

/**
 * Validate prompt sections.
 * @param sections - prompt section list.
 * @returns null if valid, error otherwise.
 */
export function validateSections(sections: string[] | undefined): string | null {
  if (!sections) return null
  if (sections.length > 20) return 'too many sections (max 20)'
  for (const s of sections) if (s.length > 2000) return 'section too long (max 2000 chars)'
  return null
}

/**
 * Apply a patch to a draft.
 * @param draft - current draft.
 * @param patch - patch.
 * @returns merged draft.
 */
export function applyPatch(draft: PersonaDraft, patch: PresetPatch): PersonaDraft {
  return {
    persona: patch.persona ?? draft.persona,
    promptSections: patch.promptSections ?? draft.promptSections,
    generationStamp: draft.generationStamp,
  } as PersonaDraft
}

/**
 * One-line summary for composition preview.
 * @param draft - draft.
 * @returns summary.
 */
export function draftSummary(draft: PersonaDraft): string {
  const personaPreview = draft.persona.trim().slice(0, 60)
  const sections = draft.promptSections?.length ?? 0
  return `${personaPreview}${personaPreview.length >= 60 ? '…' : ''} — ${sections} section(s)`
}
