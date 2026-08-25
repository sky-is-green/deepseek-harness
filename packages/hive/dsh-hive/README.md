# dsh-hive

English | [中文](README.zh.md)

**HiveBench Studio curator**: assemble bounded, relevance-ranked context via the hive sidecar on every agent step.

On each step the plugin asks the sidecar (`POST /v1/hive/curate`) for the curated context of the step's query and folds it into the request as a source-attributed `plugin` message (dsh's convention for system-prompt content — one leading context, never a second system message). The shell's own model routing generates; the plugin observes the finished reply back (`POST /v1/hive/observe`) so the store and comb ingest it for later turns.

Failure is soft by design: when the sidecar is down or times out, the step passes through uncurated — disabling the plugin reproduces the plain harness (mechanism attribution).

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `sidecarUrl` | `http://127.0.0.1:8765` | hive sidecar origin |
| `conversationKey` | `workspace` | one hive store per workspace (stable across sessions) or per session |
| `timeoutMs` | `10000` | per-request timeout |
| `enabled` | `true` | master switch (off == plain harness) |

## Events

Durable `user/message` entries with `source.kind === 'plugin'`, `source.plugin === 'dsh-hive'`, `form: 'snapshot'` — the curated context the model read, exactly as injected. The invariant companion (`@deepseek-ai/dsh-hive/invariant`) validates their shape on load and append.

## Usage

```yaml
- id: dsh-hive
  name: '@deepseek-ai/dsh-hive'
  config:
    sidecarUrl: http://127.0.0.1:8765
    conversationKey: workspace
```
