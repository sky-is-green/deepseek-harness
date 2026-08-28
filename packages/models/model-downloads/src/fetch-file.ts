/**
 * Resumable single-file fetch: Range continuation from a `.part` sibling,
 * loud status handling, post-download sha256 verification against the probe
 * expectation, and atomic rename into place.
 * @module
 */

import { createReadStream, createWriteStream } from 'node:fs'
import { rename, rm, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { resolveRemoteFile } from './resolve.ts'
import type { DownloadProgress, FetchOutcome, RemoteFileInfo, RemoteFileRef } from './types.ts'

/**
 * Staging path holding partially received bytes between attempts.
 * @param destinationPath - final file path the download targets.
 * @returns the sibling `.part` path used for resume.
 */
export function partPathFor(destinationPath: string): string {
  return `${destinationPath}.part`
}

/** Options for one resumable file fetch. */
export interface FetchToFileOptions {
  readonly baseUrl: string
  readonly ref: RemoteFileRef
  readonly destinationPath: string
  /** Aborts connect, transfer, or the whole attempt; the `.part` file is kept for resume. */
  readonly signal?: AbortSignal
  /** Called once per received chunk; emission cadence policy belongs to the caller. */
  readonly onProgress?: (progress: DownloadProgress) => void
}

/** A staged part whose size disagrees with the hub gets exactly one clean restart. */
const MAX_PART_RESTARTS = 1

/**
 * Fetch one remote file to disk, resuming from a previous `.part` when the
 * server honors ranges. Success renames the part onto the destination after
 * verifying the advertised sha256; cancellation keeps the part for the next
 * attempt; failures throw with the offending status or digest.
 * @param options - hub location, file reference, destination, abort signal, and progress sink.
 * @returns completion with the final byte count, or `cancelled` when the signal fired first.
 */
export async function fetchToFile(options: FetchToFileOptions): Promise<FetchOutcome> {
  if (options.signal?.aborted) return { result: 'cancelled' }
  const info = await resolveRemoteFile(options.baseUrl, options.ref)
  if (options.signal?.aborted) return { result: 'cancelled' }
  const partPath = partPathFor(options.destinationPath)

  const complete = async (): Promise<FetchOutcome> => {
    await finalize(partPath, options.destinationPath, info)
    return { result: 'completed', bytesReceived: (await stat(options.destinationPath)).size }
  }

  let restarts = 0
  while (true) {
    let baseOffset = 0
    try {
      baseOffset = (await stat(partPath)).size
    } catch {
      // Absent part: the fetch starts from zero.
    }

    const headers: Record<string, string> = baseOffset > 0 ? { range: `bytes=${baseOffset}-` } : {}
    let response: Response
    try {
      response = await fetch(info.url, {
        headers,
        redirect: 'follow',
        ...(options.signal !== undefined && { signal: options.signal }),
      })
    } catch (error) {
      if (options.signal?.aborted) return { result: 'cancelled' }
      throw error
    }

    if (response.status === 416 && baseOffset > 0) {
      // The staged part is complete but was never renamed (a crash between
      // download and finalize lands here). Sizes agreeing means verify-and-
      // place; a stale wrong-size part gets one clean restart.
      if (info.totalBytes === null || baseOffset !== info.totalBytes) {
        if (restarts >= MAX_PART_RESTARTS) {
          throw new Error(`model-downloads: staged part for ${basename(options.destinationPath)} holds ${baseOffset} bytes, expected ${info.totalBytes ?? 'an unknown total'}`)
        }
        restarts += 1
        await rm(partPath, { force: true })
        continue
      }
      return complete()
    }

    if (!response.ok) {
      await response.body?.cancel().catch(function () {
        // Socket release is best-effort; the loud status error is what matters.
      })
      throw new Error(`model-downloads: fetching ${options.ref.repo}/${options.ref.file} failed with HTTP ${response.status}`)
    }

    const resumed = response.status === 206
    const offset = resumed ? baseOffset : 0
    const body = response.body
    if (body === null) {
      throw new Error(`model-downloads: empty response body for ${options.ref.repo}/${options.ref.file}`)
    }
    const lengthHeader = response.headers.get('content-length')
    const chunkTotal = lengthHeader !== null && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : null
    const bytesTotal = chunkTotal !== null ? offset + chunkTotal : info.totalBytes

    try {
      // undici's Response.body is a web ReadableStream; fromWeb consumes the
      // structural node:stream/web form of the same object.
      await pipeline(
        Readable.fromWeb(body as import('node:stream/web').ReadableStream<Uint8Array>),
        async function* (chunks: AsyncIterable<Uint8Array>) {
          let received = offset
          for await (const chunk of chunks) {
            received += chunk.length
            options.onProgress?.({ bytesReceived: received, bytesTotal })
            yield chunk
          }
        },
        createWriteStream(partPath, { flags: resumed ? 'a' : 'w' }),
      )
    } catch (error) {
      if (options.signal?.aborted) return { result: 'cancelled' }
      throw error
    }
    return complete()
  }
}

/**
 * Place a fully downloaded part: atomic rename followed by sha256
 * verification when the hub advertised one; a mismatch deletes the written
 * file rather than leaving poisoned weights in the catalog.
 */
async function finalize(partPath: string, destinationPath: string, info: RemoteFileInfo): Promise<void> {
  await rename(partPath, destinationPath)
  if (info.expectedSha256 !== null) {
    const actual = await sha256Hex(destinationPath)
    if (actual !== info.expectedSha256) {
      await rm(destinationPath, { force: true })
      throw new Error(
        `model-downloads: integrity check failed for ${basename(destinationPath)}: expected sha256 ${info.expectedSha256}, received ${actual}`,
      )
    }
  }
}

async function sha256Hex(path: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}
