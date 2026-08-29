/**
 * Promotion flow — candidate -> preset.
 * Pure helpers, no direct fs side effects (caller provides fs).
 * @module @deepseek-ai/dsh-preset-trainer/promotion
 */

export interface PromotionResult {
  /** New roster order (candidate id replaced with new id). */
  roster: string[]
  /** Rollback id (original candidate dir kept untouched for rollback). */
  rollbackId: string
  /** New preset id. */
  newId: string
}

/**
 * Validate promotion.
 * @param candidateId - candidate preset id (e.g. my-preset-candidate).
 * @param newId - desired real preset id.
 * @param roster - current roster order.
 * @returns null if valid, error message otherwise.
 */
export function validatePromotion(candidateId: string, newId: string, roster: string[]): string | null {
  if (!candidateId || !newId) return 'candidate and new id required'
  if (candidateId === newId) return 'candidate and new id must differ'
  if (!roster.includes(candidateId)) return `candidate ${candidateId} not in roster`
  if (roster.includes(newId)) return `preset ${newId} already exists`
  if (!/^[a-z0-9-]+$/.test(newId)) return 'new id must be lowercase alphanumeric + hyphen'
  return null
}

/**
 * Promote a candidate.
 * Pure roster rewrite; caller handles fs rename and keeps rollback dir.
 * @param candidateId - candidate id.
 * @param newId - new preset id.
 * @param roster - current roster.
 * @returns promotion result.
 */
export function promoteCandidate(candidateId: string, newId: string, roster: string[]): PromotionResult {
  const err = validatePromotion(candidateId, newId, roster)
  if (err) throw new Error(err)
  const rosterNext = roster.map(id => (id === candidateId ? newId : id))
  return { roster: rosterNext, rollbackId: candidateId, newId }
}
