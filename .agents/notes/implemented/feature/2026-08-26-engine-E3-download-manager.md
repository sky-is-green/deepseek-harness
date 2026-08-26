# Agent Note: Downloads land behind ctx.models through a resumable ranged-fetch engine

Status: implemented

English | [中文](2026-08-26-engine-E3-download-manager.zh.md)

## Problem

E4's local provider refused `startDownload` loud: a local-first studio needs Hugging Face GGUF acquisition with resume across restarts, integrity checking against hub-advertised digests, and live progress for the model manager cards (S1) and fit estimator (S2) — without adding a third-party transfer dependency or letting network policy leak into the provider.

## Decision

- **New engine package `@deepseek-ai/dsh-model-downloads`.** `resolveRemoteFile(baseUrl, ref)` probes with HEAD, follows redirects, captures the final URL, declared size, and any LFS-style sha256 etag as a strong expectation. `fetchToFile({ baseUrl, ref, destinationPath, signal, onProgress })` streams into `<destinationPath>.part` with a Range request when staging exists, handles the server ignoring ranges (one clean restart) and `416` (finalize a complete-but-unrenamed part; refuse a wrong-size part loud), verifies sha256 after placement and deletes the placed file on mismatch, and maps aborts at every await boundary to `{ result: 'cancelled' }` while preserving staging for the next attempt.
- **Cadence ownership is split deliberately.** The engine emits per-chunk progress samples; throttling belongs to the consumer. `models-local` gains `downloadProgressMs` (default 250ms) plus a terminal tick so UI totals always settle exact.
- **Provider acceptance is synchronous and loud** (`DownloadJobs` in `models-local`): huggingface sources only until another kind ships a provider, `.gguf` targets only because the catalog scans that suffix, refusal before any handle exists when the destination file exists or another job targets it. Completion rescans the catalog and emits `models/catalog-updated` before the job settles `completed`; disposal cancels running jobs and awaits settlement after unloading models.
- **Hub location is configuration**, `hubBaseUrl` (default `https://huggingface.co`), keeping tests offline against an in-process fixture instead of stubbing internals.

## Alternatives considered

- **npm transfer libraries** — none combined ranged resume, digest verification, `.part` staging semantics, and zero dependencies; the engine is ~150 lines and fully owned.
- **Verify-before-rename** — rejected in favor of place-then-verify: same poisoned-catalog guarantee (mismatch deletes), simpler failure surface, and the 416 finalize path falls out naturally.
- **Engine-side rate limiting of progress events** — rejected: two consumers (cards, forensics) want different cadences; the config knob keeps policy at the provider.

## Consequences

S1 renders real download progress from `models/download-*` events with no further plumbing; S2 reads `bytesTotal` from accepted snapshots. Mirrors, credential-gated repos, and multi-file shard sets stay open work behind the same seam (documented limitations).
