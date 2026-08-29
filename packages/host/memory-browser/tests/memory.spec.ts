import { describe, it, expect } from 'vitest'
import { MemoryStore } from '../src/memory.ts'

describe('memory browser', () => {
  it('put + inspect', () => {
    const s = new MemoryStore()
    s.put({ id: 'a', content: 'hello', pinned: false, createdAt: 1 })
    expect(s.inspect('a')?.content).toBe('hello')
    expect(s.inspect('missing')).toBeNull()
  })
  it('pin', () => {
    const s = new MemoryStore()
    s.put({ id: 'a', content: 'x', pinned: false, createdAt: 1 })
    expect(s.pin('a', true)?.pinned).toBe(true)
    expect(s.pin('missing', true)).toBeNull()
  })
  it('delete', () => {
    const s = new MemoryStore()
    s.put({ id: 'a', content: 'x', pinned: false, createdAt: 1 })
    expect(s.delete('a')).toBe(true)
    expect(s.delete('a')).toBe(false)
  })
  it('edit', () => {
    const s = new MemoryStore()
    s.put({ id: 'a', content: 'old', pinned: false, createdAt: 1 })
    expect(s.edit('a', 'new')?.content).toBe('new')
    expect(s.edit('a', '')).toBeNull()
    expect(s.edit('missing', 'x')).toBeNull()
  })
  it('list sorted', () => {
    const s = new MemoryStore()
    s.put({ id: 'b', content: 'b', pinned: false, createdAt: 2 })
    s.put({ id: 'a', content: 'a', pinned: false, createdAt: 1 })
    expect(s.list().map(e => e.id)).toEqual(['a', 'b'])
  })
})
