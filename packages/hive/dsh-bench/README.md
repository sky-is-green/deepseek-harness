# dsh-bench

English | [中文](README.zh.md)

**HiveBench Studio benchmark surface**: launch P1–P11 protocol runs through the hive sidecar and summarize their reports, without leaving the agent.

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