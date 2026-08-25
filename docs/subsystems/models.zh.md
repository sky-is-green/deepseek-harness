# 本地模型托管

[English](models.md) | 中文

`ctx.models` 是本地模型托管的 Service Definition：磁盘上 GGUF 模型的目录条目、主机硬件摘要、加载状态跟踪与下载生命周期，全部以类型化的 `models/*` 事件发布。载荷与状态类型定义于 [`packages/models/models/src/types.ts`](../../packages/models/models/src/types.ts)；行为契约、事件语法与配置面由该包的 [README](../../packages/models/models/README.zh.md) 负责。Provider 插件面向本地推理服务器实现运行时，客户端界面消费同一组类型，因此各条产品线都针对同一个接缝编码，而不是各自对接厂商 API。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmodels--modelsruntime-abstract-seam"></a>

### `ctx.models` — `ModelsRuntime` (abstract seam)

Abstract model hosting service. Subclass, implement the surface, and load the subclass as a plugin — it registers as `ctx.models` (one implementation per context; loading a second throws, which is cordis' standard duplicate-service behavior).

Implementations must honor these semantics:

- State is published only at its commit point: every requestLoad, requestUnload, and download transition emits its event after the underlying operation accepted it, never speculatively.
- Load-state emissions follow the documented transition grammar; the first observed state for a model may be any status because providers adopt models loaded before mount.
- Download ids are unique for the process lifetime; progress events address running jobs only, and each job settles exactly once.
- Disposal unloads all loaded models, cancels all running downloads, and awaits settlement.

```ts cordis-catalog
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
```

Source: [`packages/models/models/src/index.ts`](../../packages/models/models/src/index.ts)

<a id="models-events"></a>

### `models/*` events

<a id="modelscatalog-updated--emit"></a>

#### `models/catalog-updated` — emit

The catalog changed: an entry was added (download completed, local file discovered) or removed. Carries the complete fresh snapshot; consumers replace their view instead of diffing. Published after the commit.

```ts cordis-catalog
/**
 * The catalog changed: an entry was added (download completed, local file
 * discovered) or removed. Carries the complete fresh snapshot; consumers
 * replace their view instead of diffing. Published after the commit.
 * @param payload.entries - the complete current catalog.
 * @mode emit
 */
'models/catalog-updated'(payload: { entries: readonly ModelCatalogEntry[] }): void
```

Source: [`packages/models/models/src/index.ts`](../../packages/models/models/src/index.ts)

<a id="modelsdownload-progress--emit"></a>

#### `models/download-progress` — emit

Bytes arrived for a running download. Never emitted after settle.

```ts cordis-catalog
/**
 * Bytes arrived for a running download. Never emitted after settle.
 * @param payload.downloadId - the job the bytes belong to.
 * @param payload.bytesReceived - cumulative received byte count.
 * @param payload.bytesTotal - server-reported total, or `null` when unknown.
 * @mode emit
 */
'models/download-progress'(payload: { downloadId: DownloadId bytesReceived: number bytesTotal: number | null }): void
```

Source: [`packages/models/models/src/index.ts`](../../packages/models/models/src/index.ts)

<a id="modelsdownload-settled--emit"></a>

#### `models/download-settled` — emit

A download reached its terminal outcome exactly once.

```ts cordis-catalog
/**
 * A download reached its terminal outcome exactly once.
 * @param payload.downloadId - the settled job.
 * @param payload.outcome - completion (with the new catalog entry), cancellation, or failure.
 * @mode emit
 */
'models/download-settled'(payload: { downloadId: DownloadId; outcome: ModelDownloadOutcome }): void
```

Source: [`packages/models/models/src/index.ts`](../../packages/models/models/src/index.ts)

<a id="modelsdownload-started--emit"></a>

#### `models/download-started` — emit

A download job was accepted and started.

```ts cordis-catalog
/**
 * A download job was accepted and started.
 * @param payload.download - the initial snapshot of the job.
 * @mode emit
 */
'models/download-started'(payload: { download: ModelDownloadSnapshot }): void
```

Source: [`packages/models/models/src/index.ts`](../../packages/models/models/src/index.ts)

<a id="modelsload-state--emit"></a>

#### `models/load-state` — emit

One model's committed load-state transition. Emissions follow the transition grammar checked by this package's invariant companion: `unloaded → loading → loaded → unloading → unloaded`, with `failed` reachable from `loading`/`unloading` and recoverable by retry or clear.

```ts cordis-catalog
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
```

Source: [`packages/models/models/src/index.ts`](../../packages/models/models/src/index.ts)
<!-- END GENERATED cordis-surface -->
