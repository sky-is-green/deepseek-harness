/**
 * Node-hosted GGUF header reading: positioned reads over a file handle so
 * multi-GB weight files parse from their first kilobytes. The pure parsing
 * entry (`.`) stays browser-safe.
 * @module @deepseek-ai/dsh-gguf-metadata/node
 */

import { open } from 'node:fs/promises'
import { parseGgufMetadata } from './parser.ts'
import { GgufError } from './reader.ts'
import type { GgufMetadata } from './types.ts'

/** Read window per refill; headers never need more than a few refills. */
const READ_CHUNK_BYTES = 1024 * 1024

/** Minimal shape of an fs.promises.FileHandle this source needs. */
interface FileHandleLike {
  stat(): Promise<{ size: number }>
  read(buffer: Uint8Array, offset: number, length: number, position: number): Promise<{ bytesRead: number }>
  close(): Promise<void>
}

/**
 * Sequential cursor over a file's leading bytes using one sliding window;
 * skipping past the window repositions instead of reading.
 */
class FileByteSource {
  #fileOffset = 0
  #window: Uint8Array = new Uint8Array(0)
  #cursor = 0

  constructor(private readonly handle: FileHandleLike, private readonly fileSize: number) {}

  static async open(path: string): Promise<FileByteSource> {
    const handle = await open(path, 'r')
    return new FileByteSource(handle, (await handle.stat()).size)
  }

  /** Release the underlying handle; idempotent via fs semantics. */
  async close(): Promise<void> {
    await this.handle.close()
  }

  private get windowEnd(): number {
    return this.#fileOffset + this.#window.length
  }

  private async refill(needed: number): Promise<void> {
    while (this.windowEnd - this.#cursor < needed) {
      if (this.windowEnd >= this.fileSize) throw new GgufError('file ends mid-field')
      const remainder = this.#window.subarray(this.#cursor)
      const chunk = Math.min(
        Math.max(READ_CHUNK_BYTES, needed - remainder.length),
        this.fileSize - this.windowEnd,
      )
      const merged = new Uint8Array(remainder.length + chunk)
      merged.set(remainder)
      const read = await this.handle.read(merged, remainder.length, chunk, this.windowEnd)
      if (read.bytesRead === 0) throw new GgufError('file ends mid-field')
      this.#window = merged.subarray(0, remainder.length + read.bytesRead)
      this.#fileOffset += this.#cursor
      this.#cursor = 0
    }
  }

  async read(n: number): Promise<Uint8Array> {
    await this.refill(n)
    const view = this.#window.subarray(this.#cursor, this.#cursor + n)
    this.#cursor += n
    return view
  }

  skip(n: number): Promise<void> {
    const target = this.#cursor + n
    if (this.#fileOffset + this.#window.length >= target) {
      this.#cursor = target
      return Promise.resolve()
    }
    const absoluteTarget = this.#fileOffset + target
    if (absoluteTarget > this.fileSize) return Promise.reject(new GgufError('file ends mid-field'))
    // Rebase onto the absolute offset and drop the window; the next refill
    // reads from there.
    this.#window = new Uint8Array(0)
    this.#cursor = 0
    this.#fileOffset = absoluteTarget
    return Promise.resolve()
  }
}

export { GgufError }

/**
 * Parse one GGUF header from a file on disk.
 * @param path - path of the weights file.
 * @returns the metadata fields present in its header.
 * @throws {GgufError} when the file is not a parseable GGUF v2/v3 file.
 */
export async function readGgufMetadataFromFile(path: string): Promise<GgufMetadata> {
  const source = await FileByteSource.open(path)
  try {
    return await parseGgufMetadata(source)
  } finally {
    await source.close()
  }
}
