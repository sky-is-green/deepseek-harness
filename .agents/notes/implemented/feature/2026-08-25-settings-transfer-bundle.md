# Settings: transfer bundles move user layers and authored presets between hosts

- **Date:** 2026-08-25
- **Lane:** studio (S9)
- **Status:** implemented

## Decision

`@deepseek-ai/dsh-settings-transfer` owns the export/import bundle: one versioned JSON file carrying (a) the raw user sections of every registered settings namespace that has one, including `model-profiles`, and (b) every locally-authored preset as id + composition-file bytes. Import applies a section only through a namespace already registered on the importing host via `replace()`, so each value passes that owner's schema before anything persists; namespaces with no registered owner are skipped with a reason, never invented. Preset import byte-copies files into the first `user` root only, validating ids against the authoring seam's pattern and skipping existing same-id presets unless `overwritePresets` is set.

## Why

The row asked for "settings, presets, model profiles" in one move. Model profiles are themselves just another settings namespace (E9), so a bundle over raw user layers covers them for free; hand-building a profiles-specific format would have forked persistence. Preset import deliberately stays inside the authoring seam's trust boundary rather than punching through it: byte-copy into the user root preserves the property that an import grants no capability beyond what a manual file copy would, while system roots and schema-unvalidated text remain unreachable. Exports carry user overrides only because `base`/defaults belong to each deployment's own composition.

## Consequences

- A malformed or foreign namespace in a bundle is reported in `skippedNamespaces` instead of aborting the whole import; per-section schema failures land there too, so one bad namespace cannot block the rest.
- Field-level picking does not exist: `replace()` applies whole namespaces (absent keys re-inherit base/defaults), which is also what makes imports reproducible; selective merge waits for a consumer.
- The service binds preset roots explicitly (`bindPresetRoots`) instead of reaching into the presets plugin, so hosts without presets still transfer settings.
- Invariant companion is a justified empty: no events, no state, total transforms whose writes re-validate at their owners.
