import { describe, it, expect } from 'vitest'
import { applyPatch, draftSummary, validatePersona, validateSections } from '../src/client/editor.ts'

describe('preset editor', () => {
  it('validates persona required', () => {
    expect(validatePersona('')).toBe('persona is required')
    expect(validatePersona('short')).toBe('persona too short (min 10 chars)')
    expect(validatePersona('a'.repeat(8001))).toBe('persona too long (max 8000 chars)')
    expect(validatePersona('valid persona text here')).toBeNull()
  })
  it('validates sections', () => {
    expect(validateSections(undefined)).toBeNull()
    expect(validateSections(Array(21).fill('x'))).toBe('too many sections (max 20)')
    expect(validateSections(['a'.repeat(2001)])).toBe('section too long (max 2000 chars)')
    expect(validateSections(['a', 'b'])).toBeNull()
  })
  it('applies patch', () => {
    const d = { persona: 'old', promptSections: ['a'] }
    expect(applyPatch(d, { persona: 'new' }).persona).toBe('new')
    expect(applyPatch(d, {}).persona).toBe('old')
  })
  it('summary', () => {
    const s = draftSummary({ persona: 'hello world persona text', promptSections: ['x', 'y'] })
    expect(s).toContain('2 section(s)')
  })
})
