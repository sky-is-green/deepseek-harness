/**
 * Byte-source abstraction and the in-memory implementation for the GGUF
 * header parser. The parser consumes any {@link GgufByteSource}, so the same
 * code path serves full buffers (isomorphic) and positioned file reads
 * (`./node`) without loading weight files into memory.
 * @module
 */

/** Thrown when a byte sequence is not a parseable GGUF header. */
export class GgufError extends Error {
  constructor(message: string) {
    super(`gguf: ${message}`)
    this.name = 'GgufError'
  }
}

/**
 * A sequential cursor over the header bytes. `read` resolves exactly `n`
 * bytes or rejects; `skip` advances without materializing bytes but still
 * rejects when fewer than `n` remain, so truncation is detected uniformly.
 */
export interface GgufByteSource {
  read(n: number): Promise<Uint8Array>
  skip(n: number): Promise<void>
}

/** In-memory source over one complete buffer (the isomorphic entry path). */
export class BufferByteSource implements GgufByteSource {
  #position = 0

  constructor(private readonly bytes: Uint8Array) {}

  read(n: number): Promise<Uint8Array> {
    if (this.#position + n > this.bytes.length) return Promise.reject(new GgufError('header ends mid-field'))
    const view = this.bytes.subarray(this.#position, this.#position + n)
    this.#position += n
    return Promise.resolve(view)
  }

  skip(n: number): Promise<void> {
    if (this.#position + n > this.bytes.length) return Promise.reject(new GgufError('header ends mid-field'))
    this.#position += n
    return Promise.resolve()
  }
}
