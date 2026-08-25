# Agent Note: The local provider refuses what it does not own — downloads stay E3's

Status: implemented

English | [中文](engine-E4-llama-lifecycle-provider.zh.md)

## Problem

E4 must give `ctx.models` a real provider so S1 stops mocking, but the seam also demands a download surface that is genuinely a different task (E3: resume, integrity, HF protocol). A stub that pretends to download would poison users; an unimplemented abstract method cannot exist on a concrete class.

## Decision

`@deepseek-ai/dsh-models-local` implements the lifecycle slice and refuses the rest:

- **Lifecycle**: GGUF directory scan → catalog; load spawns `[serverBinary, ...extraArgs, -m path, --port <free>, -c ctx]` through `ctx.subprocess`, polls `/health` inside a bounded budget, commits the seam's checked grammar at each transition; unload terminates the tree and walks to `unloaded`; disposal best-effort unloads all.
- **Refusals are loud and specific**: downloads reject naming E3; second concurrent loads refuse instead of silently evicting; corrupt weights files fail the catalog scan so no model silently disappears.
- **Testability without llama.cpp**: `extraArgs` exists as a first-class config field (real deployments need wrapper scripts/extra flags anyway), which lets tests run a 30-line Node fake server standing in for `llama-server`.

## Alternatives considered

- **Minimal in-provider HF download** — rejected: resume + integrity + disk-location policy is exactly E3's registered scope; duplicating a partial version here would fork the download vocabulary.
- **Silent eviction of a loaded model on new load requests** — rejected: hiding resource decisions inside request handling breaks the commit-point state grammar; eviction policy deserves its own surface later.
- **Per-file skip on corrupt catalog entries** — rejected: a model visible in UI but unloadable is worse than a loud scan error naming the file.

## Consequences

S1 can mount this provider and drive real load/unload against any llama.cpp build; E10 (vision routing) extends argv building only. The remaining seam gap is downloads, tracked as E3 with its blockers already complete.
