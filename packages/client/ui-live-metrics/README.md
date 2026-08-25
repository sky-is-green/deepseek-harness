# @deepseek-ai/dsh-client-ui-live-metrics

English | [中文](README.zh.md)

Web client plugin contributing one `conversation.composer.dock` entry: a live decode-throughput and time-to-first-token line beside the composer, fed by the host-computed `liveTurnMetrics` projection (`dsh-session-live-turn-metrics`) through the standard `useProjection` seat. The readout appears with the first token's latency, gains the throughput figure once two timed points exist, marks the streaming phase, and keeps the provider-exact settled figures after message assembly. It renders nothing until the projection serves a view, and assemblies without the projection unit cost nothing.

## Composition

Registered into the existing `conversation.composer.dock` list seat (after the shipped stats line); no SlotMap changes. Requires the `liveTurnMetrics` projection unit in the host assembly.

```yaml
- id: ui-live-metrics
  name: '@deepseek-ai/dsh-client-ui-live-metrics'
```

## Model Experience

Read-only display of already-logged session events folded host-side; it never alters prompts, messages, schemas, streams, or tool results.

#### KV Cache effect

None; the plugin never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Estimate granularity while streaming** — mid-stream throughput inherits the projection's per-delta estimate; see the projection package's known limitations.
