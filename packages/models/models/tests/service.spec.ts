import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  localModelId,
  modelDownloadId,
  ModelsRuntime,
} from '@deepseek-ai/dsh-models'
import type {
  HardwareSummary,
  ModelCatalogEntry,
  ModelDownloadHandle,
  ModelDownloadOutcome,
  ModelDownloadRequest,
  ModelDownloadSnapshot,
  ModelLoadRequest,
  ModelLoadState,
  LocalModelId,
} from '@deepseek-ai/dsh-models'

const ENTRY: ModelCatalogEntry = {
  id: localModelId('qwen3-4b-q4'),
  name: 'Qwen3 4B Q4_K_M',
  kind: 'llm',
  format: 'gguf',
  path: '/models/qwen3-4b-q4.gguf',
  sizeBytes: 2_500_000_000,
  architecture: 'qwen3',
  quantization: 'Q4_K_M',
  contextLength: 32_768,
}

/**
 * Minimal concrete service: an in-memory catalog whose transitions publish
 * exactly what the contract requires — state events after each commit, one
 * settle per download. This stub is all an implementation owes the abstract
 * class beyond its real runtime work.
 */
class StubModelsRuntime extends ModelsRuntime {
  private readonly states = new Map<LocalModelId, ModelLoadState>()
  private readonly running: ModelDownloadSnapshot[] = []
  private readonly settledIds = new Set<string>()
  private readonly settlements = new Map<string, (outcome: ModelDownloadOutcome) => void>()
  private nextDownloadId = 0

  async listModels(): Promise<readonly ModelCatalogEntry[]> {
    return [ENTRY]
  }

  async hardware(): Promise<HardwareSummary> {
    return {
      devices: [{ backend: 'vulkan', name: 'Stub GPU', memoryBytes: 8_589_934_592 }],
      totalRamBytes: 34_359_738_368,
    }
  }

  loadState(modelId: LocalModelId): ModelLoadState {
    return this.states.get(modelId) ?? { status: 'unloaded' }
  }

  async requestLoad(request: ModelLoadRequest): Promise<void> {
    this.commit(request.modelId, { status: 'loading' })
    this.commit(request.modelId, { status: 'loaded', contextLength: ENTRY.contextLength ?? 32_768 })
  }

  async requestUnload(modelId: LocalModelId): Promise<void> {
    this.commit(modelId, { status: 'unloading' })
    this.commit(modelId, { status: 'unloaded' })
  }

  async startDownload(request: ModelDownloadRequest): Promise<ModelDownloadHandle> {
    const id = modelDownloadId(`download-${this.nextDownloadId++}`)
    const snapshot: ModelDownloadSnapshot = {
      id,
      request,
      destinationPath: `/models/${request.name}.gguf`,
      bytesReceived: 0,
      bytesTotal: null,
    }
    this.running.push(snapshot)
    this.ctx.emit('models/download-started', { download: snapshot })
    let settle!: (outcome: ModelDownloadOutcome) => void
    const done = new Promise<ModelDownloadOutcome>((resolve) => {
      settle = resolve
    })
    this.settlements.set(id, settle)
    void done.then((outcome) => {
      this.ctx.emit('models/download-settled', { downloadId: id, outcome })
      const index = this.running.findIndex(candidate => candidate.id === id)
      if (index >= 0) this.running.splice(index, 1)
    })
    return {
      id,
      done,
      cancel: () => {
        this.finish(id, { result: 'cancelled' })
      },
    }
  }

  downloads(): readonly ModelDownloadSnapshot[] {
    return [...this.running]
  }

  /** Test driver: settle one running download as completed, producing {@link ENTRY}. */
  complete(id: string): void {
    this.finish(id, { result: 'completed', entry: ENTRY })
  }

  private finish(id: string, outcome: ModelDownloadOutcome): void {
    if (this.settledIds.has(id)) return
    const settle = this.settlements.get(id)
    if (settle === undefined) return
    this.settledIds.add(id)
    this.settlements.delete(id)
    settle(outcome)
  }

  private commit(modelId: LocalModelId, state: ModelLoadState): void {
    this.states.set(modelId, state)
    this.ctx.emit('models/load-state', { modelId, state })
  }
}

async function mount(): Promise<{ ctx: Context; runtime: StubModelsRuntime }> {
  const ctx = new Context()
  await ctx.plugin(StubModelsRuntime)
  return { ctx, runtime: ctx.models as StubModelsRuntime }
}

describe('ModelsRuntime seam', () => {
  it('a concrete subclass registers as ctx.models and serves the abstract API', async () => {
    const { ctx } = await mount()
    await expect(ctx.models.listModels()).resolves.toEqual([ENTRY])
    await expect(ctx.models.hardware()).resolves.toEqual({
      devices: [{ backend: 'vulkan', name: 'Stub GPU', memoryBytes: 8_589_934_592 }],
      totalRamBytes: 34_359_738_368,
    })
    expect(ctx.models.loadState(ENTRY.id)).toEqual({ status: 'unloaded' })
    expect(ctx.models.downloads()).toEqual([])
  })

  it('loading a second implementation throws (one models service per context — cordis standard)', async () => {
    const ctx = new Context()
    await ctx.plugin(StubModelsRuntime)
    class SecondService extends StubModelsRuntime {}
    await expect(ctx.plugin(SecondService)).rejects.toThrow(/service "models" has been registered/)
  })

  it('requestLoad publishes committed transitions in order and resolves at loaded', async () => {
    const { ctx } = await mount()
    const seen: Array<{ modelId: LocalModelId; state: ModelLoadState }> = []
    ctx.on('models/load-state', (payload) => {
      seen.push(payload)
    })
    await ctx.models.requestLoad({ modelId: ENTRY.id })
    expect(seen.map(event => event.state.status)).toEqual(['loading', 'loaded'])
    expect(ctx.models.loadState(ENTRY.id)).toEqual({
      status: 'loaded',
      contextLength: 32_768,
    })
  })

  it('requestUnload walks unloading back to unloaded', async () => {
    const { ctx } = await mount()
    await ctx.models.requestLoad({ modelId: ENTRY.id })
    await ctx.models.requestUnload(ENTRY.id)
    expect(ctx.models.loadState(ENTRY.id)).toEqual({ status: 'unloaded' })
  })

  it('a download runs start → progress → settled-completed once, then leaves downloads()', async () => {
    const { ctx, runtime } = await mount()
    const settled: Array<{ downloadId: string; outcome: ModelDownloadOutcome }> = []
    ctx.on('models/download-settled', (payload) => {
      settled.push(payload)
    })
    const request: ModelDownloadRequest = {
      source: { kind: 'huggingface', repo: 'ggml-org/gemma-3-4b-it-GGUF', file: 'model.Q4_K_M.gguf' },
      name: 'gemma-3-4b-q4',
      kind: 'llm',
    }
    const handle = await runtime.startDownload(request)
    const pending = runtime.downloads()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.bytesTotal).toBeNull()
    ctx.emit('models/download-progress', {
      downloadId: handle.id,
      bytesReceived: 1024,
      bytesTotal: 2048,
    })
    runtime.complete(handle.id)
    await handle.done
    expect(settled).toHaveLength(1)
    expect(settled[0]!.outcome).toEqual({ result: 'completed', entry: ENTRY })
    expect(runtime.downloads()).toEqual([])
  })

  it('cancel is idempotent and settles the job once', async () => {
    const { runtime } = await mount()
    const handle = await runtime.startDownload({
      source: { kind: 'huggingface', repo: 'r/f', file: 'm.gguf' },
      name: 'm',
      kind: 'llm',
    })
    handle.cancel()
    handle.cancel()
    await expect(handle.done).resolves.toEqual({ result: 'cancelled' })
  })

  it('branded id factories pass values through unchanged', () => {
    expect(localModelId('m')).toBe('m')
    expect(modelDownloadId('d')).toBe('d')
  })
})
