# Agent Note: Hive curation rounds and telemetry without a new event type

Status: implemented

## Problem

X10 asks for multi-step curation behind config and for the sidecar's
response-side quality scores (`pes`, `degradation_level`) to surface as
non-model-visible telemetry. The curator fired only on step 1 and dropped
every score on the floor. The obvious carrier — a new session event — would
touch frozen core `SessionEventMap`, force dual-SDK expected-output updates,
and re-record data the injection already durably represents.

## Decision

Two changes inside `@deepseek-ai/dsh-hive` (wire contract untouched):

- **Multi-round gate**: `maxCurationSteps` (default 1 = historical behavior)
  lets rounds 2..N of a turn re-curate. Round 1 prices the claimed batch's
  fresh query; later rounds reuse the turn's original query so the sidecar
  can refresh the assembly as observed traffic evolves the conversation.
  Each round injects a fresh `form: 'snapshot'` message — the context form
  whose later snapshots supersede earlier ones, so multiple rounds need no
  new semantics. Per-session state tracks `{turn, query, rounds}`; a new
  turn resets it.
- **Telemetry**: every successful round writes
  `source.curation = { round, maxRounds, turn, pes, degradationLevel,
  tokenCount, mode }` onto the injection's durable source. Message sources
  are producer-owned merge-extensible metadata that never reach a provider
  payload, so the values are durable, replayable, and non-model-visible by
  construction — no new event type. The same plugin registers the
  `hiveCuration` projection unit (bounded to 16 entries) folding those
  sources, giving devtools surfaces the pes/degradation trajectory through
  the ordinary projection channel. The invariant companion validates the
  block's shape so a malformed producer fails loud.

## Alternatives considered

- New `ignorable` session event for curation outcomes: rejected — core
  SessionEventMap is frozen for lanes, requires both SDKs' snapshot updates
  in the same PR, and duplicates what the injection's source can carry.
- `ctx.sessionTelemetry` ops records: rejected for this data — the seam's
  outbound vocabulary is coordinator-owned (`agent-error`, `shutdown`) and
  its backends leave the process; per-round quality belongs beside the
  durable artifact it describes, readable by replay and clients alike.
- Sidecar-driven multi-round via the request's unused `config` field:
  deferred — the plugin-side loop needs no wire change and works against
  today's frozen contract; if the Python side grows native multi-round,
  `CurateRequest.config` is the reserved seat.

## Consequences

Rounds beyond the first cost one sidecar round-trip each and add another
snapshot message to the log (the superseded predecessor remains until
compaction) — documented in the README's Model Experience trade. The
projection folds only this plugin's own injections; a foreign producer
writing `source.plugin === 'dsh-hive'` would be folded too, which the
invariant's shape checks make an authoring error rather than silent input.
