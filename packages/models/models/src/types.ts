/**
 * Vocabulary for the model hosting seam (`ctx.models`). Types only — runtime
 * code lives in `index.ts` and `invariant.ts`.
 * @module
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque identifier of one catalog model; constructed via {@link localModelId}. */
export type LocalModelId = Branded<'local-model'>

/** Opaque identifier of one download job; constructed via {@link modelDownloadId}. */
export type DownloadId = Branded<'model-download'>

/** What a hosted model serves. */
export type ModelKind = 'llm' | 'embedding'

/** Weight file format of a catalog entry. */
export type ModelFormat = 'gguf'

/** One model in the provider's catalog: weights present on this host. */
export interface ModelCatalogEntry {
  /** Stable identifier used by load requests, unload requests, and event payloads. */
  readonly id: LocalModelId
  /** Human-facing display name. */
  readonly name: string
  readonly kind: ModelKind
  readonly format: ModelFormat
  /** Absolute path of the weights file on this host. */
  readonly path: string
  /** Weights file size in bytes. */
  readonly sizeBytes: number
  /** Model family from weight metadata (e.g. `qwen3`), when known. */
  readonly architecture?: string
  /** Quantization label from weight metadata (e.g. `Q4_K_M`), when known. */
  readonly quantization?: string
  /** Trained context length from weight metadata, when known. */
  readonly contextLength?: number
}

/** Lifecycle status of one model. */
export type ModelLoadStatus = 'unloaded' | 'loading' | 'loaded' | 'unloading' | 'failed'

/**
 * Full load state of one model. A state is published once per committed
 * transition on `models/load-state`; {@link ModelsRuntime.loadState} reads the
 * current value.
 */
export type ModelLoadState =
  | { readonly status: 'unloaded' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly contextLength?: number }
  | { readonly status: 'unloading' }
  | { readonly status: 'failed'; readonly message: string }

/** One compute device visible to the host runtime. New backends extend this union; consumers render unknown devices generically. */
export type ComputeBackend = 'cpu' | 'cuda' | 'vulkan' | 'metal' | 'sycl'
/** One detected compute device. */
export interface HardwareDevice {
  readonly backend: ComputeBackend
  /** Device name as reported by the driver (e.g. the GPU marketing name). */
  readonly name?: string
  /** Device-local memory in bytes, when reportable. */
  readonly memoryBytes?: number
}

/**
 * Host hardware summary backing fit estimates. Static for the process
 * lifetime; providers may cache their probe.
 */
export interface HardwareSummary {
  readonly devices: readonly HardwareDevice[]
  /** Total system RAM in bytes. */
  readonly totalRamBytes: number
}

/** Where to fetch weights from. New sources extend this union alongside the provider that serves them. */
export type ModelDownloadSource =
  | { readonly kind: 'huggingface'; readonly repo: string; readonly file: string }

/** One requested download. */
export interface ModelDownloadRequest {
  readonly source: ModelDownloadSource
  /** Display name for the resulting catalog entry. */
  readonly name: string
  readonly kind: ModelKind
}

/** Live view of one download job, as returned by start and downloads queries. */
export interface ModelDownloadSnapshot {
  readonly id: DownloadId
  readonly request: ModelDownloadRequest
  /** Absolute path the file is written to. */
  readonly destinationPath: string
  readonly bytesReceived: number
  /** Total bytes when the server reports a length, otherwise `null`. */
  readonly bytesTotal: number | null
}

/** Terminal result of one download job. */
export type ModelDownloadOutcome =
  | { readonly result: 'completed'; readonly entry: ModelCatalogEntry }
  | { readonly result: 'cancelled' }
  | { readonly result: 'failed'; readonly message: string }

/** Handle for one in-flight download job. */
export interface ModelDownloadHandle {
  readonly id: DownloadId
  /** Resolves once with the terminal outcome; progress arrives via `models/download-progress`. */
  readonly done: Promise<ModelDownloadOutcome>
  /**
   * Request cancellation; idempotent after settlement. The job settles as
   * `{ result: 'cancelled' }` unless it already completed or failed first.
   */
  cancel(): void
}

/** Parameters for loading one catalog model. */
export interface ModelLoadRequest {
  readonly modelId: LocalModelId
  /** Serve-time context length override; defaults to the catalog entry's trained length. */
  readonly contextLength?: number
}

/**
 * Optional capability for providers that serve a loaded model through a
 * spawned HTTP subprocess (the Service Definition leaves endpoint exposure
 * to providers by design). Consumers detect it structurally:
 * `'serveEndpoint' in ctx.models`.
 */
export interface ModelServeEndpoints {
  /**
   * Base URL of the server currently backing one model, if any. Presence of
   * the URL does not imply readiness — readiness rides `models/load-state`;
   * the value exists from process spawn so warm-up consumers can poll health
   * themselves.
   * @param modelId - the loaded (or loading) model to locate.
   * @returns the base URL without a trailing slash, or `undefined` when no server process is running for the model.
   */
  serveEndpoint(modelId: LocalModelId): string | undefined
}
