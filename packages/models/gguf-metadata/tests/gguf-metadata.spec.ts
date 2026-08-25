import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readGgufMetadataFromBytes } from '@deepseek-ai/dsh-gguf-metadata'
import { readGgufMetadataFromFile } from '@deepseek-ai/dsh-gguf-metadata/node'

function bytes(...parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function u32(value: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(4))
  view.setUint32(0, value, true)
  return new Uint8Array(view.buffer)
}

function u64(value: number | bigint): Uint8Array {
  const view = new DataView(new ArrayBuffer(8))
  view.setBigUint64(0, BigInt(value), true)
  return new Uint8Array(view.buffer)
}

function f32(value: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(4))
  view.setFloat32(0, value, true)
  return new Uint8Array(view.buffer)
}

function rawString(value: string): Uint8Array {
  return bytes(u64(value.length), new TextEncoder().encode(value))
}

const MAGIC = u32(0x47_47_55_46)

type Kv = Uint8Array

function kv(key: string, tag: number, ...value: ReadonlyArray<Uint8Array>): Kv {
  return bytes(rawString(key), u32(tag), ...value)
}

function header(version: number, tensorCount: number, kvs: ReadonlyArray<Kv>): Uint8Array {
  return bytes(MAGIC, u32(version), u64(tensorCount), u64(kvs.length), ...kvs)
}

const SAMPLE_KVS: ReadonlyArray<Kv> = [
  kv('general.architecture', 8, rawString('qwen3')),
  kv('qwen3.context_length', 4, u32(32_768)),
  kv('general.file_type', 4, u32(15)),
]

describe('GGUF header reader', () => {
  it('surfaces every consumer field from a complete v3 header', async () => {
    const metadata = await readGgufMetadataFromBytes(header(3, 2, [
      kv('general.architecture', 8, rawString('qwen3')),
      kv('general.name', 8, rawString('Qwen3 4B')),
      kv('general.file_type', 4, u32(15)),
      kv('qwen3.context_length', 4, u32(32_768)),
      kv('tokenizer.chat_template', 8, rawString('{% for m in messages %}{{ m.content }}{% endfor %}')),
      kv('general.some_flag', 7, new Uint8Array([1])),
      kv('general.temperature', 6, f32(0.7)),
    ]))
    expect(metadata).toEqual({
      formatVersion: 3,
      architecture: 'qwen3',
      name: 'Qwen3 4B',
      quantization: 'Q4_K_M',
      contextLength: 32_768,
      chatTemplate: '{% for m in messages %}{{ m.content }}{% endfor %}',
    })
  })

  it('accepts a v2 header', async () => {
    const metadata = await readGgufMetadataFromBytes(header(2, 0, [kv('general.architecture', 8, rawString('llama'))]))
    expect(metadata.formatVersion).toBe(2)
    expect(metadata.architecture).toBe('llama')
  })

  it('rejects a v1 header and a bad magic loudly', async () => {
    await expect(readGgufMetadataFromBytes(header(1, 0, []))).rejects.toThrow(/unsupported GGUF version 1/)
    await expect(readGgufMetadataFromBytes(bytes(u32(0), u32(3), u64(0), u64(0)))).rejects.toThrow(/bad magic/)
  })

  it('rejects a header truncated mid-field', async () => {
    const full = header(3, 0, [kv('general.name', 8, rawString('Qwen3 4B'))])
    await expect(readGgufMetadataFromBytes(full.subarray(0, full.length - 3))).rejects.toThrow(/mid-field/)
  })

  it('resolves context length regardless of key order relative to the architecture key', async () => {
    const reordered = await readGgufMetadataFromBytes(header(3, 0, [
      kv('qwen3.context_length', 4, u32(40_960)),
      kv('general.architecture', 8, rawString('qwen3')),
    ]))
    expect(reordered.contextLength).toBe(40_960)
  })

  it('ignores context-length keys whose arch prefix does not match and reads u64 values', async () => {
    const metadata = await readGgufMetadataFromBytes(header(3, 0, [
      kv('general.architecture', 8, rawString('qwen3')),
      kv('llama.context_length', 10, u64(2048)),
      kv('qwen3.context_length', 10, u64(65_536)),
    ]))
    expect(metadata.contextLength).toBe(65_536)
  })

  it('skips string and scalar arrays without materializing them', async () => {
    const vocab = Array.from({ length: 500 }, (_, index) => `token-${index}`)
    const metadata = await readGgufMetadataFromBytes(header(3, 0, [
      kv('tokenizer.ggml.tokens', 9, u32(8), u64(vocab.length), ...vocab.map(rawString)),
      kv('tokenizer.ggml.scores', 9, u32(6), u64(vocab.length), ...vocab.map(() => f32(0))),
      kv('general.architecture', 8, rawString('qwen3')),
      kv('qwen3.context_length', 4, u32(32_768)),
    ]))
    expect(metadata.architecture).toBe('qwen3')
    expect(metadata.contextLength).toBe(32_768)
  })

  it('rejects nested arrays, unknown value types, and unknown element types', async () => {
    await expect(readGgufMetadataFromBytes(header(3, 0, [
      kv('bad.nested', 9, u32(9), u64(1), u32(0), u64(0)),
    ]))).rejects.toThrow(/nested arrays/)
    await expect(readGgufMetadataFromBytes(header(3, 0, [
      kv('bad.tag', 13, u32(0)),
    ]))).rejects.toThrow(/unknown value type 13/)
    await expect(readGgufMetadataFromBytes(header(3, 0, [
      kv('bad.elements', 9, u32(42), u64(1), u32(0)),
    ]))).rejects.toThrow(/element type 42/)
  })

  it('renders unknown file_type enums as the documented fallback', async () => {
    const metadata = await readGgufMetadataFromBytes(header(3, 0, [kv('general.file_type', 4, u32(999))]))
    expect(metadata.quantization).toBe('ftype-999')
  })

  it('rejects absurd counts before allocating', async () => {
    await expect(readGgufMetadataFromBytes(bytes(MAGIC, u32(3), u64(0), u64(10 ** 12)))).rejects.toThrow(/kv count .* exceeds cap/)
    await expect(readGgufMetadataFromBytes(bytes(MAGIC, u32(3), u64(10 ** 9), u64(0)))).rejects.toThrow(/tensor count .* exceeds cap/)
  })

  it('reads the same metadata from a real file carrying a large body', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gguf-reader-'))
    try {
      const path = join(dir, 'model.gguf')
      await writeFile(path, bytes(header(3, 1, SAMPLE_KVS), new Uint8Array(1024 * 1024)))
      expect(await readGgufMetadataFromFile(path)).toEqual(await readGgufMetadataFromBytes(header(3, 1, SAMPLE_KVS)))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects a truncated file mid-field', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gguf-reader-'))
    try {
      const path = join(dir, 'partial.gguf')
      await writeFile(path, bytes(header(3, 1, SAMPLE_KVS)).subarray(0, 20))
      await expect(readGgufMetadataFromFile(path)).rejects.toThrow(/mid-field/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
