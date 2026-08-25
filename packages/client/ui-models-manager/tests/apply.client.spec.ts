/**
 * ui-models-manager browser half on a real cordis Context with a stub
 * ModelsRuntime provider: the plugin body mounts the read model, mirrors
 * the service's event stream, registers the settings.section entry whose
 * inject face binds the store and the service callbacks, and everything
 * folds up on fiber disposal (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import ModelsRuntime from '@deepseek-ai/dsh-models'
import type { LocalModelId } from '@deepseek-ai/dsh-models'
import { apply, inject } from '../src/client/index.ts'

const sid = (value: string): LocalModelId => value as LocalModelId

/** The inject face's test view (structural subset of ModelsSectionInjected). */
interface TestFace {
  hooks: {
    models: {
      getSnapshot(): {
        entries: { id: string; name: string }[]
        states: Record<string, unknown>
        downloads: readonly unknown[]
      }
    }
  }
  requestLoad(id: LocalModelId): void
  startDownload(repo: string, file: string, name: string, kind: 'llm'): void
  cancelDownload(id: string): void
}

class StubModels extends ModelsRuntime {
  private readonly listeners = new Map<string, Set<(payload: never) => void>>()
  readonly loadRequested = vi.fn()
  readonly unloadRequested = vi.fn()

  async listModels() {
    return [{ id: sid('m1'), name: 'Qwen3 0.6B', kind: 'llm' as const, format: 'gguf' as const, path: '/m.gguf', sizeBytes: 1024 }]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hardware() {
    return Promise.resolve({ devices: [], totalRamBytes: 0 })
  }

  loadState(_modelId: LocalModelId) {
    return { status: 'unloaded' } as const
  }

  async requestLoad(request: { modelId: LocalModelId }) {
    this.loadRequested(request.modelId)
    this.emit('models/load-state', { modelId: request.modelId, state: { status: 'loaded' } })
  }

  async requestUnload(modelId: LocalModelId) {
    this.unloadRequested(modelId)
  }

  async startDownload() {
    const snapshot = {
      id: 'd1' as never,
      request: { source: { kind: 'huggingface' as const, repo: 'o/r', file: 'f.gguf' }, name: 'f', kind: 'llm' as const },
      destinationPath: '/f.gguf',
      bytesReceived: 0,
      bytesTotal: null,
    }
    this.emit('models/download-started', { download: snapshot })
    return { ...snapshot, cancel: () => {}, done: Promise.resolve({ result: 'cancelled' } as const) }
  }

  downloads(): [] {
    return []
  }

  /** Test-only emit mirroring the Service event grammar. */
  emit(type: 'models/load-state', payload: { modelId: LocalModelId; state: { status: 'loaded' } }): void
  emit(type: 'models/download-started', payload: { download: object }): void
  emit(type: string, payload: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(payload as never)
    this.ctx.events.emit(type, payload)
  }

  on(type: string, listener: (payload: never) => void): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => { set.delete(listener) }
  }
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  // The Service base constructor registers the instance as `models`.
  const models = new StubModels(ctx)
  void models
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  ctx.slots.register({
    name: 'root', children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, (() => null) as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots: ctx.slots, locale, fiber }
}

describe('ui-models-manager apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['locale', 'models', 'slots'])
  })

  it('registers the settings section and folds it up on disposal (HMR safety)', async () => {
    const b = await bench()
    const entry = b.slots.entries('settings.section').find(row => row.options.id === 'local-models')
    expect(entry).toBeDefined()
    expect(entry?.locale).toBe('models.manager')
    await b.fiber.dispose()
    expect(b.slots.entries('settings.section').find(row => row.options.id === 'local-models')).toBeUndefined()
  })

  it('the inject face routes actions to the service and mirrors its events into the read model', async () => {
    const b = await bench()
    const stub = b.ctx.get('models') as StubModels
    const face = (b.slots.entries('settings.section').find(row => row.options.id === 'local-models')!
      .inject as unknown as () => TestFace)()
    // The initial pull already mirrored the catalog.
    expect(face.hooks.models.getSnapshot().entries.map(e => e.name)).toEqual(['Qwen3 0.6B'])
    face.requestLoad(sid('m1'))
    expect(stub.loadRequested).toHaveBeenCalledWith('m1')
    // The service's load-state event landed in the store through the mirror.
    await vi.waitFor(() =>{  expect(face.hooks.models.getSnapshot().states.m1).toEqual({ status: 'loaded' }) })
    face.startDownload('o/r', 'f.gguf', 'f', 'llm')
    await vi.waitFor(() =>{  expect(face.hooks.models.getSnapshot().downloads ?? []).toBeDefined() })
    face.cancelDownload('d1')
  })
})
