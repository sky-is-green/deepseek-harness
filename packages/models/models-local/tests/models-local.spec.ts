import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { localModelId, ModelsRuntime } from '@deepseek-ai/dsh-models'
import ModelsLocal from '@deepseek-ai/dsh-models-local'
import type { ModelsLocalConfig } from '@deepseek-ai/dsh-models-local'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'

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

async function writeMinimalGguf(path: string, name: string): Promise<void> {
  const kvs = [
    bytes(rawString('general.architecture'), u32(8), rawString('qwen3')),
    bytes(rawString('general.name'), u32(8), rawString(name)),
    bytes(rawString('qwen3.context_length'), u32(4), u32(32_768)),
  ]
  await writeFile(path, bytes(
    u32(0x47_47_55_46),
    u32(3),
    u64(0),
    u64(kvs.length),
    ...kvs,
  ))
}

const FAKE_SERVER = new URL('./fake-server.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

let dir = ''

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'models-local-'))
  await writeMinimalGguf(join(dir, 'qwen3-4b.gguf'), 'Qwen3 4B')
})

afterAll(async () => {
  if (dir.length > 0) await rm(dir, { recursive: true, force: true })
})

function config(overrides: Partial<ModelsLocalConfig> = {}): ModelsLocalConfig {
  return {
    serverBinary: process.execPath,
    modelsDir: dir,
    basePort: 18_320,
    loadTimeoutMs: 5_000,
    healthPollMs: 60,
    extraArgs: [FAKE_SERVER],
    ...overrides,
  }
}

async function mount(overrides: Partial<ModelsLocalConfig> = {}): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(ModelsLocal, config(overrides))
  return ctx
}

const MODEL = localModelId('qwen3-4b.gguf')

describe('models-local provider', () => {
  it('scans the GGUF directory into seam catalog entries and emits the snapshot', async () => {
    const ctx = new Context()
    const seen: number[] = []
    ctx.on('models/catalog-updated', ({ entries }) => {
      seen.push(entries.length)
    })
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(ModelsLocal, config())
    const models = await ctx.models.listModels()
    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      id: MODEL,
      name: 'Qwen3 4B',
      kind: 'llm',
      format: 'gguf',
      architecture: 'qwen3',
      contextLength: 32_768,
    })
    expect(seen).toEqual([1])
  })

  it('loads through spawn + /health to loaded, with the committed transition grammar', async () => {
    const ctx = await mount()
    const states: string[] = []
    ctx.on('models/load-state', ({ state }) => {
      states.push(state.status)
    })
    await ctx.models.requestLoad({ modelId: MODEL })
    expect(states).toEqual(['loading', 'loaded'])
    expect(ctx.models.loadState(MODEL)).toMatchObject({ status: 'loaded', contextLength: 32_768 })
    await ctx.models.requestUnload(MODEL)
    expect(ctx.models.loadState(MODEL)).toEqual({ status: 'unloaded' })
  }, 20_000)

  it('reports failed when the server never becomes healthy inside the budget', async () => {
    const ctx = await mount({ loadTimeoutMs: 400, extraArgs: [FAKE_SERVER, '--health-delay', '5000'] })
    await expect(ctx.models.requestLoad({ modelId: MODEL })).rejects.toThrow(/not ready within/)
    expect(ctx.models.loadState(MODEL)).toMatchObject({ status: 'failed' })
  }, 20_000)

  it('aborts a load back to unloaded when the signal fires mid-warm-up', async () => {
    const ctx = await mount({ loadTimeoutMs: 10_000, extraArgs: [FAKE_SERVER, '--health-delay', '5000'] })
    const controller = new AbortController()
    setTimeout(function () {
      controller.abort()
    }, 300)
    await expect(ctx.models.requestLoad({ modelId: MODEL }, controller.signal)).rejects.toThrow(/aborted/)
    expect(ctx.models.loadState(MODEL)).toEqual({ status: 'unloaded' })
  }, 20_000)

  it('refuses a second concurrent load and unload of a non-loaded model', async () => {
    const ctx = await mount()
    await expect(ctx.models.requestUnload(MODEL)).rejects.toThrow(/nothing to unload/)
    const slow = ctx.models.requestLoad({ modelId: MODEL }, undefined)
    void slow
    await ctx.models.requestLoad({ modelId: MODEL }).catch(() => {})
    await slow
    await expect(ctx.models.requestUnload(localModelId('absent.gguf'))).rejects.toThrow(/nothing to unload/)
    await ctx.models.requestUnload(MODEL)
  }, 20_000)

  it('refuses unknown models and starts with an empty download board', async () => {
    const ctx = await mount()
    await expect(ctx.models.requestLoad({ modelId: localModelId('nope.gguf') })).rejects.toThrow(/unknown model/)
    expect(ctx.models.downloads()).toEqual([])
  })

  it('serves one cached hardware summary from the probe library', async () => {
    const ctx = await mount()
    const first = await ctx.models.hardware()
    const second = await ctx.models.hardware()
    expect(second).toBe(first)
    expect(first.totalRamBytes).toBeGreaterThan(0)
    expect(Array.isArray(first.devices)).toBe(true)
  })

  it('stays assignable to the seam base class', async () => {
    const ctx = await mount()
    expect(ctx.models).toBeInstanceOf(ModelsRuntime)
  })
})
