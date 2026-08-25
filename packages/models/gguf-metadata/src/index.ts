/**
 * Isomorphic GGUF header reader: parse metadata from an in-memory buffer
 * without touching Node builtins, so browser consumers (fit estimators) share
 * the exact parser. File-hosted reading lives in `./node`.
 * @module @deepseek-ai/dsh-gguf-metadata
 */

import { BufferByteSource } from './reader.ts'
import { parseGgufMetadata } from './parser.ts'
import type { GgufMetadata } from './types.ts'

export { GgufError } from './reader.ts'
export type { GgufMetadata } from './types.ts'

/**
 * Parse one GGUF header from bytes.
 * @param bytes - a buffer whose first byte is the file's first byte; only the header region is consumed.
 * @returns the metadata fields present in the header.
 * @throws {GgufError} when the bytes are not a parseable GGUF v2/v3 header.
 */
export async function readGgufMetadataFromBytes(bytes: Uint8Array): Promise<GgufMetadata> {
  return parseGgufMetadata(new BufferByteSource(bytes))
}
