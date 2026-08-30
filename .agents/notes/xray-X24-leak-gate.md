# Agent Note: X24 Leak gate

Status: implemented

## Problem

`load 7B → 1K ctx → unload` loops could leak VRAM/RAM via missed `dispose` or `AbortSignal` not wired. No gate asserted reclaim.

## Decision

* **`packages/host/resource-monitor`** (`@deepseek-ai/dsh-host-resource-monitor`):
  * `monitor.ts`: `ResourceSnapshot`, `RECLAIM_TOLERANCE=0.05`, `isReclaimed(before, after)` (`±5% +50MB` slack), `detectLeak(history)`, `leakReport`.
  * Pure, no durable stream, invariant companion empty.
* **`hivebench/experiments/leak_probe.py`**: python mirror `is_reclaimed`/`detect_leak`, `run_probe(50)` mock loop asserting reclaim.
* **`hivebench/tests/unit/test_leak_probe.py`**: python unit tests for reclaim.
* **`tsconfig.base.json`/`host.json`**: add `dsh-host-resource-monitor` paths.

## Alternatives considered

* Per-iteration `docker stats` polling in TS — rejected: host `hardware()` snapshot is the single source; `leak_probe.py` does the live loop.

## Consequences

* `X24` loop `load 7B → 1K → unload` 50x must reclaim ±5% via `sidecar/status` + `docker stats`.
* `tsc -b` resource-monitor 0, `vitest` 3/3, `leak_probe.py` 50 iters ok, `261` invariants.
