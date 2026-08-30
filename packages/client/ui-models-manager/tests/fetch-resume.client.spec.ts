import { describe, it, expect, vi } from 'vitest'
import { createMemoryWriter, fetchToFileWithResume } from '../src/client/fetch-resume.ts'

function mockFetch(status: number, body: Uint8Array, headers: Record<string, string> = {}): typeof fetch {
  return (async () => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } as Headers,
    body: {
      getReader() {
        let done = false
        return {
          async read() {
            if (done) return { done: true, value: undefined }
            done = true
            return { done: false, value: body }
          },
          releaseLock() {},
        }
      },
    } as unknown as ReadableStream<Uint8Array>,
    arrayBuffer: async () => body.buffer as ArrayBuffer,
  } as unknown as Response)) as unknown as typeof fetch
}

describe('fetchToFileWithResume', () => {
  it('fresh download', async () => {
    const w = createMemoryWriter()
    const res = await fetchToFileWithResume('http://x/file.gguf', () => 0, w, mockFetch(200, new Uint8Array([1, 2, 3]), { 'content-length': '3' }))
    expect(res.ok).toBe(true)
    expect(w.size()).toBe(3)
    if (res.ok) expect(res.resumed).toBe(false)
  })
  it('resume with 206', async () => {
    const w = createMemoryWriter(5)
    const f = mockFetch(206, new Uint8Array([6, 7]), { 'content-length': '2' })
    const res = await fetchToFileWithResume('http://x/file.gguf', () => 5, w, f)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.resumed).toBe(true)
    expect(w.size()).toBe(7)
  })
  it('ignores range and restarts', async () => {
    const w = createMemoryWriter(5)
    const f = mockFetch(200, new Uint8Array([1, 2, 3]), { 'content-length': '3' })
    const res = await fetchToFileWithResume('http://x/file.gguf', () => 5, w, f)
    expect(res.ok).toBe(true)
    expect(w.size()).toBe(3)
  })
  it('416 finalized', async () => {
    const w = createMemoryWriter(10)
    const res = await fetchToFileWithResume('http://x/file.gguf', () => 10, w, mockFetch(416, new Uint8Array()))
    expect(res.ok).toBe(true)
    expect(res.bytes).toBe(10)
  })
  it('network error', async () => {
    const w = createMemoryWriter()
    const f = (async () => { throw new Error('network') }) as unknown as typeof fetch
    const res = await fetchToFileWithResume('http://x/file.gguf', () => 0, w, f)
    expect(res.ok).toBe(false)
  })
  it('calls progress', async () => {
    const w = createMemoryWriter()
    const onProgress = vi.fn()
    await fetchToFileWithResume('http://x/file.gguf', () => 0, w, mockFetch(200, new Uint8Array([1, 2]), { 'content-length': '2' }), onProgress)
    expect(onProgress).toHaveBeenCalled()
  })
})
