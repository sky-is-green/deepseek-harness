# Agent Note: 2026-08-26-u4-static-gate-and-pairing-restoration

Status: implemented

English | [中文](2026-08-26-u4-static-gate-and-pairing-restoration.zh.md)

## Problem

PR #2 (`hive-studio` → `master` on the fork) ran red across the static gate family: translation pairing rejected twelve in-scope documents and every lane-authored note lacked a counterpart or record, three generated catalogs were stale against merged engine packages, the subsystem index omitted the new `models.md` page, knip flagged an unlisted binary, the production site build collided with its own previous twin output, and the claims gate rejected legal hotspot commits.

## Decision

- **Pairing corpus restored to full green (1040 pairs).** Every lane-authored Agent Note now carries both switchers plus a `.i18n.yaml` record; six package READMEs gained Chinese counterparts; four diverged pairs (`ui-live-metrics`, `ui-models-manager`, `dsh-bench`, `dsh-hive`) were re-synced to their English side; the five generated catalogs' Chinese sides mirror their regenerated English tables, lists, links, mermaid fences, and pasted type declarations.
- **Generated-catalog staleness fixed at the source.** `gen-config-catalog.ts` rejects `inject` arrays it cannot parse; `packages/models/models-local/src/index.ts` now declares `static inject = ['subprocess']` plainly (37 existing packages already do), instead of teaching the generator the one-off `as const` form. `gen-module-graph.ts` was run separately from `gen-doc-graphs.ts` — they own different files.
- **Site build made repeatable.** The raw-Markdown twin refuses to overwrite files it did not claim, so a stale `website/.dist` from a previous build fails the next one; `docs:build` and `docs:build:mpa` now remove `website/.dist` before invoking VitePress. VitePress's own `emptyOutDir` did not take effect for this tree.
- **Claims-gate defects fixed** (`scripts/check-claims.mjs`, owned by this task): the hotspot alone-check used glob matching against root-anchored hotspots (`'/package.json'`), so a hotspot commit could never contain its own file; membership now shares one predicate with detection. A bare `**` glob degraded to `.[^/]*` because replacement output was rescanned; tokenization replaces in one pass.
- **Foreign-tree accommodations:** the abandoned S8 `command-kill` scaffold (never registered, never compiled) was quarantined out of `packages/` so package-scoped gates scan real packages only, and `gh` joined knip's `ignoreBinaries` for the ops collector script.

## Alternatives considered

- Teach `gen-config-catalog.ts` to unwrap `as const` inject arrays — rejected: one package deviated from 37 others; the generator error message already names the convention.
- Re-translate whole generated catalogs — rejected: the pairing contract patches counterparts minimally against the edited side; catalog cells are generator-owned literals except prose notes.

## Consequences

The fork's static gate has a clean local baseline again; the only remaining local red is the documented `EPERM symlink` host-sandbox class that CI owns. Catalog regeneration now requires the paired zh sync as part of the same change, which is what the freshness gates always implied. The quarantined scaffold's provenance and contents are recorded in the coordination plan's working notes for its owner to reclaim or delete.
