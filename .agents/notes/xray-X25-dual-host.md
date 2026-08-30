# Agent Note: X25 Dual-host integration

Status: implemented

## Problem

Windows `E:\models` and Linux `/mnt/dsh_storage/models` must both find `*-00001-of-*.gguf` shards and tier correctly (`20GB` vs `40GB` VRAM). No end-to-end probe asserted model-found + `tok/s` spill.

## Decision

* **`hivebench/experiments/dual_host_probe.py`**: `detect_model_bootstrap_target(dir)` (glob `**/*.gguf`, picks `-00001-of-`, loud `FileNotFoundError` with fix) and `calculate_tier(ctx, dual)` (FP8 `0.07/1024`, `tier1 20/40`, `tier3` spill, `io_warning`). Tests Windows `tempdir` vs Linux `tempdir` shards, `32k/128k` dual spills less, `1M` spills >100GB on both.
* **`hivebench/tests/unit/test_dual_host_probe.py`**: python unit mirrors.

## Alternatives considered

* TS `dsh-bench` probe — rejected: model-found is filesystem, python `glob` is the source of truth for `bootstrap-sidecar.mjs`.

## Consequences

* `dual_host_probe.py` green at `32k/128k/1M` dual/single; `X25` unblocks Round 6 integration when `S22`+`X23` done (now all done).
