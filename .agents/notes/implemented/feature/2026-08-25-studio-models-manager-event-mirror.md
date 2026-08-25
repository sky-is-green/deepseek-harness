# Agent Note: The models manager mirrors the event stream instead of polling

Status: implemented

## Problem

Download progress is per-chunk high-frequency state owned by the provider; polling `downloads()` would lag and multiply wire chatter, while action-rejection error handling would duplicate the failure facts the `load-state failed` transition already publishes. The UI needs one sanctioned channel for a registrant-private observable so it stays a pure projection of the service grammar.

## Decision

The local-models settings section keeps a package-private snapshot store fed exclusively by the `ctx.models` event stream (`catalog-updated`, `load-state`, `download-started/progress/settled`) plus one initial pull, delivered to the component through the slot hooks compartment as a bound selector hook. Load/unload/download actions fire-and-forget into the service; failures surface only through the mirrored `failed` events, not through action rejections. The hooks compartment is the sanctioned channel for a registrant-private observable, and mirroring-only keeps the UI aligned with the grammar the dsh-models invariant companion already enforces.

## Alternatives considered

- Poll `downloads()`/`listModels()` on an interval — rejected: laggy for per-chunk progress and multiplies wire chatter for state the event stream already pushes.
- Surface action failures through promise rejections in addition to events — rejected: it duplicates failure facts the `failed` transition publishes, creating two sources of truth for the same outcome.

## Consequences

- The section is absent by design until a Service Provider mounts — the inject on `models` stays pending, matching the loud-absence rule for a seam whose provider (E4) has not landed.
- Cancellation works only for downloads this client started: the face cancels through the `startDownload` handle, so the plugin keeps a handle map keyed by download id; id-addressed cancellation would be a seam addition.
