# @deepseek-ai/dsh-preset-trainer

Preset trainer passes over agent presets: an evidence pass mining durable session logs into per-preset tool-success, failure-mode, and unused-tool reports (the evidence base later stages draft composition changes against), and an evaluation pass scoring a candidate composition against a baseline run.

## What it computes

For every session, grouped by the resolved agent preset (`resolveSessionPreset`: the last `agent-preset/selected` event, falling back to the header field; `(none)` when neither exists):

- **Per-tool outcomes** — calls, ok, errors (with an error-code histogram), and unsettled calls whose result never landed before the turn ended.
- **`successfulTraces`** — call→ok-result pairs, the traces worth training on.
- **Failure modes** — model errors (`turn/end` reason `error`), provider retries (`llm/retry`) with code histogram, structured tool timeouts (`TOOL_TIMEOUT`), and a combined code histogram.
- **Unused tools** — names present in the session's final assembled catalog (`request/header.tools`) but never called.

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

## Evaluating a candidate against a baseline

An `EvalRun` is one task list executed under one preset label: `{ label, generatedAt, pes?, tasks }`, where each task carries a stable id and a terminal `passed` verdict and `pes` mirrors the sidecar's run-level `post_run_pes.pes`. The comparison core turns two runs into a verdict:

```ts
import { compareRuns, summarizeEvalRun } from '@deepseek-ai/dsh-preset-trainer'

const comparison = compareRuns(baselineRun, candidateRun, { maxPesDrop: 0.05 })
comparison.ok // false when any threshold breaks or the candidate skipped tasks
comparison.reasons // concrete causes: which tasks flipped, by how much the PES moved
```

Verdict rules, all explicit: the candidate must execute every baseline task; net new failures (regressions minus gains) stay within `allowNewFailures` (default 0); the PES drop stays within `maxPesDrop`. Extra candidate tasks are reported but never penalized. Duplicate task ids inside one run throw — that is a broken artifact, not comparable data.

## Model Experience

### Session-log evidence mining

#### What the model sees

Nothing. The trainer read-only folds already-committed session logs through `collectEvidence` into aggregate evidence reports, surfaced by the `trainer:evidence` bin; reports are human-facing artifacts for composition work and never enter a prompt assembly.

#### Token effect

Zero. Mined figures describe tokens already counted inside their own sessions, and mining adds none.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- Reports are aggregates; argument payloads are deliberately not sampled (they may carry secrets). Trace-level evidence with redaction is deferred until a consumer needs it.
- The whole corpus is folded in memory; very large stores would want paging through `searchEvents` instead of whole-log `readSession` snapshots.
- **Evaluation execution is not wired yet** — `compareRuns` scores runs it is handed; nothing here launches headless sessions or emits `ctx.jobs` work. The live executor port and job producer land as the keyed-e2e follow-up to this core.
