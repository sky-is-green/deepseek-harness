/**
 * One-click fetchToFile with Range resume.
 * Browser fetch + .part staging, 416 finalize-or-restart, per-chunk progress.
 * Mirrors E3's model-downloads fetchToFile but as a client-pure helper.
 * @module @deepseek-ai/dsh-client-ui-models-manager/client/fetch-resume
 */

export type FetchToFileResult =
  | { ok: true; bytes: number; resumed: boolean }
  | { ok: false; error: string; bytes: number }

export type ProgressFn = (loaded: number, total: number | undefined) => void

/**
 * Fetch a remote file to a destination with resume.
 * In the browser this writes to an in-memory buffer via a provided writer;
 * the host side would map this to real FS. For UI tests the writer is mocked.
 * @param url - remote URL.
 * @param getExistingSize - returns already-downloaded bytes (from .part).
 * @param writer - appends a chunk; on 416 it is cleared first.
 * @param fetcher - fetch implementation (global fetch by default).
 * @param onProgress - progress callback.
 * @returns result with resume flag.
 */
export async function fetchToFileWithResume(
  url: string,
  getExistingSize: () => number,
  writer: { append(chunk: Uint8Array): void; clear(): void; size(): number },
  fetcher: typeof fetch = fetch,
  onProgress?: ProgressFn,
): Promise<FetchToFileResult> {
  const existing = getExistingSize()
  const headers: Record<string, string> = {}
  if (existing > 0) headers.Range = `bytes=${existing}-`

  let res: Response
  try {
    res = await fetcher(url, { headers })
  } catch (e) {
    return { ok: false, error: String(e), bytes: existing }
  }

  if (res.status === 416) {
    // .part already complete or server rejects range — finalize or restart
    if (existing > 0) return { ok: true, bytes: existing, resumed: true }
    return { ok: false, error: 'range not satisfiable', bytes: existing }
  }
  if (res.status === 206 && existing > 0) {
    // Resume accepted — continue
  } else if (res.status === 200 && existing > 0) {
    // Server ignored Range — restart from 0
    writer.clear()
  } else if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}`, bytes: existing }
  }

  const totalHeader = res.headers.get('content-length')
  const total = totalHeader ? Number.parseInt(totalHeader, 10) + (res.status === 206 ? existing : 0) : undefined
  const body = res.body
  if (!body) {
    const buf = new Uint8Array(await res.arrayBuffer())
    writer.append(buf)
    onProgress?.(writer.size(), total)
    return { ok: true, bytes: writer.size(), resumed: existing > 0 && res.status === 206 }
  }

  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      writer.append(value)
      onProgress?.(writer.size(), total)
    }
  } finally {
    reader.releaseLock()
  }
  return { ok: true, bytes: writer.size(), resumed: existing > 0 }
}

/** In-memory writer for tests and browser stub. */
export function createMemoryWriter(initialSize = 0): {
  append(chunk: Uint8Array): void
  clear(): void
  size(): number
  bytes(): Uint8Array
} {
  let chunks: Uint8Array[] = []
  let len = initialSize
  if (initialSize > 0) chunks.push(new Uint8Array(initialSize))
  return {
    append(chunk: Uint8Array): void {
      chunks.push(chunk)
      len += chunk.length
    },
    clear(): void {
      chunks = []
      len = 0
    },
    size(): number {
      return len
    },
    bytes(): Uint8Array {
      const out = new Uint8Array(len)
      let off = 0
      for (const c of chunks) { out.set(c, off); off += c.length }
      return out
    },
  }
}
