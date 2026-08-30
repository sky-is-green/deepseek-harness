# Agent Note: E11 Engine selector seam

Status: implemented

## Problem

`dsh` had one hard-wired Windows Vulkan path (`E4` llama.cpp via `ctx.subprocess`). Linux ROCm+Docker+VHDX tier needs a named engine choice with loud failure — the previous fallback plan silently degraded. No typed seam existed for `windows-vulkan | linux-rocm-docker`.

## Decision

* **`packages/models/engine-selector`** (`@deepseek-ai/dsh-models-engine-selector`): new host seam.
  * `Config { engine: 'windows-vulkan' | 'linux-rocm-docker' }` validated via `resolveEngine(raw)` — missing defaults to `windows-vulkan`, invalid throws loud `unsupported engine` with fix copy.
  * `describeEngineFailure(kind, reason, detail)` returns actionable `sidecar/status: failed` copy for `vhdx-not-mounted`, `docker-not-running`, `rocm-not-available`, `model-not-found`, `port-in-use`, `unknown`.
  * `isLinuxEngine()` discriminator.
  * Pure, no durable event, invariant companion empty.
* **No silent fallback:** `E11` intentionally fails loud — `S22` wizard and `E12` provider surface the fix, not fallback to `qwen0.5b`.

## Alternatives considered

* Silent fallback to `windows-vulkan` — rejected per user direction: all failures fail loud with fix.
* Single `string` engine without union — rejected: `resolveEngine` would accept typos.

## Consequences

* `E12` can implement `linux-rocm-docker` provider behind this seam; `S22` wizard writes `engine` config.
* `258` invariant companions conform, `tsc -b` `engine-selector` 0, `vitest` 5 green.
