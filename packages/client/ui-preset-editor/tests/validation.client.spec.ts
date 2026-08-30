import { describe, it, expect } from 'vitest'
import { compositionPreview, validateComposition } from '../src/client/validation.ts'

describe('validation preview', () => {
  it('valid', () => {
    expect(validateComposition({ persona: 'valid persona text here', promptSections: ['a'] })).toBeNull()
  })
  it('persona invalid', () => {
    expect(validateComposition({ persona: 'short' })).toContain('persona')
  })
  it('sections invalid', () => {
    expect(validateComposition({ persona: 'valid persona text here', promptSections: Array(21).fill('x') })).toContain('sections')
  })
  it('too large', () => {
    expect(validateComposition({ persona: 'a'.repeat(5000), promptSections: ['b'.repeat(2000), 'c'.repeat(2000), 'd'.repeat(2000)] })).toContain('too large')
  })
  it('preview valid', () => {
    expect(compositionPreview({ persona: 'valid persona text here', promptSections: ['a'] })).toContain('Valid')
  })
  it('preview invalid', () => {
    expect(compositionPreview({ persona: 'short' })).toContain('Invalid')
  })
})
