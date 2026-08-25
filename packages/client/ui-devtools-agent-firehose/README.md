# @deepseek-ai/dsh-client-ui-devtools-agent-firehose

Live session-event firehose for the dsh web client: a conversation view tab
showing every committed event in the loaded window as it arrives, plus a
per-turn waterfall of step and tool spans.

## What it shows

- **Per-turn timeline** — one lane per turn represented in the retained
  window. Step spans (`T{turn}.S{step}`) render from paired `step/start` /
  `step/end` rows; tool spans render from paired `tool/call` / `tool/result`
  rows inside the step; failed tool calls (error results) are marked red.
  Turns still running render an open-ended lane.
- **Recent events** — a rolling table of the last 400 committed events (seq,
  time, type, bounded payload summary), newest first. Every event type is
  captured by a catch-all Definition, independent of which business
  Definitions also matched; unknown merge-extensible types degrade to a JSON
  head instead of dropping the row.

Streaming chunk rows publish at animation cadence so a token flood cannot
thrash the render loop; every other event publishes immediately.

## Enabling it

The web-app bundle ships the row disabled — this is a devtools surface, not
production chrome. Re-enable it from any later patch layer by targeting the
row id and replacing it without `disabled`:

```yaml
- id: ui-devtools-agent-firehose
  name: '@deepseek-ai/dsh-client-ui-devtools-agent-firehose'
```

## Model Experience

- **Token cost:** zero — pure client-side projection of already-logged events.
- **KV-cache effect:** none; never mounted as a model-facing component.
- **Replay:** rows and waterfall spans are pure folds of durable events, so
  replaying a log rebuilds identical snapshots.

## Semantics and limits

The window is capped at 400 rows: older events leave the snapshot as new ones
arrive, and spans whose closing row left the window render as open or vanish
(calls whose result left stay pending). Waterfall spans are derived from the
retained window only, so a turn whose opening row aged out shows no turn-level
bounds. The catch-all Definition creates one context per event seq in the
loaded window — acceptable for a disabled-by-default devtool, not a pattern
for product surfaces.

## Extension points

None. Consumers wanting more per-event data should extend the durable event
set; this package stays a read-only view over it.

## Known Limitations and Deferred Work

- No virtualization above the 400-row cap; larger windows would need the
  trajectory view's virtualization machinery.
- Subagent call trees render flat (one span per call), like the chat ledger.
