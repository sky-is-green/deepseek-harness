/**
 * Service Definition for the model hosting seam (`ctx.models`): one catalog of
 * local model weights, a host hardware summary, load/unload lifecycle
 * requests, and download jobs with typed progress events. Runtime selection,
 * llama.cpp launch flags, sampling defaults, and endpoint exposure belong to
 * Service Providers and consumers; this seam stays runtime-agnostic.
 * @module @deepseek-ai/dsh-models
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {
  DownloadId,
  HardwareSummary,
  ModelCatalogEntry,
  ModelDownloadHandle,
  ModelDownloadOutcome,
  ModelDownloadRequest,
  ModelDownloadSnapshot,
  ModelLoadRequest,
  ModelLoadState,
  LocalModelId,
} from './types.ts'

export type {
  ComputeBackend,
  DownloadId,
  HardwareDevice,
  HardwareSummary,
  ModelCatalogEntry,
  ModelDownloadHandle,
  ModelDownloadOutcome,
  ModelDownloadRequest,
  ModelDownloadSnapshot,
  ModelDownloadSource,
  ModelFormat,
  ModelKind,
  ModelLoadRequest,
  ModelLoadState,
  ModelLoadStatus,
  LocalModelId,
} from './types.ts'

/**
 * Cast one string into its branded {@link LocalModelId} form (zero runtime
 * cost). Providers mint ids for catalog entries; consumers pass them back.
 * @param value - provider-assigned identifier string.
 * @returns the same string carrying the `local-model` brand.
 */
export function localModelId(value: string): LocalModelId {
  return value as LocalModelId
}

/**
 * Cast one string into its branded {@link DownloadId} form (zero runtime
 * cost). Providers mint ids when accepting a download.
 * @param value - provider-assigned identifier string.
 * @returns the same string carrying the `model-download` brand.
 */
export function modelDownloadId(value: string): DownloadId {
  return value as DownloadId
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    models: ModelsRuntime
  }
  interface Events {
    /**
     * The catalog changed: an entry was added (download completed, local file
     * discovered) or removed. Carries the complete fresh snapshot; consumers
     * replace their view instead of diffing. Published after the commit.
     * @param payload.entries - the complete current catalog.
     * @mode emit
     */
    'models/catalog-updated'(payload: { entries: readonly ModelCatalogEntry[] }): void
    /**
     * One model's committed load-state transition. Emissions follow the
     * transition grammar checked by this package's invariant companion:
     * `unloaded → loading → loaded → unloading → unloaded`, with `failed`
     * reachable from `loading`/`unloading` and recoverable by retry or clear.
     * @param payload.modelId - the model that transitioned.
     * @param payload.state - the full post-transition state.
     * @mode emit
     */
    'models/load-state'(payload: { modelId: LocalModelId; state: ModelLoadState }): void
    /**
     * A download job was accepted and started.
     * @param payload.download - the initial snapshot of the job.
     * @mode emit
     */
    'models/download-started'(payload: { download: ModelDownloadSnapshot }): void
    /**
     * Bytes arrived for a running download. Never emitted after settle.
     * @param payload.downloadId - the job the bytes belong to.
     * @param payload.bytesReceived - cumulative received byte count.
     * @param payload.bytesTotal - server-reported total, or `null` when unknown.
     * @mode emit
     */
    'models/download-progress'(payload: {
      downloadId: DownloadId
      bytesReceived: number
      bytesTotal: number | null
    }): void
    /**
     * A download reached its terminal outcome exactly once.
     * @param payload.downloadId - the settled job.
     * @param payload.outcome - completion (with the new catalog entry), cancellation, or failure.
     * @mode emit
     */
    'models/download-settled'(payload: { downloadId: DownloadId; outcome: ModelDownloadOutcome }): void
  }
}

/**
 * Abstract model hosting service. Subclass, implement the surface, and load
 * the subclass as a plugin — it registers as `ctx.models` (one implementation
 * per context; loading a second throws, which is cordis' standard
 * duplicate-service behavior).
 *
 * Implementations must honor these semantics:
 * - State is published only at its commit point: every {@link requestLoad},
 *   {@link requestUnload}, and download transition emits its event after the
 *   underlying operation accepted it, never speculatively.
 * - Load-state emissions follow the documented transition grammar; the first
 *   observed state for a model may be any status because providers adopt
 *   models loaded before mount.
 * - Download ids are unique for the process lifetime; progress events address
 *   running jobs only, and each job settles exactly once.
 * - Disposal unloads all loaded models, cancels all running downloads, and
 *   awaits settlement.
 */
export abstract class ModelsRuntime extends Service {
  constructor(ctx: Context) {
    super(ctx, 'models')
  }

  /**
   * Publish a committed load-state transition. Implementations call this
   * exactly once per transition, after the underlying operation accepted it.
   * @param modelId - the model that transitioned.
   * @param state - the full post-transition state.
   */
  protected emitLoadState(modelId: LocalModelId, state: ModelLoadState): void {
    this.ctx.emit('models/load-state', { modelId, state })
  }

  /**
   * Publish the complete fresh catalog after a commit (entry added or removed).
   * @param entries - the complete current catalog.
   */
  protected emitCatalogUpdated(entries: readonly ModelCatalogEntry[]): void {
    this.ctx.emit('models/catalog-updated', { entries })
  }

  /**
   * Publish a download job's acceptance snapshot.
   * @param download - the initial snapshot of the job.
   */
  protected emitDownloadStarted(download: ModelDownloadSnapshot): void {
    this.ctx.emit('models/download-started', { download })
  }

  /**
   * Publish arrived bytes for a running download; never call after settle.
   * @param downloadId - the job the bytes belong to.
   * @param bytesReceived - cumulative received byte count.
   * @param bytesTotal - server-reported total, or null when unknown.
   */
  protected emitDownloadProgress(downloadId: DownloadId, bytesReceived: number, bytesTotal: number | null): void {
    this.ctx.emit('models/download-progress', { downloadId, bytesReceived, bytesTotal })
  }

  /**
   * Publish a download's terminal outcome exactly once.
   * @param downloadId - the settled job.
   * @param outcome - completion (with the new catalog entry), cancellation, or failure.
   */
  protected emitDownloadSettled(downloadId: DownloadId, outcome: ModelDownloadOutcome): void {
    this.ctx.emit('models/download-settled', { downloadId, outcome })
  }

  /**
   * Read the current catalog snapshot.
   * @returns all models whose weights exist on this host, in provider-defined order.
   */
  abstract listModels(): Promise<readonly ModelCatalogEntry[]>

  /**
   * Probe the host's compute devices backing fit estimates. The result is
   * static for the process lifetime; implementations may cache.
   * @returns detected devices plus total system RAM.
   */
  abstract hardware(): Promise<HardwareSummary>

  /**
   * Read one model's current load state without emitting.
   * @param modelId - the model to read.
   * @returns the committed state (`unloaded` for unknown ids — the state of a model absent from the catalog).
   */
  abstract loadState(modelId: LocalModelId): ModelLoadState

  /**
   * Load one catalog model for serving. Intermediate states arrive via
   * `models/load-state`; the returned promise settles at the terminal state.
   * @param request - the model and optional context-length override.
   * @param signal - aborts the load; the provider then transitions through unload to `unloaded`.
   * @returns resolves once the model reports `loaded`.
   * @throws when loading fails (state reports `failed`) or the signal aborts first.
   */
  abstract requestLoad(request: ModelLoadRequest, signal?: AbortSignal): Promise<void>

  /**
   * Unload one loaded or loading model. Aborting a `loading` model moves it
   * through `unloading` to `unloaded`.
   * @param modelId - the model to unload.
   * @returns resolves once the model reports `unloaded`.
   * @throws when unloading fails (state reports `failed`).
   */
  abstract requestUnload(modelId: LocalModelId): Promise<void>

  /**
   * Start one download job. Acceptance, progress, and settlement are
   * observable through the `models/download-*` events; the handle carries the
   * terminal promise and the cancel verb.
   * @param request - source, display name, and kind for the resulting entry.
   * @returns the live job handle; acceptance failures reject before a handle exists.
   */
  abstract startDownload(request: ModelDownloadRequest): Promise<ModelDownloadHandle>

  /**
   * Snapshot the jobs that have not settled.
   * @returns one snapshot per running download, in acceptance order.
   */
  abstract downloads(): readonly ModelDownloadSnapshot[]
}

export default ModelsRuntime
