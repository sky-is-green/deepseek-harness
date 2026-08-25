# Agent Note: Live tok/s readout rides a projection, not client-side event folding

Status: implemented

## Problem

The client's settled metrics folds (`deriveTurnMetrics` in ui-conversation) only see `timing`/`usage` after `assistant/message`; nothing on the client snapshot carries step boundaries or first-token times while tokens stream, so a composer-beside live readout has no client-side data source without inventing one.

## Decision

The live tok/s + TTFT readout (`packages/client/ui-live-metrics`) sources its figures from a new host-side projection unit, `liveTurnMetrics` (`packages/session/live-turn-metrics`), registered on `ctx.sessionProjections`, instead of folding session events in the browser. Host-computed projections (the `useProjection` seat, pushed per event via `session/projection` frames) are one of the two sanctioned live channels for composer-side UI; this route reuses the exact seam StatsLine and ContextMeter already consume, needs zero shared-package edits, and keeps the fold replayable and cacheable by the registry rather than re-implemented per client.

## Alternatives considered

- Fold session events in the browser into a client store — rejected: client snapshots carry no step boundaries or first-token times while streaming, so the fold would need new shared-package surface.
- Attach the figures as Conversation Node location data — rejected: location data is turn/step-scoped with no consumer seat outside message renderers, which a composer-docked readout is not.

## Consequences

- Streaming throughput is an estimate (one unit per non-empty token delta over first-token → latest-delta time); provider-exact figures replace it at `assistant/message`. A mid-stream `usage` sample could refine this later without touching consumers.
- The view tracks one step (streaming or last settled); history stays with the settled footer/StatsLine folds.
- Assemblies without the unit simply serve no key; the readout renders nothing.
