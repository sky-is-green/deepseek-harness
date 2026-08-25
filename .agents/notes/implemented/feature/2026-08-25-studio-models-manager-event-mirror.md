# Studio: the models manager mirrors the event stream instead of polling

- **Date:** 2026-08-25
- **Lane:** studio (S1)
- **Status:** implemented

## Decision

The local-models settings section keeps a package-private snapshot store fed exclusively by the `ctx.models` event stream (`catalog-updated`, `load-state`, `download-started/progress/settled`) plus one initial pull, delivered to the component through the slot hooks compartment as a bound selector hook. Load/unload/download actions fire-and-forget into the service; failures surface only through the mirrored `failed` events, not through action rejections.

## Why

Download progress is per-chunk high-frequency state owned by the provider; polling `downloads()` would lag and multiply wire chatter, while action-rejection error handling would duplicate the failure facts the `load-state failed` transition already publishes. The hooks compartment is the sanctioned channel for a registrant-private observable, and mirroring-only keeps the UI a pure projection of the service grammar (which the dsh-models invariant companion already enforces).

## Consequences

- The section is absent by design until a Service Provider mounts — the inject on `models` stays pending, matching the loud-absence rule for a seam whose provider (E4) has not landed.
- Cancellation works only for downloads this client started: the face cancels through the `startDownload` handle, so the plugin keeps a handle map keyed by download id; id-addressed cancellation would be a seam addition.
