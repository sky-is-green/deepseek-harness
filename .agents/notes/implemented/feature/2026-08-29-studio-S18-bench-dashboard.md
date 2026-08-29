# Agent Note: Bench dashboard sparkline for PES/tok/s

Status: implemented

English | [中文](2026-08-29-studio-S18-bench-dashboard.zh.md)

## Problem

`POST /v1/protocol/run` and `GET /v1/report/*` were reachable only through `/bench` command output or the server-rendered HTML view. Operators had no at-a-glance trend for post-run PES or tok/s across successive protocol runs, and the sidecar's existing `bench_gate.py` baseline gate operated on a single report rather than a history series. The dashboard must surface PES/tok/s over time as a sparkline inside the existing `ui-sidecar-panel` settings surface, remain functional offline (sidecar down = empty series, not error), and keep history pure and cap-bounded without introducing a new session event.

## Decision

- **`dsh-bench/src/history.ts` (new).** `BenchHistoryPoint {pes,tokPerSec,runName,timestamp}`, `pesOfReport`/`tokPerSecOfReport` accepting both `pes`/`composite` and `tokPerSec`/`tok_per_sec`/`throughput` shapes, `toHistoryPoint`, `normalizeHistory` (timestamp sort, cap 30, oldest dropped), `buildSparklinePath` (width/height box, Y inverted, flat series renders middle line), `fetchBenchHistory` (sequential `GET /v1/report/*` with per-request AbortController, skip failed). Consumed by the panel and by bench_gate history helpers.
- **`dsh-bench/src/index.ts` (extended).** Re-exports history surface, retains `/bench` command launch/summarize path, adds Config plain parse (no schemastery runtime dep). All report summarization keeps `PES n/a` fallback.
- **`ui-sidecar-panel/src/sparkline.ts` (new) + `src/index.ts` (extended).** Pure `buildSparklinePath`, `renderSparklineSvg` (width 120 height 32, role img, no-data empty svg), `buildPanelSparklines` (two datum entries, omit empty). Settings section `sidecar` retains host lifecycle render; bench datum is embedded as `bench` key for future slot renderers. Host half owns no new service; presentation mapping is pure.
- **`hive-memory/harness/bench_gate.py` (extended).** `extract_tok_per_sec`, `append_history` (JSON array of history points, cap 30, oldest dropped, timestamp ms), `load_history` (empty on missing/malformed). Wire-compatible with existing `extract_pes` baseline flow.

## Alternatives considered

- **New `bench/history` session event persisting every report.** Rejected: history is derived telemetry, not model-visible; persisting reports would duplicate run bundles and violate model-visible ⟺ logged.
- **Client-side localStorage for history.** Rejected: history must survive across browsers and be inspectable from Python; JSON file beside runs is the single source.
- **Chart library (chart.js, visx).** Rejected: sparkline is 1 path + 2 numbers; library would add bundle cost and shared-module wiring for no product gain.

## Consequences

- **S18 done.** Sidecar panel exposes PES/tok/s trend as SVG path data; bench surface can fetch sequential report history over `POST /v1/protocol/run`; Python gate can record and load capped history.
- **No hotspot edits.** New packages live outside `tsconfig.host.json` aggregates per Rule 3; standalone `tsc -b <pkg>` is the gate, consumed by future integration round.
- **Offline-safe.** Sidecar unreachable or report 404 skips silently; empty series renders "no data" svg.
