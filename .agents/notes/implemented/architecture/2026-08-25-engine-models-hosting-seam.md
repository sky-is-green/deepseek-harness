# Agent Note: The model hosting seam (`ctx.models`) owns catalog, load grammar, and download lifecycle

Status: implemented

English | [中文](2026-08-25-engine-models-hosting-seam.zh.md)

## Problem

HiveBench Studio needs local-first model hosting, but nothing in the harness had a vocabulary for it: no catalog of on-host weights, no way to observe load/unload transitions, and no download primitive. Lane B's model manager cards needed types to code against immediately, and future providers (llama.cpp lifecycle, Hugging Face downloads) plus consumers (fit estimators, the inbound OpenAI-compatible endpoint) need one seam to implement or read. Without a deliberate contract now, each surface would invent its own model vocabulary.

## Decision

`@deepseek-ai/dsh-models` (packages/models/models) ships the Service Definition: an abstract `ModelsRuntime` registering as `ctx.models`, with five typed events (`models/catalog-updated`, `models/load-state`, `models/download-started`, `models/download-progress`, `models/download-settled`) and branded ids (`LocalModelId`, `DownloadId`). Providers subclass and implement; the local llama.cpp provider and download manager land as separate Wave 2 packages behind the same seam.

Contract highlights:

- State publishes only at its commit point; `models/catalog-updated` carries the complete fresh snapshot so consumers replace rather than diff.
- Load states follow a checked grammar (`unloaded → loading → loaded → unloading → unloaded`, `failed` reachable from loading/unloading, recoverable by retry); any status may be the first observed one because providers adopt models loaded before mount.
- `requestLoad` settles at the terminal state (resolve on `loaded`, reject on failure/abort) while intermediate states stream through events; downloads are handle-based with exactly-one settlement.
- The package's invariant companion enforces the transition grammar and the download lifecycle across all providers by observing the event stream globally.

Sampling parameters, system prompts, and per-model defaults are deliberately absent: they are profile-level concerns layered above the seam (Wave 2 E9), not fields on load requests.

## Alternatives considered

- **Fold hosting into `ctx.llm` adapters** — rejected: `ctx.llm` is the streaming-request seam and stays provider-of-record for chat; hosting is a long-lived resource domain with its own lifecycle, and coupling them would make every adapter implement catalog/download machinery.
- **Poll-only API (no events)** — rejected: the UI cards need live progress and state changes; polling would push providers into ad-hoc callback registries anyway, recreating events without the typed declaration-merging contract.
- **Callback/handle-only progress (no broadcast)** — rejected: multiple consumers exist from day one (cards, fit estimator, devtools firehose), and handle-scoped subscriptions would force a fan-out layer in every provider.
- **Return rich objects from `requestLoad`** — rejected in favor of promise-plus-events: a returned object invites consumers to hold stale state snapshots instead of reading committed state via `loadState`/events ("publish at commit point").

## Consequences

Lane B can build S1 (model manager cards) against these types with a mocked service immediately. Providers owe the documented semantics — including disposal unloading everything and cancelling downloads — and the invariant companion will reject grammatical violations at runtime in compositions that mount it. The wire-level serving surface (E5) and embeddings (E6) stay out of the seam on purpose; they consume loaded models rather than define hosting.

Known gap tracked on the MULTI_AGENT_PLAN board: no native provider exists yet, so the seam is proven by stub-driven tests until E3/E4 land.
