# Agent Note: Fork-added package groups need explicit base-paths entries

Status: implemented

English | [中文](2026-08-25-xray-base-paths-source-mapping.zh.md)

## Problem

Vitest resolves bare workspace specifiers through `tsconfig.base.json`'s `paths` (vite-tsconfig-paths over that file), falling back to package-exports resolution — the built `lib/` — for anything unmapped. The fork-added `packages/hive` and `packages/runtime-diagnostics` groups had no entries, so specs importing `@deepseek-ai/dsh-hive` silently executed a STALE built bundle whenever source was edited without a rebuild: tests passed against old code, then "mysteriously" changed behavior after an unrelated full build. The generic `"@deepseek-ai/dsh-*"` source wildcard does not help here: its substitutions are tried in order and a group missing from its directory list yields no match, while adding the group to the wildcard did not resolve the specifier in practice (only explicit per-package entries do, matching how `api` and `typert` are mapped).

## Decision

Explicit source mappings in `tsconfig.base.json` for every package of the two fork-added groups, following the `api`/`typert` precedent:

- `@deepseek-ai/dsh-hive` → `packages/hive/dsh-hive/src`
- `@deepseek-ai/dsh-bench` → `packages/hive/dsh-bench/src`
- `@deepseek-ai/dsh-failure-forensics` → `packages/runtime-diagnostics/failure-forensics/src`

Rule going forward: a package whose group is absent from the `"@deepseek-ai/dsh-*"` wildcard MUST get explicit `paths` entries (bare name plus any subpath tests or static gates import) in the same PR that adds the package. The proof obligation is one command: hide the package's `lib/`, run its suite, and it must pass on sources alone.

## Alternatives considered

- Extending the `"@deepseek-ai/dsh-*"` wildcard with the new groups: tried; resolution still fell through to `lib/`, so the data would have documented coverage the tooling does not deliver.
- Making vitest prefer `src/index.ts` via a custom resolver/alias layer: rejected — it forks the repo's single resolution facade and diverges static gates from test runtime.

## Consequences

Tests and static gates for these packages now always execute sources, so a stale `lib/` can no longer mask or fake behavior; `lib/` remains relevant only to Loader/runtime consumers that deliberately consume built artifacts. The next package added under any uncovered group can re-trip this trap — the explicit-entry rule above is the guard until a generator owns the mapping.
