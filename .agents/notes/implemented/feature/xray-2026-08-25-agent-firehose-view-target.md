# Agent Note: Event firehose as a bounded rolling view target

Status: implemented

## Problem

X3 calls for a live `agent/*`/`tools/*` firehose with per-turn waterfall
timing. Live agent waterfalls never cross the wire — they are in-process host
waterfalls — but the durable session log does cross it in full: every
committed event of the loaded window ships to the browser, and no UI surface
exposed that raw stream. Per-turn timing existed only inside ui-trajectory's
private stage layout.

## Decision

`@deepseek-ai/dsh-client-ui-devtools-agent-firehose` registers the third
`ConversationViewSnapshotMap` target, `agent-firehose`, fed by ONE catch-all
conversation Definition (`kind: 'agent-firehose-event'`, one context per
event seq) that matches every committed event regardless of which business
Definitions also matched it. The snapshot builder retains only the most
recent 400 rows and derives waterfall spans by pairing step boundaries and
`toolCallId`-keyed call/result rows inside that window, so replay stays a
pure function of the window. Streaming chunk rows publish at animation-frame
cadence so token floods cannot thrash rendering. The tab ships as a
devtools opt-in: the web-app roster row is inserted `disabled: true`, enabled
by replacing the row from a later patch layer (same protocol as the prompt
inspector).

The bounded rolling window is a deliberate new convention for view snapshots:
prior builders retained everything and virtualized at render time. A cap is
what makes an every-event target affordable, and 400 is spelled as a constant
of this package's wire shape.

## Alternatives considered

- Reusing trajectory's timing model: rejected — cross-package imports of
  another plugin's internals are forbidden, and its stage-oriented cells are
  not an event ledger.
- A host-side projection for the firehose: rejected — the events already
  reach the browser verbatim; folding them again host-side would double the
  work and grow checkpoint state for data the client already holds.
- Unbounded retention with render-time virtualization: rejected for v1 —
  every-event contexts make unbounded growth quadratic in memory; the cap
  documents the trade instead.

## Consequences

Spans whose closing row aged out of the window render open or vanish, and a
turn whose opening row left shows no bounds — the README documents the
window's semantics. One context per event seq multiplies assembler work on
large windows, acceptable for a disabled-by-default devtool and not a pattern
for product surfaces. Unknown merge-extensible event types degrade to a JSON
head so a foreign or newer log still renders.
