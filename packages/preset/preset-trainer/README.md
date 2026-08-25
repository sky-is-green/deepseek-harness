# @deepseek-ai/dsh-preset-trainer

Preset trainer evidence pass (X15): mines durable session logs into a
per-agent-preset report of successful tool-use traces, failure modes, and
unused tools — the evidence base later trainer stages draft composition
changes against.

## What it computes

For every session, grouped by the resolved agent preset
(`resolveSessionPreset`: the last `agent-preset/selected` event, falling back
to the header field; `(none)` when neither exists):

- **Per-tool outcomes** — calls, ok, errors (with an error-code histogram),
  and unsettled calls whose result never landed before the turn ended.
- **`successfulTraces`** — call→ok-result pairs, the traces worth training on.
- **Failure modes** — model errors (`turn/end` reason `error`), provider
  retries (`llm/retry`) with code histogram, structured tool timeouts
  (`TOOL_TIMEOUT`), and a combined code histogram.
- **Unused tools** — names present in the session's final assembled catalog
  (`request/header.tools`) but never called.

## Usage

Library face (what later trainer stages consume):

```ts
import { collectEvidence } from '@deepseek-ai/dsh-preset-trainer'
const report = collectEvidence(snapshots)
```

Headless CLI over any SQLite session-query store:

```sh
node --import tsx packages/preset/preset-trainer/src/bin.ts \
  --db /path/to/session-query.db --out evidence.json
```

Or programmatically against a mounted engine:

```ts
import { mineEvidence } from '@deepseek-ai/dsh-preset-trainer'
const report = await mineEvidence(ctx) // ctx carries `sessionQuery`
```

## Model Experience

- **Token cost:** zero — read-only folds over already-logged events.
- **KV-cache effect:** none; never mounted as a model-facing component.
- **Replay:** reports are pure functions of the durable logs, so replaying
  any session rebuilds identical numbers.

## Known Limitations and Deferred Work

- Reports are aggregates; argument payloads are deliberately not sampled
  (they may carry secrets). Trace-level evidence with redaction is deferred
  until a consumer needs it.
- The whole corpus is folded in memory; very large stores would want paging
  through `searchEvents` instead of whole-log `readSession` snapshots.
