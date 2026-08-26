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
| `maxCurationSteps` | `1` | refresh curation on up to this many steps of each turn; rounds 2+ reuse the turn's original query, and each round injects a fresh `snapshot` that supersedes the previous one |

## Curation telemetry

Every successful round attaches non-model-visible quality metrics to the injection's durable source — `source.curation = { round, maxRounds, turn, pes, degradationLevel, tokenCount, mode }`. Provider payloads never see them; the values ride the log, so replay rebuilds them. The plugin also registers the `hiveCuration` projection (bounded to the last 16 rounds) so devtools surfaces can read the trajectory of `pes` / degradation across a session through the ordinary projection channel.

## Events

Durable `user/message` entries with `source.kind === 'plugin'`, `source.plugin === 'dsh-hive'`, `form: 'snapshot'` — the curated context the model read, exactly as injected, plus the optional `curation` telemetry block described above. The invariant companion (`@deepseek-ai/dsh-hive/invariant`) validates their shape on load and append.

## Usage

```yaml
- id: dsh-hive
  name: '@deepseek-ai/dsh-hive'
  config:
    sidecarUrl: http://127.0.0.1:8765
    conversationKey: workspace
```

## Model Experience

### Curated context injection

#### What the model sees

On each claimed step the curator queries the sidecar (`POST /v1/hive/curate`) and may add bounded context blocks to the step's message assembly — model-visible injected `user/message` content by design, labeled by its durable source. Finished replies are observed back to the store via `POST /v1/hive/observe` with no prompt effect.

#### Token effect

Injected curation blocks add tokens to the steps where they were accepted, bounded by the sidecar's response budget. The per-round quality metrics attached to the injection are non-model-visible telemetry.

#### KV Cache effect

Appended-only. Injected blocks enter history after the stable prefix of prior turns, so they grow the per-turn suffix without invalidating earlier cache entries; rounds that return no context leave the request unchanged.

## Known Limitations and Deferred Work

- **Non-streaming curate face only** — the sidecar's `/v1/hive/stream` ingestion is not consumed yet; streaming curation waits on that wire contract.
