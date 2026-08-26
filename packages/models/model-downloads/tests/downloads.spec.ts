import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fetchToFile, partPathFor } from '../src/index.ts'
import { resolveRemoteFile } from '../src/resolve.ts'
import { createHubServer } from './hub-server.mjs'

const PAYLOAD = Buffer.from(Array.from({ length: 1000 }, (_, index) => index % 251))
const BIG_PAYLOAD = randomBytes(3 * 1024 * 1024 + 17)

let server: http.Server
let state: Awaited<ReturnType<typeof createHubServer>>['state']
let baseUrl = ''
let dir = ''

/** Narrow a bound server's address to its numeric loopback port. */
function portOf(httpServer: http.Server): number {
  const address = httpServer.address()
  if (address === null || typeof address === 'string') throw new Error('hub fixture has no port')
  return address.port
}

beforeAll(async () => {
  const hub = createHubServer(PAYLOAD, { payloads: { 'big.gguf': BIG_PAYLOAD } })
  server = hub.server
  state = hub.state
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  baseUrl = `http://127.0.0.1:${portOf(server)}`
  dir = await mkdtemp(join(tmpdir(), 'model-downloads-'))
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    })
  })
  if (dir.length > 0) await rm(dir, { recursive: true, force: true })
})

describe('resolveRemoteFile', () => {
  it('surfaces resolved url, declared size, and the LFS-style digest', async () => {
    const info = await resolveRemoteFile(`${baseUrl}/`, { repo: 'org/repo', file: 'm.gguf' })
    expect(info.url).toBe(`${baseUrl}/org/repo/resolve/main/m.gguf`)
    expect(info.totalBytes).toBe(PAYLOAD.length)
    expect(info.expectedSha256).toBe(createHash('sha256').update(PAYLOAD).digest('hex'))
  })

  it('reports null totals and digest for absent hints and non-digest etags', async () => {
    const payload = Buffer.alloc(4, 7)
    const bare = createHubServer(payload, { etag: 'W/"deadbeef"' })
    try {
      await new Promise<void>((resolve) => {
        bare.server.listen(0, '127.0.0.1', () => resolve())
      })
      const info = await resolveRemoteFile(`http://127.0.0.1:${portOf(bare.server)}`, {
        repo: 'org/repo',
        file: 'm.gguf',
      })
      expect(info.expectedSha256).toBeNull()
      expect(info.totalBytes).toBe(payload.length)
    } finally {
      bare.server.closeAllConnections()
      bare.server.close()
    }
  })

  it('fails loud on a missing resource', async () => {
    await expect(resolveRemoteFile(baseUrl, { repo: 'org/missing', file: 'x.gguf' })).rejects.toThrow(/HTTP 404/)
  })
})

describe('fetchToFile', () => {
  it('downloads fresh, reports monotonic progress, and leaves no part behind', async () => {
    const destinationPath = join(dir, 'fresh.gguf')
    const progress: Array<{ bytesReceived: number; bytesTotal: number | null }> = []
    const outcome = await fetchToFile({
      baseUrl,
      ref: { repo: 'org/repo', file: 'big.gguf' },
      destinationPath,
      onProgress: sample => progress.push(sample),
    })
    expect(outcome).toEqual({ result: 'completed', bytesReceived: BIG_PAYLOAD.length })
    expect(await readFile(destinationPath)).toEqual(BIG_PAYLOAD)
    await expect(stat(partPathFor(destinationPath))).rejects.toThrow()
    expect(progress.length).toBeGreaterThanOrEqual(1)
    for (let index = 1; index < progress.length; index += 1) {
      const previous = progress[index - 1]
      const current = progress[index]
      if (previous === undefined || current === undefined) continue
      expect(current.bytesReceived).toBeGreaterThan(previous.bytesReceived)
    }
    expect(progress.at(-1)).toEqual({ bytesReceived: BIG_PAYLOAD.length, bytesTotal: BIG_PAYLOAD.length })
    await expect(readFile(destinationPath)).resolves.toEqual(BIG_PAYLOAD)
  }, 20_000)

  it('resumes from a staged part via a Range request and verifies the seeded digest', async () => {
    const destinationPath = join(dir, 'resume.gguf')
    await writeFile(partPathFor(destinationPath), PAYLOAD.subarray(0, 400))
    const outcome = await fetchToFile({ baseUrl, ref: { repo: 'org/repo', file: 'resume.gguf' }, destinationPath })
    expect(outcome).toEqual({ result: 'completed', bytesReceived: PAYLOAD.length })
    expect(state.lastRange).toBe('bytes=400-')
    expect(await readFile(destinationPath)).toEqual(PAYLOAD)
    await expect(stat(partPathFor(destinationPath))).rejects.toThrow()
  })

  it('restarts cleanly when the server ignores the Range request', async () => {
    state.ignoreRange = true
    try {
      const destinationPath = join(dir, 'restart.gguf')
      await writeFile(partPathFor(destinationPath), PAYLOAD.subarray(0, 400))
      const outcome = await fetchToFile({ baseUrl, ref: { repo: 'org/repo', file: 'restart.gguf' }, destinationPath })
      expect(outcome.result).toBe('completed')
      expect(await readFile(destinationPath)).toEqual(PAYLOAD)
    } finally {
      state.ignoreRange = false
    }
  })

  it('cancels mid-transfer and keeps the partial part for resume', async () => {
    const controller = new AbortController()
    const destinationPath = join(dir, 'slow.gguf')
    const pending = fetchToFile({
      baseUrl,
      ref: { repo: 'org/repo', file: 'slow.gguf' },
      destinationPath,
      signal: controller.signal,
    })
    await vi.waitFor(() => {
      expect(existsSync(partPathFor(destinationPath))).toBe(true)
    })
    controller.abort()
    await expect(pending).resolves.toEqual({ result: 'cancelled' })
    const partSize = (await stat(partPathFor(destinationPath))).size
    expect(partSize).toBeLessThan(PAYLOAD.length)
  }, 10_000)

  it('fails loud on a sha256 mismatch and removes the staged bytes', async () => {
    const destinationPath = join(dir, 'bad.gguf')
    await expect(fetchToFile({ baseUrl, ref: { repo: 'org/repo', file: 'bad.gguf' }, destinationPath }))
      .rejects.toThrow(/integrity check failed/)
    await expect(stat(destinationPath)).rejects.toThrow()
    await expect(stat(partPathFor(destinationPath))).rejects.toThrow()
  })

  it('fails loud on missing remote files', async () => {
    await expect(fetchToFile({ baseUrl, ref: { repo: 'org/missing', file: 'x.gguf' }, destinationPath: join(dir, 'x.gguf') }))
      .rejects.toThrow(/HTTP 404/)
  })

  it('finalizes a complete-but-unrenamed part when the server answers 416', async () => {
    state.respond416 = true
    try {
      const destinationPath = join(dir, 'done.gguf')
      await writeFile(partPathFor(destinationPath), PAYLOAD)
      const outcome = await fetchToFile({ baseUrl, ref: { repo: 'org/repo', file: 'done.gguf' }, destinationPath })
      expect(outcome).toEqual({ result: 'completed', bytesReceived: PAYLOAD.length })
      expect(await readFile(destinationPath)).toEqual(PAYLOAD)
      await expect(stat(partPathFor(destinationPath))).rejects.toThrow()
    } finally {
      state.respond416 = false
    }
  })

  it('reports cancelled without touching the destination when aborted before start', async () => {
    const controller = new AbortController()
    controller.abort()
    const destinationPath = join(dir, 'never.gguf')
    await expect(fetchToFile({
      baseUrl,
      ref: { repo: 'org/repo', file: 'never.gguf' },
      destinationPath,
      signal: controller.signal,
    })).resolves.toEqual({ result: 'cancelled' })
    await expect(stat(destinationPath)).rejects.toThrow()
    await expect(stat(partPathFor(destinationPath))).rejects.toThrow()
  })
})
