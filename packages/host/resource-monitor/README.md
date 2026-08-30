# `@deepseek-ai/dsh-host-resource-monitor`

Leak gate for `load 7B → 1K ctx → unload` loops. Checks `sidecar/status` + `docker stats` reclaim ±5% (`+50MB` slack).

## Model Experience

* Token cost: none.
* KV effect: none.

## Known Limitations

* VRAM via `hardware()` snapshot, not per-process; slack absorbs noise.
