---
description: "HiveBench Studio benchmark surface: launch P1-P11 protocol runs through the hive sidecar and summarize reports"
kind: "package-reference"
---

# dsh-bench

English | [中文](README.zh.md)


## Summary

HiveBench Studio benchmark surface: launch P1-P11 protocol runs through the hive sidecar and summarize reports

**HiveBench Studio benchmark surface**: launch P1–P11 protocol runs through the hive sidecar and summarize their reports, without leaving the agent.


## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Commands

- `/bench [live|mock] [max-convs]` — launch a protocol run via the sidecar (`POST /v1/protocol/run`, background process) and summarize the report once it is ready (`PES 73.1 (YELLOW) | protocol: 6 PASS / 3 FAIL / 2 SKIP`). While the run is in flight it reports `launched (pid N); report pending`.
- `/bench <run-name>` — collect an existing run (e.g. `/bench protocol_20260824_120000`): fetch and summarize its report without launching anything new.

Every launch is recorded as a log-only `bench/run` session event (never model-visible). The invariant companion (`@deepseek-ai/dsh-bench/invariant`) validates those records.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `sidecarUrl` | `http://127.0.0.1:8765` | hive sidecar origin |
| `timeoutMs` | `15000` | per-request timeout |
| `enabled` | `true` | master switch (off == no `/bench` command) |

## Usage

```yaml
- id: dsh-bench
  name: '@deepseek-ai/dsh-bench'
  config:
    sidecarUrl: http://127.0.0.1:8765
```

## Model Experience

### Protocol bench runner

#### What the model sees

Nothing directly. `/bench` launches a protocol run inside the hive sidecar, whose own agent bridge drives those conversations; this package records launch outcomes as log-only `bench/run` events and never assembles request content.

#### Token effect

Protocol conversations consume tokens inside their own sessions and are accounted there; the command itself adds none.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Regression gate

The committed baseline is `baseline.json` (`{pes: 73.1}` from the stub report; replace when live PES is established). Pure helpers `evaluateGate(report, baseline, threshold)` / `exitCodeFor(decision)` compare `report.post_run_pes.pes` vs `baseline.pes` (threshold 0 = any drop fails). The headless CI gate is `node scripts/check-pes-baseline.mjs --report <report.json> [--baseline packages/hive/dsh-bench/baseline.json] [--threshold 0]` — exits `1` on regression, `0` otherwise (missing PES skips the gate). Wire it as `pnpm bench:gate` or in CI after `/bench`.

## Known Limitations and Deferred Work

- **Report collection is pull-based** — a run still executing reports as pending; re-run `/bench <run-name>` to collect the finished report.
- **Baseline is stub PES** until live P1–P11 runs establish the real PES.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
