# Agent Note: X23 Tiered estimator + disk guard

Status: implemented

## Problem

`104GB` DeepSeek-V4-Flash on `20GB VRAM + 24GB WSL RAM` spills to NVMe Tier3 `7.5GB/s`. Prior estimator `0.035/1024` under-reported KV and never blocked on disk full; sparkline `buildPanelSparklines` was unbounded.

## Decision

* **`packages/hive/dsh-bench/src/estimator.ts`** (new, pure):
  * `KV_PER_TOKEN_GB = 0.07/1024` FP8, `MODEL 104`, `VRAM 20/40`, `WSL 24`, `NVMe 1000`.
  * `calculateHardwareAllocation(contextTokens, dualGpu, opts)` returns `{ tier1, tier2, tier3, total }` and flags `ioLatencyWarning` (`tier3>0 || ctx>128k`), `diskFull` (`tier3+used > cap*0.8`), `recommendCap` (`32768`/`131072`), `oomRisk` alias.
  * `isDiskFull`, `shouldBlockLoad` helpers.
* **`packages/hive/dsh-bench/src/index.ts`** re-exports `estimator`.
* **`packages/client/ui-sidecar-panel/src/sparkline.ts`**: adds `SPARKLINE_MAX_POINTS=30`, `capSeries`, and caps `buildPanelSparklines` to 30.
* **`hivebench/experiments/tier_probe.py`** + `packages/hive/dsh-bench/tests/estimator.spec.ts` (6 tests): 32k no disk full, 1M spills >100GB to NVMe, dual 40GB, diskFull blocks.

## Alternatives considered

* Keep `0.035/1024` — rejected: under-reports by 2x vs FP8 V4.
* Silent cap at 1M — rejected: fail loud with `diskFull`.

## Consequences

* `X23` satisfies `tier_probe.py` at `32k/128k/1M` and `estimator.spec.ts` disk guard.
* `dsh-bench` `tsc -b` 0, `vitest` 16/16, `sparkline` 4/4, `260` invariants.
