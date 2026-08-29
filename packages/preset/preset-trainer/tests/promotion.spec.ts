import { describe, it, expect } from 'vitest'
import { promoteCandidate, validatePromotion } from '../src/promotion.ts'

describe('promotion flow', () => {
  it('validates', () => {
    expect(validatePromotion('cand', 'new-id', ['cand', 'x'])).toBeNull()
    expect(validatePromotion('cand', 'cand', ['cand'])).toContain('must differ')
    expect(validatePromotion('missing', 'new', ['cand'])).toContain('not in roster')
    expect(validatePromotion('cand', 'x', ['cand', 'x'])).toContain('already exists')
    expect(validatePromotion('cand', 'Bad', ['cand'])).toContain('lowercase')
  })
  it('promotes', () => {
    const r = promoteCandidate('cand', 'new-id', ['a', 'cand', 'b'])
    expect(r.roster).toEqual(['a', 'new-id', 'b'])
    expect(r.rollbackId).toBe('cand')
    expect(r.newId).toBe('new-id')
  })
  it('throws on invalid', () => {
    expect(() => promoteCandidate('cand', 'cand', ['cand'])).toThrow()
  })
  it('keeps order', () => {
    const r = promoteCandidate('cand', 'z', ['cand', 'a', 'b'])
    expect(r.roster[0]).toBe('z')
  })
})
