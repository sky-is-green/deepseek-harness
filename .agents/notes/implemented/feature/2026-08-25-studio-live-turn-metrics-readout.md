# Studio: live tok/s readout rides a projection, not client-side event folding

- **Date:** 2026-08-25
- **Lane:** studio (S3)
- **Status:** implemented

## Decision

The composer-beside live tok/s + TTFT readout (`packages/client/ui-live-metrics`) sources its figures from a new host-side projection unit, `liveTurnMetrics` (`packages/session/live-turn-metrics`), registered on `ctx.sessionProjections`, instead of folding session events in the browser.

## Why

The client's settled metrics folds (`deriveTurnMetrics` in ui-conversation) only see `timing`/`usage` after `assistant/message`; nothing on the client snapshot carries step boundaries or first-token times while tokens stream. The two sanctioned live channels for composer-side UI are host-computed projections (the `useProjection` seat, pushed per event via `session/projection` frames) and Conversation Node location data — but location data is turn/step-scoped and has no consumer seat outside message renderers. The projection route reuses the exact seam StatsLine and ContextMeter already consume, needs zero shared-package edits, and keeps the fold replayable and cacheable by the registry rather than re-implemented per client.

## Consequences

- Streaming throughput is an estimate (one unit per non-empty token delta over first-token → latest-delta time); provider-exact figures replace it at `assistant/message`. A mid-stream `usage` sample could refine this later without touching consumers.
- The view tracks one step (streaming or last settled); history stays with the settled footer/StatsLine folds.
- Assemblies without the unit simply serve no key; the readout renders nothing.
