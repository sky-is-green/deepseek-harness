/**
 * Concrete `ctx.models` provider for local llama.cpp runtimes: the catalog is
 * a GGUF directory scan, `hardware()` serves one cached probe, load/unload
 * drive a spawned `llama-server` process through `ctx.subprocess` with
 * `/health` polling, and downloads stream through `dsh-model-downloads` into
 * the weights directory with resume and integrity verification.
 * @module @deepseek-ai/dsh-models-local
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { probeHardware } from '@deepseek-ai/dsh-hardware-probe'
import { ModelsRuntime } from '@deepseek-ai/dsh-models'
import type {
  HardwareSummary,
  ModelCatalogEntry,
  ModelDownloadHandle,
  ModelDownloadRequest,
  ModelDownloadSnapshot,
  ModelLoadRequest,
  ModelLoadState,
  LocalModelId,
} from '@deepseek-ai/dsh-models'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import { entryForFile, scanCatalog } from './catalog.ts'
import { DownloadJobs } from './downloads.ts'
import { findFreePort } from './ports.ts'
import type { ModelsLocalConfig } from './types.ts'

export type { ModelsLocalConfig } from './types.ts'

const DEFAULT_LOAD_TIMEOUT_MS = 20_000
const DEFAULT_HEALTH_POLL_MS = 250
const DEFAULT_DOWNLOAD_PROGRESS_MS = 250
const HUGGINGFACE_BASE_URL = 'https://huggingface.co'

/** Local model hosting provider. One loaded model per spawn; concurrent loads refuse loud. */
export class ModelsLocalRuntime extends ModelsRuntime {
  static inject = ['subprocess']

  static Config: z<ModelsLocalConfig> = z.object({
    serverBinary: z.string().required(),
    modelsDir: z.string().required(),
    basePort: z.number().step(1).min(1).max(65_535).required(),
    loadTimeoutMs: z.natural().default(DEFAULT_LOAD_TIMEOUT_MS),
    healthPollMs: z.natural().default(DEFAULT_HEALTH_POLL_MS),
    extraArgs: z.array(z.string()).default([]),
    hubBaseUrl: z.string().default(HUGGINGFACE_BASE_URL),
    downloadProgressMs: z.natural().default(DEFAULT_DOWNLOAD_PROGRESS_MS),
  })

  private readonly states = new Map<LocalModelId, ModelLoadState>()
  private readonly processes = new Map<LocalModelId, SubprocessHandle>()
  private readonly servePorts = new Map<LocalModelId, number>()
  private readonly loadAborts = new Map<LocalModelId, AbortController>()
  private readonly downloadJobs: DownloadJobs
  private catalogCache: readonly ModelCatalogEntry[] | undefined
  private hardwareCache: HardwareSummary | undefined
  private readonly config: ModelsLocalConfig

  constructor(ctx: Context, config: ModelsLocalConfig) {
    super(ctx)
    this.config = config
    this.downloadJobs = new DownloadJobs({
      modelsDir: config.modelsDir,
      hubBaseUrl: config.hubBaseUrl ?? HUGGINGFACE_BASE_URL,
      progressIntervalMs: config.downloadProgressMs ?? DEFAULT_DOWNLOAD_PROGRESS_MS,
      buildEntry: (path, displayName) => entryForFile(path, displayName),
      refreshCatalog: async () => {
        this.catalogCache = await scanCatalog(this.config.modelsDir)
        this.emitCatalogUpdated(this.catalogCache)
      },
      onStarted: (download) => {
        this.emitDownloadStarted(download)
      },
      onProgress: (downloadId, bytesReceived, bytesTotal) => {
        this.emitDownloadProgress(downloadId, bytesReceived, bytesTotal)
      },
      onSettled: (downloadId, outcome) => {
        this.emitDownloadSettled(downloadId, outcome)
      },
    })
    ctx.effect(() => {
      const loaded = [...this.processes.keys()]
      return async () => {
        // Per-model unload failures must not mask the remaining disposal steps.
        for (const modelId of loaded) await this.requestUnload(modelId).catch(() => {})
        await this.downloadJobs.dispose()
      }
    }, 'models-local teardown')
  }

  async listModels(): Promise<readonly ModelCatalogEntry[]> {
    this.catalogCache = await scanCatalog(this.config.modelsDir)
    this.ctx.emit('models/catalog-updated', { entries: this.catalogCache })
    return this.catalogCache
  }

  async hardware(): Promise<HardwareSummary> {
    this.hardwareCache ??= await probeHardware()
    return this.hardwareCache
  }

  loadState(modelId: LocalModelId): ModelLoadState {
    return this.states.get(modelId) ?? { status: 'unloaded' }
  }

  async requestLoad(request: ModelLoadRequest, signal?: AbortSignal): Promise<void> {
    const entry = (this.catalogCache ??= await scanCatalog(this.config.modelsDir))
      .find(candidate => candidate.id === request.modelId)
    if (entry === undefined) throw new Error(`models-local: unknown model "${String(request.modelId)}"`)
    const current = this.loadState(request.modelId)
    if (current.status !== 'unloaded' && current.status !== 'failed') {
      throw new Error(`models-local: model "${String(request.modelId)}" is ${current.status}; unload first`)
    }

    const port = await findFreePort(this.config.basePort)
    if (port === null) {
      this.commit(request.modelId, { status: 'failed', message: `no free port near ${this.config.basePort}` })
      throw new Error('models-local: no free port for the server')
    }
    this.servePorts.set(request.modelId, port)

    this.commit(request.modelId, { status: 'loading' })
    const controller = new AbortController()
    this.loadAborts.set(request.modelId, controller)
    const onExternalAbort = (): void => {
      controller.abort()
    }
    signal?.addEventListener('abort', onExternalAbort, { once: true })

    try {
      const handle = this.ctx.subprocess.spawn({
        argv: [
          this.config.serverBinary,
          ...this.config.extraArgs ?? [],
          '-m', entry.path,
          '--port', String(port),
          '-c', String(request.contextLength ?? entry.contextLength ?? 4096),
        ],
        cwd: this.config.modelsDir,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 64 * 1024 }, stderr: { maxBytes: 64 * 1024 } },
        graceMs: 5_000,
      })
      this.processes.set(request.modelId, handle)
      try {
        await this.awaitHealthy(port, controller.signal)
        if (controller.signal.aborted || signal?.aborted === true) throw new AbortError()
        const contextLengthFinal: number | undefined = request.contextLength ?? entry.contextLength
        this.commit(request.modelId, {
          status: 'loaded',
          ...(contextLengthFinal !== undefined && { contextLength: contextLengthFinal }),
        })
      } catch (error) {
        await this.terminate(handle)
        this.processes.delete(request.modelId)
        this.servePorts.delete(request.modelId)
        if (controller.signal.aborted || signal?.aborted === true) {
          this.commit(request.modelId, { status: 'unloaded' })
          throw new Error('models-local: load aborted')
        }
        const message = error instanceof Error ? error.message : String(error)
        this.commit(request.modelId, { status: 'failed', message })
        throw error
      }
    } finally {
      signal?.removeEventListener('abort', onExternalAbort)
      this.loadAborts.delete(request.modelId)
    }
  }

  async requestUnload(modelId: LocalModelId): Promise<void> {
    const current = this.loadState(modelId)
    if (current.status !== 'loaded' && current.status !== 'loading') {
      throw new Error(`models-local: model "${String(modelId)}" is ${current.status}; nothing to unload`)
    }
    this.commit(modelId, { status: 'unloading' })
    this.loadAborts.get(modelId)?.abort()
    const handle = this.processes.get(modelId)
    if (handle !== undefined) {
      handle.terminate()
      await handle.done.catch(() => {})
      this.processes.delete(modelId)
    }
    this.servePorts.delete(modelId)
    this.commit(modelId, { status: 'unloaded' })
  }

  startDownload(request: ModelDownloadRequest): Promise<ModelDownloadHandle> {
    return this.downloadJobs.start(request)
  }

  downloads(): readonly ModelDownloadSnapshot[] {
    return this.downloadJobs.snapshots()
  }

  /** Optional `ModelServeEndpoints` capability (see dsh-models): where the spawned server listens while its process lives. */
  serveEndpoint(modelId: LocalModelId): string | undefined {
    const port = this.servePorts.get(modelId)
    return port === undefined ? undefined : `http://127.0.0.1:${port}`
  }

  private async awaitHealthy(port: number, signal: AbortSignal): Promise<void> {
    const timeoutMs = this.config.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS
    const pollMs = this.config.healthPollMs ?? DEFAULT_HEALTH_POLL_MS
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline && !signal.aborted) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(pollMs) })
        if (response.ok) return
      } catch {
        // Connection-refused before bind is normal warm-up; the deadline and
        // the abort signal own termination.
      }
      await new Promise(resolve => setTimeout(resolve, pollMs))
    }
    if (signal.aborted) throw new AbortError()
    throw new Error(`server /health not ready within ${timeoutMs}ms`)
  }

  private async terminate(handle: SubprocessHandle): Promise<void> {
    handle.terminate()
    await handle.done.catch(() => {})
  }

  private commit(modelId: LocalModelId, state: ModelLoadState): void {
    this.states.set(modelId, state)
    this.ctx.emit('models/load-state', { modelId, state })
  }
}

/** Sentinel distinguishing abort from failure inside the load path. */
class AbortError extends Error {
  constructor() {
    super('models-local: aborted')
    this.name = 'AbortError'
  }
}

export default ModelsLocalRuntime
