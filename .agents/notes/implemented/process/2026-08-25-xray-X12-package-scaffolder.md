# Agent Note: Package scaffolder emits the cookbook host skeleton

Status: implemented

English | [中文](2026-08-25-xray-X12-package-scaffolder.zh.md)

## Problem

X12 asked for a generator emitting the cookbook package skeleton. Adding a host package by hand meant copying a neighbor package and adjusting six manifest invariants (`constraints` enforces exact `files` lists, top-level vs exports `types` spelling, release-member fields, peer/dev mirroring), and each of this session's new packages tripped at least one of those gates on first run.

## Decision

`scripts/scaffold-package.ts` (root script `scaffold-package`) emits the cookbook section-1 skeleton for a host package into `packages/<group>/<pkg>/`: manifest with every constraints invariant baked in, tsconfig with the cookbook references (cosmokit/cordis/schemastery when `--config`, plus invariants), plugin-or-service `src/index.ts` via `--kind`, a justified-empty invariant companion, and a README stub carrying the required Model Experience / Known Limitations sections. It refuses existing directories and kebab-case violations, then prints the manual steps that cannot be generated safely: aggregate reference line, base-paths entries for groups uncovered by the wildcard (per the xray-2026-08-25 note), TODO fill, and the gate commands.

Proof obligation runs live: generate into a throwaway directory, register it in an aggregate, and the three gates (constraints, per-package `tsc -b`, scoped oxlint) exit 0 before any human edit — verified during development, then removed.

## Alternatives considered

- Also generating client-plugin skeletons: deferred — the client contract (dsh.client manifest, module-graph externals, static vs dynamic faces) has its own checklist under packages/client/AGENTS.md; folding both into one template would have doubled the surface without a second consumer.
- Emitting the aggregate/tsconfig registrations automatically: rejected — those files are hotspot locks; a generator writing them would bypass the single-commit protocol the board enforces.
- A vitest spec asserting template output: rejected — scripts are not in the coverage plane; the live gate proof is stronger than golden-file equality, which would just mirror the templates.

## Consequences

Templates now own the manifest-invariant knowledge, so drift shows up as a gate failure against freshly generated packages rather than as tribal copy- from-neighbor knowledge. The generator is intentionally noisy about manual steps — silent registration was the alternative, and hotspots must stay human-committed.
