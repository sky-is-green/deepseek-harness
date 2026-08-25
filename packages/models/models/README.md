# @deepseek-ai/dsh-models

English | [中文](README.zh.md)

The model hosting seam (`ctx.models`) is HiveBench Studio's local-first model capability: one abstract `ModelsRuntime` exposing the catalog of on-host weights (`listModels`), a host hardware summary backing fit estimates (`hardware`), per-model load-state reads and transitions (`loadState` / `requestLoad` / `requestUnload`), and download jobs with handles and typed progress events (`startDownload` / `downloads`). Runtime selection, launch flags, sampling defaults, and endpoint exposure stay in Service Providers and consumers; this seam stays runtime-agnostic.

## Contract

- **State publishes at its commit point.** Every load/unload/download transition emits its event after the provider accepted the transition, never speculatively. Consumers replace their catalog view from each `models/catalog-updated` payload instead of diffing.
- **Load states follow a checked grammar**: `unloaded → loading → loaded → unloading → unloaded`, with `failed` reachable from `loading`/`unloading` and recoverable by retry or clear. The first observed state for a model may be any status because providers adopt models loaded before mount. The invariant companion enforces the grammar and the download lifecycle (`start → progress* → settle`, exactly once) across all providers.
- **`requestLoad` settles at the terminal state** — resolves once the model reports `loaded`; rejects on failure or abort, with state events published either way. An aborted load moves through `unloading` to `unloaded`.
- **Downloads are handle-based**: `startDownload` resolves to a live handle carrying the terminal promise and an idempotent `cancel()`; progress arrives only through `models/download-progress`; each job settles exactly once as completed (with the new catalog entry), cancelled, or failed.
- **Ids are branded**: `LocalModelId` and `DownloadId` are opaque across package boundaries; providers mint them via `localModelId()` / `modelDownloadId()`.
- Disposal of the service unloads all loaded models, cancels running downloads, and awaits settlement.

## Model Experience

### Hosting surface

#### What the model sees

Nothing directly: hosting is infrastructure behind Consumers. Requests reach hosted weights through `ctx.llm` adapters pointed at the provider's runtime, and those adapters own everything model-visible about serving.

#### Token effect

No direct effect; the seam contributes no prompt content and registers no tool schemas.

#### KV Cache effect

None; request-prefix composition remains owned by the prompt assembler and the adapters that serve loaded models.

## Known Limitations and Deferred Work

- **No native provider yet** — the seam ships with the contract, its invariant companion, and stub-driven tests; the llama.cpp lifecycle provider (spawn/health/adopt/stop over `ctx.subprocess`) and the Hugging Face download manager land as separate provider packages.
- **Sampling and profile vocabulary stays out** — saved sampling params, system prompts, and per-model defaults are profile-level concerns layered above this seam, not fields on load requests.
