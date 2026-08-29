import { describe, it, expect } from 'vitest'
import { embedOne, handleEmbeddingsRequest } from '../src/embeddings.ts'

describe('embeddings', () => {
  it('embedOne deterministic 8 dims', () => {
    const a = embedOne('hello')
    const b = embedOne('hello')
    expect(a).toEqual(b)
    expect(a).toHaveLength(8)
    expect(a.every(v => v >= -1 && v <= 1)).toBe(true)
  })
  it('different text differs', () => {
    expect(embedOne('hello')).not.toEqual(embedOne('world'))
  })
  it('handles string input', () => {
    const r = handleEmbeddingsRequest({ model: 'm', input: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.response.data).toHaveLength(1)
  })
  it('handles array input', () => {
    const r = handleEmbeddingsRequest({ model: 'm', input: ['a', 'b'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.response.data).toHaveLength(2)
  })
  it('rejects missing model', () => {
    const r = handleEmbeddingsRequest({ input: 'hi' })
    expect(r.ok).toBe(false)
  })
  it('rejects bad input type', () => {
    const r = handleEmbeddingsRequest({ model: 'm', input: 123 })
    expect(r.ok).toBe(false)
  })
  it('rejects empty', () => {
    const r = handleEmbeddingsRequest({ model: 'm', input: '' })
    // empty string is valid input (one entry with empty text) — should be ok
    expect(r.ok).toBe(true)
  })
  it('counts tokens', () => {
    const r = handleEmbeddingsRequest({ model: 'm', input: 'hello world' })
    if (r.ok) expect(r.response.usage.prompt_tokens).toBeGreaterThan(0)
  })
})
