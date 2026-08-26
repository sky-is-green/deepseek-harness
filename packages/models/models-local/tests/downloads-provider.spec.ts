import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { localModelId } from '@deepseek-ai/dsh-models'
import ModelsLocal from '@deepseek-ai/dsh-models-local'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { createHubServer } from '../../model-downloads/tests/hub-server.mjs'
import type { HubState } from '../../model-downloads/tests/hub-server.mjs'

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

function bytes(...parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function rawString(value: string): Uint8Array {
  return bytes(u64(value.length), new TextEncoder().encode(value))
}

/** A parseable GGUF payload so a completed download yields a real catalog entry. */
const PAYLOAD = Buffer.from(bytes(
  u32(0x47_47_55_46),
  u32(3),
  u64(0),
  u64(2),
  bytes(rawString('general.architecture'), u32(8), rawString('qwen3')),
  bytes(rawString('qwen3.context_length'), u32(4), u32(32_768)),
))

const FILE = 'dl-model.gguf'
const REQUEST = {
  source: { kind: 'huggingface', repo: 'org/repo', file: FILE },
  name: 'DL Qwen',
  kind: 'llm',
} as const

let server: import('node:http').Server
let state: HubState
let dir = ''

/** Narrow a bound server's address to its numeric loopback port. */
function portOf(httpServer: import('node:http').Server): number {
  const address = httpServer.address()
  if (address === null || typeof address === 'string') throw new Error('hub fixture has no port')
  return address.port
}

beforeAll(async () => {
  const hub = createHubServer(PAYLOAD)
  server = hub.server
  state = hub.state
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  dir = await mkdtemp(join(tmpdir(), 'models-local-downloads-'))
})

afterAll(async () => {
  server.close()
  if (dir.length > 0) await rm(dir, { recursive: true, force: true })
})

async function mount(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(ModelsLocal, {
    serverBinary: process.execPath,
    modelsDir: dir,
    basePort: 18_420,
    healthPollMs: 60,
    hubBaseUrl: `http://127.0.0.1:${portOf(server)}`,
    downloadProgressMs: 20,
  })
  return ctx
}

describe('models-local downloads', () => {
  it('streams into modelsDir and lands the entry in the catalog at completion', async () => {
    const ctx = await mount()
    const events: string[] = []
    let catalogGrowth = 0
    ctx.on('models/download-started', () => events.push('started'))
    ctx.on('models/download-progress', () => events.push('progress'))
    ctx.on('models/download-settled', () => events.push('settled'))
    ctx.on('models/catalog-updated', ({ entries }) => {
      if (entries.some(entry => entry.id === localModelId(FILE))) catalogGrowth += 1
    })

    const handle = await ctx.models.startDownload({ ...REQUEST })
    expect(handle.id.length).toBeGreaterThan(0)
    const running = ctx.models.downloads()
    expect(running).toHaveLength(1)
    const snapshot = running[0]
    if (snapshot === undefined) throw new Error('accepted download missing from the board')
    expect(snapshot.destinationPath).toBe(join(dir, FILE))

    const outcome = await handle.done
    expect(events[0]).toBe('started')
    expect(events.at(-1)).toBe('settled')
    expect(events).toContain('progress')
    expect(outcome.result).toBe('completed')
    if (outcome.result !== 'completed') return
    expect(outcome.entry).toMatchObject({
      id: localModelId(FILE),
      name: 'DL Qwen',
      architecture: 'qwen3',
      contextLength: 32_768,
      sizeBytes: PAYLOAD.length,
    })
    expect(await readFile(join(dir, FILE))).toEqual(PAYLOAD)
    await expect(stat(`${join(dir, FILE)}.part`)).rejects.toThrow()
    expect(catalogGrowth).toBeGreaterThanOrEqual(1)
    expect(ctx.models.downloads()).toEqual([])
    const models = await ctx.models.listModels()
    expect(models.some(entry => entry.id === localModelId(FILE))).toBe(true)
  })

  it('resumes a previously staged part instead of restarting', async () => {
    const ctx = await mount()
    await writeFile(`${join(dir, 'resume.gguf')}.part`, PAYLOAD.subarray(0, 100))
    const handle = await ctx.models.startDownload({
      source: { kind: 'huggingface', repo: 'org/repo', file: 'resume.gguf' },
      name: 'resume',
      kind: 'llm',
    })
    const outcome = await handle.done
    expect(outcome.result).toBe('completed')
    expect(state.lastRange).toBe('bytes=100-')
    expect((await readFile(join(dir, 'resume.gguf')))).toEqual(PAYLOAD)
  })

  it('cancels mid-flight, keeps the partial part, and settles exactly once', async () => {
    const ctx = await mount()
    const settlements: number[] = []
    ctx.on('models/download-settled', () => settlements.push(1))
    const slowRequest = { source: { kind: 'huggingface', repo: 'org/repo', file: 'slow.gguf' }, name: 'slow', kind: 'llm' } as const
    const handle = await ctx.models.startDownload({ ...slowRequest })
    await vi.waitFor(() => {
      expect(existsSync(join(dir, 'slow.gguf.part'))).toBe(true)
    })
    handle.cancel()
    const outcome = await handle.done
    expect(outcome).toEqual({ result: 'cancelled' })
    expect(settlements).toEqual([1])
    expect(ctx.models.downloads()).toEqual([])
    expect(existsSync(join(dir, 'slow.gguf'))).toBe(false)
  }, 10_000)

  it('settles failed with the integrity message and leaves no weights file', async () => {
    const ctx = await mount()
    const badRequest = { source: { kind: 'huggingface', repo: 'org/repo', file: 'bad.gguf' }, name: 'bad', kind: 'llm' } as const
    const handle = await ctx.models.startDownload({ ...badRequest })
    const outcome = await handle.done
    expect(outcome.result).toBe('failed')
    if (outcome.result !== 'failed') return
    expect(outcome.message).toMatch(/integrity check failed/)
    expect(existsSync(join(dir, 'bad.gguf'))).toBe(false)
  })

  it('refuses to overwrite an existing weights file before any handle exists', async () => {
    const ctx = await mount()
    await writeFile(join(dir, 'taken.gguf'), Buffer.from('occupied'))
    await expect(ctx.models.startDownload({
      source: { kind: 'huggingface', repo: 'org/repo', file: 'taken.gguf' },
      name: 'taken',
      kind: 'llm',
    })).rejects.toThrow(/refusing to overwrite/)
  })

  it('refuses non-GGUF targets and duplicate in-flight destinations without network traffic', async () => {
    const ctx = await mount()
    await expect(ctx.models.startDownload({
      source: { kind: 'huggingface', repo: 'org/repo', file: 'readme.txt' },
      name: 'txt',
      kind: 'llm',
    })).rejects.toThrow(/\.gguf weights only/)
    const dup = { source: { kind: 'huggingface', repo: 'org/repo', file: 'dup.gguf' }, name: 'dup', kind: 'llm' } as const
    const first = await ctx.models.startDownload({ ...dup })
    await expect(ctx.models.startDownload({ ...dup })).rejects.toThrow(/already downloading/)
    await first.done
  })

  it('disposal cancels running jobs and awaits their settlement', async () => {
    const ctx = await mount()
    const handle = await ctx.models.startDownload({
      source: { kind: 'huggingface', repo: 'org/repo', file: 'slow-disposal.gguf' },
      name: 'slow',
      kind: 'llm',
    })
    await vi.waitFor(() => {
      expect(existsSync(join(dir, 'slow-disposal.gguf.part'))).toBe(true)
    })
    const settled = handle.done.then(outcome => outcome.result)
    await ctx.fiber.dispose()
    expect(await settled).toBe('cancelled')
  }, 10_000)
})
