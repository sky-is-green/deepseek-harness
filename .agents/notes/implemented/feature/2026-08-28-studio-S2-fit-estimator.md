# Agent Note: Pre-load fit estimation for model cards and downloads

Status: implemented

English | [中文](2026-08-28-studio-S2-fit-estimator.zh.md)

## Problem

Local-model flows (S1 catalog cards + Hugging Face downloads) showed `sizeBytes` and architecture metadata but no hardware context: users could start a 16 GB download or attempt a `requestLoad` only to learn at `failed` that the host has 8 GB. The estimator must join E2's probe (`HardwareSummary`: devices with `memoryBytes` plus `totalRamBytes`) with E8's `sizeBytes` and E3's `bytesTotal` without duplicating policy in the provider, without polling, and without adding KV-cache math that depends on hidden architecture parameters.

## Decision

- **Pure estimator `src/fit.ts`.** `estimateFit(sizeBytes, hardware)` picks the largest `memoryBytes` among devices (Metal unified-memory, CUDA VRAM, etc.) or falls back to `totalRamBytes`; returns `null` for unknown hardware or unusable budgets. File-size comparison only (`needs <= available`) — KV overhead is omitted because the file dominates and hidden sizes are absent from the catalog. Labels reuse the card's one-decimal GB formatter (`4.0 GB`), `fits`/`tooLarge` copy, and `ratio` for callers that want a bar.
- **Read-model extension.** `ModelsManagerState.hardware: HardwareSummary | null` plus `setHardware`. `store.ts` seeds `null` and mutates only through the new action.
- **One `hardware()` fetch in `client/index.ts`.** Mount pulls `hardware()` alongside `listModels()`; `connection/reset` and manual `load()` re-probe. Probe failures stay `null` ("Hardware unknown") — stub providers in tests never block.
- **UI.** `ModelsManager.tsx` renders `estimateFit(entry.sizeBytes, hardware)` under each card's meta line as `Needs X · You have Y · Fits/Too large` (muted "Hardware unknown" before the probe). Downloads show the same line when `bytesTotal !== null`. Warnings use `fitWarn` (primary, semi-bold); the line is pure derived data, no new subscription.

## Alternatives considered

- **Include KV-cache overhead (`contextLength * bytesPerToken`).** Rejected: overhead depends on hidden size / layers absent from `GgufMetadata`; a wrong estimate is worse than a file-size-only estimate plus a documented limitation.
- **Threshold with headroom (e.g. 90% of available).** Rejected: file size already understates resident set, but arbitrary headroom would still be wrong for some models and surprising for others; equality fits.

## Consequences

- **S2 done.** Cards now answer "needs 6.2 GB, you have 8 GB" before any load; download rows answer as soon as the HEAD total is known.
- **No service change.** The UI never writes policy into `ctx.models`; providers remain the source of truth for `load-state`.
- **Limits documented.** README Known Limitations now describes the file-size-only rule and "Hardware unknown" state.
