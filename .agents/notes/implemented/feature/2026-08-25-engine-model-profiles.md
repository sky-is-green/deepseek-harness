# Engine: per-model serving profiles live in one settings-backed seam

- **Date:** 2026-08-25
- **Lane:** engine (E9)
- **Status:** implemented

## Decision

`@deepseek-ai/dsh-model-profiles` owns per-model serving profiles (sampling params, default system prompt, default serve-time context length) keyed by catalog model id, stored as one settings namespace (`model-profiles`) through `installSettingsSection`. Resolution is explicit-over-implicit at the boundary: `applyToLoadRequest` never overrides a request-supplied field, and the profile fills only what the request left unset. Reads degrade to the empty composition entry without a settings provider; writes throw instead, because a silently dropped save would report success while losing user data. Range validation (temperature `[0, 2]`, integer `topK >= 0`, integer `contextLength >= 256`, etc.) runs as a registration/write validate hook that refuses the offending write by name.

## Why

S1's manager cards mock profiles today and S9's transfer bundles them tomorrow, so persistence had to exist behind the same optional-settings contract every other consumer uses rather than a bespoke file format. The settings seam already provides layered resolution, revision conflicts, external-edit resync, and HMR-safe disposal; owning a second store would duplicate all four. Sampling params are resolved here but not auto-sent: wiring them into generation requests belongs to the local generation route (E7 verdict), keeping this seam free of transport vocabulary.

## Consequences

- A malformed externally-edited section rejects the namespace registration while the service stays mounted on its empty entry — reads see "no profiles" until the document is repaired, matching the settings seam's documented externally-edited-document behavior.
- Clearing one saved field is not yet surfaced (`save` deep-merges, `remove` forgets whole profiles); callers needing it use the settings `mutate` path API directly.
- The invariant companion is a justified empty: no events, no state beyond the namespace, total pure resolution functions.
