# Agent Note: Evidence pass as pure folds over replay-validated log reads

Status: implemented

## Problem

X15 starts the preset trainer: mine session logs for successful tool-use
traces, failure modes, and unused tools per preset. Two traps shaped the
design. Preset attribution and outcome facts are durable but scattered —
header field, `agent-preset/selected` events, `request/header.tools`
catalogs, call/result pairs across four event types — so any consumer that
re-derives them ad hoc will drift. And a naive miner reading JSONL files
directly would fork the access path the Gateway already serves, losing the
replay validation and store abstraction the session-query seam provides.

## Decision

`@deepseek-ai/dsh-preset-trainer` splits into two faces:

- **Pure library** (`collectEvidence(snapshots)`): folds complete
  `SessionLogSnapshot`s into per-preset evidence — per-tool ok/error/
  unsettled counts with code histograms, successfulTraces (call→ok pairs),
  failure modes (model errors, retries, TOOL_TIMEOUTs, combined code
  histogram), and unusedTools (final `request/header` catalog minus called).
  Attribution reuses `resolveSessionPreset`; pairing follows session-stats'
  own-key callId discipline; classification matches failure-forensics.
  Deterministic output ordering keeps reports diffable.
- **Runner** (`mineEvidence(ctx)` + a thin `trainer:evidence` bin): opens
  whatever SQLite store the mounted engine serves via one `listSessions` pass
  plus `readSession` per record — the Gateway's own replay-validated read
  path — and writes JSON.

Read-only by construction: no plugin body, no writes, nothing model-visible.

## Alternatives considered

- Reading persistence JSONL directly in a script: rejected — forks the store
  abstraction and skips replay validation; the query seam's `readSession`
  already guarantees a reconstructed, validated log.
- A Cordis plugin/command emitting evidence on demand: deferred — X16/X17
  will need candidate drafting and bench scoring as jobs; the evidence pass
  is deliberately a library plus bin so those stages compose it rather than
  wrap it.
- Sampling tool arguments into the report: rejected v1 — arguments may carry
  secrets; aggregate outcomes answer the training question without a
  redaction layer.

## Consequences

The whole corpus is folded in memory, fine for studio-scale stores and a
documented limit before paging through `searchEvents`. Reports are
deterministic given the same logs and timestamp input, which is what makes
them diffable artifacts for the later promotion flow. The `(none)` preset id
collects sessions that never declared one, so unattributed traffic shows up
in reports instead of silently disappearing.
