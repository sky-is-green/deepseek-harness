import { describe, it, expect } from 'vitest'
import { formatStamp, hasStamp } from '../src/client/stamp.ts'

describe('stamp', () => {
  it('no stamp', () => {
    expect(formatStamp(undefined)).toBe('no stamp')
    expect(formatStamp('')).toBe('no stamp')
    expect(hasStamp({})).toBe(false)
  })
  it('has stamp', () => {
    expect(hasStamp({ generationStamp: '2026-08-29T00:00:00Z' })).toBe(true)
    expect(formatStamp('2026-08-29T00:00:00Z')).toContain('generated')
  })
  it('opaque stamp', () => {
    expect(formatStamp('abc-123')).toBe('stamp: abc-123')
  })
})
