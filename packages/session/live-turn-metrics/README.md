# @deepseek-ai/dsh-session-live-turn-metrics

English | [中文](README.zh.md)

Function plugin registering the `liveTurnMetrics` projection unit: the most recent assistant step's time-to-first-token and decode-throughput readout, folded live from step boundaries, token-delta chunks, and assembled messages, and served through the session-projection seam (`session/projection` push frames) so a composer-beside renderer updates while tokens stream. The view tracks one step at a time — the currently streaming one, or the last that assembled a message. The reference consumer is the web client's composer dock readout (`dsh-client-ui-live-metrics`); the whole-log counterpart is `dsh-session-stats`.

## Fold semantics

- `step/start` opens the tracked step's boundaries; the previous settled view stays visible until the new step's first token arrives, so the readout does not flash off between steps.
- The first non-empty token delta stamps TTFT (`step/start` → first token) and starts the decode span; each further non-empty delta advances a per-delta count. While streaming, throughput is an estimate: deltas over first-token → latest-delta time (most providers stream roughly one chunk per token).
- `assistant/message` settles the step: throughput becomes provider-exact output tokens over first-token → message time when the usage record reports them, otherwise the stream estimate freezes at the last delta.
- A step that closes via `step/end` without a message (cancelled, failed) drops its boundaries and keeps showing the last settled figures.
- Throughput is omitted until two timed points exist, so the first token never divides by zero.

## Composition

```yaml
- id: live-turn-metrics
  name: '@deepseek-ai/dsh-session-live-turn-metrics'
```

Injects `sessionProjections` — the plugin's whole purpose; in assemblies without the registry the fiber stays pending and nothing registers.

## Model Experience

### Live step metrics readout

#### What the model sees

Nothing. The `liveTurnMetrics` unit only computes a client-facing read model of already-logged session events — delivered via `session/projection` frames — and touches no prompt, message, schema, stream, or tool result.

#### Token effect

Zero. Figures describe tokens already counted where their events were produced.

#### KV Cache effect

None; the plugin never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Streaming throughput is an estimate** — providers that report usage only with the assembled message leave the mid-stream figure at per-delta granularity; a mid-stream `usage` sample could refine it later (token-meter already treats such samples as valid).
- **One step of history** — the unit keeps only the most recent step; per-step history lives in the settled turn footer and StatsLine folds instead.
