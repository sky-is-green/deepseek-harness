/**
 * GGUF v2/v3 header parser over a {@link GgufByteSource}. Walks the key-value
 * section once, materializing only the fields consumers need and skipping
 * array payloads (vocabularies, token lists) by arithmetic, so multi-GB
 * weight files parse from their first kilobytes.
 * @module
 */

import { GgufError } from './reader.ts'
import type { GgufByteSource } from './reader.ts'
import type { GgufMetadata } from './types.ts'

/** 'GGUF' as the little-endian u32 the format pins. */
const GGUF_MAGIC = 0x47_47_55_46

/** Container versions this reader parses; anything else fails loud. */
const SUPPORTED_FORMAT_VERSIONS = new Set([2, 3])

// Fixed protocol/safety caps mirroring the external GGUF spec's practical
// limits — not deployment tunables. They make hostile or corrupt headers fail
// loudly instead of allocating without bound.
const MAX_KV_PAIRS = 100_000
const MAX_TENSOR_COUNT = 1_000_000
const MAX_KEY_BYTES = 4096
const MAX_STRING_BYTES = 64 * 1024 * 1024
const MAX_ARRAY_ELEMENTS = 100_000_000
const MAX_HEADER_BYTES = 512 * 1024 * 1024

/** Byte size of every scalar value tag; strings and arrays are sized dynamically. */
const SCALAR_SIZES: Readonly<Record<number, number>> = {
  0: 1, // u8
  1: 1, // i8
  2: 2, // u16
  3: 2, // i16
  4: 4, // u32
  5: 4, // i32
  6: 4, // f32
  7: 1, // bool
  10: 8, // u64
  11: 8, // i64
  12: 8, // f64
}

/**
 * Quantization labels for the `general.file_type` enum, mirroring llama.cpp's
 * `LLAMA_FTYPE_*` values. Unknown values render as `ftype-N`; new upstream
 * enum members extend this table.
 */
const FILE_TYPE_NAMES: Readonly<Record<number, string>> = {
  0: 'F32',
  1: 'F16',
  2: 'Q4_0',
  3: 'Q4_1',
  4: 'Q4_1_SOME_F16',
  5: 'Q4_2',
  6: 'Q4_3',
  7: 'Q8_0',
  8: 'Q5_0',
  9: 'Q5_1',
  10: 'Q2_K',
  11: 'Q3_K_S',
  12: 'Q3_K_M',
  13: 'Q3_K_L',
  14: 'Q4_K_S',
  15: 'Q4_K_M',
  16: 'Q5_K_S',
  17: 'Q5_K_M',
  18: 'Q6_K',
  19: 'IQ2_XXS',
  20: 'IQ2_XS',
  21: 'Q2_K_S',
  22: 'IQ3_XXS',
  23: 'IQ1_S',
  24: 'IQ4_NL',
  25: 'IQ3_S',
  26: 'IQ2_S',
  27: 'IQ4_XS',
  28: 'IQ1_M',
  29: 'BF16',
  30: 'Q4_0_4_4',
  31: 'Q4_0_4_8',
  32: 'Q4_0_8_8',
  33: 'TQ1_0',
  34: 'TQ2_0',
}

/** Parser cursor: reads scalars/strings and bounds every consumption. */
class SourceReader {
  #consumed = 0

  constructor(private readonly source: GgufByteSource) {}

  private account(n: number): void {
    this.#consumed += n
    if (this.#consumed > MAX_HEADER_BYTES) {
      throw new GgufError(`header exceeds ${MAX_HEADER_BYTES} bytes — not a GGUF metadata section`)
    }
  }

  async bytes(n: number): Promise<Uint8Array> {
    this.account(n)
    return this.source.read(n)
  }

  async skip(n: number): Promise<void> {
    this.account(n)
    await this.source.skip(n)
  }
}

// DataView.from does not exist; use a small helper instead.
function dataViewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

async function readUnsigned(reader: SourceReader, size: 4 | 8): Promise<number> {
  const view = dataViewOf(await reader.bytes(size))
  const value = size === 4 ? view.getUint32(0, true) : view.getBigUint64(0, true)
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new GgufError(`u64 field exceeds ${Number.MAX_SAFE_INTEGER}`)
    }
    return Number(value)
  }
  return value
}

async function readString(reader: SourceReader): Promise<string> {
  const length = await readUnsigned(reader, 8)
  if (length > MAX_STRING_BYTES) throw new GgufError(`string of ${length} bytes exceeds cap`)
  const bytes = await reader.bytes(length)
  return new TextDecoder().decode(bytes)
}

interface CapturedFields {
  architecture?: string
  name?: string
  fileType?: number
  chatTemplate?: string
  contextCandidates: Map<string, number>
}

/** Read one scalar/string/array value; capture interesting keys, skip the rest. */
async function readValue(
  reader: SourceReader,
  tag: number,
  key: string,
  captured: CapturedFields,
): Promise<void> {
  const scalarSize = SCALAR_SIZES[tag]
  if (tag === 8) {
    const value = await readString(reader)
    if (key === 'general.architecture') captured.architecture = value
    else if (key === 'general.name') captured.name = value
    else if (key === 'tokenizer.chat_template') captured.chatTemplate = value
    return
  }
  if (tag === 9) {
    const elementTag = await readUnsigned(reader, 4)
    if (elementTag === 9) throw new GgufError('nested arrays are not valid GGUF values')
    if (elementTag === 8) {
      const count = await readUnsigned(reader, 8)
      if (count > MAX_ARRAY_ELEMENTS) throw new GgufError(`array of ${count} elements exceeds cap`)
      for (let index = 0; index < count; index += 1) {
        const length = await readUnsigned(reader, 8)
        if (length > MAX_STRING_BYTES) throw new GgufError(`string of ${length} bytes exceeds cap`)
        await reader.skip(length)
      }
      return
    }
    const elementSize = SCALAR_SIZES[elementTag]
    if (elementSize === undefined) throw new GgufError(`array element type ${elementTag} is not a value type`)
    const count = await readUnsigned(reader, 8)
    if (count > MAX_ARRAY_ELEMENTS) throw new GgufError(`array of ${count} elements exceeds cap`)
    await reader.skip(count * elementSize)
    return
  }
  if (scalarSize === undefined) throw new GgufError(`unknown value type ${tag} for key "${key}"`)
  const bytes = await reader.bytes(scalarSize)
  if (key === 'general.file_type' && tag === 4) {
    captured.fileType = dataViewOf(bytes).getUint32(0, true)
  }
  const contextMatch = /^(.+)\.context_length$/.exec(key)
  if (contextMatch !== null && (tag === 4 || tag === 10)) {
    const view = dataViewOf(bytes)
    const value = tag === 4 ? view.getUint32(0, true) : Number(view.getBigUint64(0, true))
    const archPrefix = contextMatch[1]
    if (archPrefix === undefined) throw new GgufError(`malformed context_length key "${key}"`)
    captured.contextCandidates.set(archPrefix, value)
  }
}

/**
 * Parse one GGUF header from a byte source.
 * @param source - sequential cursor positioned at the file's first byte.
 * @returns the metadata fields present in the header.
 * @throws {GgufError} on bad magic, unsupported version, truncation, spec violations, or cap overflow.
 */
export async function parseGgufMetadata(source: GgufByteSource): Promise<GgufMetadata> {
  const reader = new SourceReader(source)
  const magic = await readUnsigned(reader, 4)
  if (magic !== GGUF_MAGIC) throw new GgufError('bad magic — not a GGUF file')
  const version = await readUnsigned(reader, 4)
  if (!SUPPORTED_FORMAT_VERSIONS.has(version)) {
    throw new GgufError(`unsupported GGUF version ${version} (supported: 2, 3)`)
  }
  const tensorCount = await readUnsigned(reader, 8)
  if (tensorCount > MAX_TENSOR_COUNT) throw new GgufError(`tensor count ${tensorCount} exceeds cap`)
  const kvCount = await readUnsigned(reader, 8)
  if (kvCount > MAX_KV_PAIRS) throw new GgufError(`kv count ${kvCount} exceeds cap`)

  const captured: CapturedFields = { contextCandidates: new Map() }
  for (let index = 0; index < kvCount; index += 1) {
    const keyLength = await readUnsigned(reader, 8)
    if (keyLength > MAX_KEY_BYTES) throw new GgufError(`key of ${keyLength} bytes exceeds cap`)
    const keyBytes = await reader.bytes(keyLength)
    const key = new TextDecoder().decode(keyBytes)
    const tag = await readUnsigned(reader, 4)
    await readValue(reader, tag, key, captured)
  }

  const architecture = captured.architecture
  const contextLength = architecture === undefined ? undefined : captured.contextCandidates.get(architecture)
  const quantization = captured.fileType === undefined
    ? undefined
    : FILE_TYPE_NAMES[captured.fileType] ?? `ftype-${captured.fileType}`
  return {
    formatVersion: version,
    ...(architecture !== undefined && { architecture }),
    ...(captured.name !== undefined && { name: captured.name }),
    ...(quantization !== undefined && { quantization }),
    ...(contextLength !== undefined && { contextLength }),
    ...(captured.chatTemplate !== undefined && { chatTemplate: captured.chatTemplate }),
  }
}
