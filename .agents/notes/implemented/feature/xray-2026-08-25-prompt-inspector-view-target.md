# Agent Note: Prompt inspector as a second conversation view target

Status: implemented

## Problem

X2 calls for a per-step assembled-request inspector, but the durable log
records a request header only when the effective envelope changes, and no UI
surface exposed those headers, the tool catalog they carried, or the
producer-injected context messages beside them. The trajectory view already
consumes request headers internally, but its snapshot type and builder are
private to that package, and cross-package imports of another plugin's symbols
are forbidden.

## Decision

`@deepseek-ai/dsh-client-ui-devtools-prompt-inspector` registers the second
`ConversationViewSnapshotMap` target, `prompt-inspector`, fed by two
conversation Definitions of its own: one per logged `request/header` and one
per producer-supplied `user/message` (sources `user`, `model`, and `tool` are
excluded — they already have transcript presentation). Diff badges
(initial / system-changed / tools-changed) are derived in the target's
snapshot builder from each row's predecessor, keeping replay a pure function
of log order. The view tab renders rows plus the token-meter
`contextBreakdown` and `tokenUsage` projections; it defines no service,
writes nothing to the log, and adds nothing model-visible.

Adding a second member to `ConversationViewSnapshotMap` also surfaced a latent
typing cost: a test stub serving one key with a concrete value no longer
type-checks against the generic `views.get` wire signature. The two affected
spec stubs cast their single-key getter explicitly; future view targets should
expect the same one-line accommodation.

## Alternatives considered

- Reusing the trajectory target's output from the new tab: rejected — it would
  couple two plugins through non-slot imports and break when ui-trajectory
  recomposes.
- A host-side tokens-per-source projection unit: deferred — exact per-source
  attribution under compaction needs per-source shadow-price bookkeeping that
  bounded projection state cannot express; the composition-level breakdown
  answers the inspector's question today.
- Client-side duplication of the token estimator for per-source figures:
  rejected — the fixed-density heuristic has one home in
  `@deepseek-ai/dsh-token-meter`, and a browser copy would drift.

## Consequences

Steps that inherit an unchanged envelope render under their carrying header's
row rather than getting a row of their own; the README documents this as a
known limitation. Section-level attribution (which prompt section produced
which part of the system text) remains impossible from the durable log, so the
inspector shows exactly what was logged. Relocating the hive sidecar
drift-gate surface from bare `packages/hive/scripts` into
`packages/hive/dsh-hive` fixes a clean-tree host-build failure the earlier
placement caused: tsdown's root workspace glob treats any `packages/*/*`
directory without its own config as a package and failed entry resolution on
it.
