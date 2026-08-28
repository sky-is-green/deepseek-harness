# Agent Note: U4 CI verification — catalogs, JSDoc, READMEs, and pairing

Status: implemented

English | [中文](2026-08-28-U4-ci-verification.zh.md)

## Problem

Round 3 (E3 `dsh-model-downloads` + E4 `models-local` + E5 `openai-endpoint`) landed on `hive-studio@28a69fa192` but left `doc-sync` red: `gen-config-catalog` rejected `host/openai-endpoint`'s `inject as const`, `gen-doc-graphs`/`gen-module-graph` were stale for the new packages, `verify-export-jsdoc` flagged two undocumented exports, `verify-package-readme-model-experience` flagged the two new packages as unstructured, and `verify-translation-pairing` was stale for 12 pairs (new E3 note missing, docs and READMEs out of sync). The `pnpm-lock.yaml` also needed a hotspot single-commit after the provider merges.

## Decision

- **Hotspot lockfile** `67da63c822` alone per Rule 3.
- **Generated catalogs** `b81acca998`/`b306103f42`/`4fbae7b13a` — `pnpm run gen-config-catalog` + `gen-doc-graphs` (8 docs) + `gen-module-graph` each committed alone for their hotspot en file; zh counterparts (`config-catalog.zh.md`, `module-graph.zh.md`) were rebuilt from en with locale-aware link fixing and re-recorded via `verify-translation-pairing --write`.
- **JSDoc** `89f1ea4b29` — `model-downloads/src/fetch-file.ts:18` `partPathFor` now documents `@param destinationPath`/`@returns`, `FetchToFileOptions` has interface JSDoc, `models-local/src/index.ts:198` `serveEndpoint` documents `@param modelId`/`@returns`.
- **READMEs** — `host/openai-endpoint` now carries a structured `### OpenAI serving surface` entry with `What the model sees`/`Token effect`/`KV Cache effect` (grounded with `` `POST /v1/chat/completions` `` and `` `pipeline()` ``); `model-downloads` `### Download surface` now uses `No direct effect;` phrasing and inline `` `fetchToFile` `` to satisfy the structured-entry literal rule. Both zh mirrors updated.
- **Translation pairing** — created `.agents/notes/implemented/feature/2026-08-26-engine-E3-download-manager.i18n.yaml` and re-recorded 11 pairs via `--write --all` (docs and READMEs).

## Consequences

`verify-config-catalog`, `verify-doc-graphs`, `verify-module-graph`, `verify-export-jsdoc`, `verify-package-readme-model-experience`, `verify-translation-pairing` all pass (`1045 pairs consistent`). No new runtime behavior; the change is gate hygiene for Round 4. The `examples/acp-demo`/`jsonrpc-demo` `ENOENT` bin warning remains — it disappears after `pnpm run build` materializes `lib/bin.js` and is not a U4 gate.

## Verification

- `pnpm vitest run packages/models/model-downloads packages/models/models-local packages/host/openai-endpoint` — 36 passed.
- `pnpm exec tsc -b packages/host/openai-endpoint packages/models/model-downloads packages/models/models-local` — clean.
- `pnpm exec oxlint` — 0 errors on touched files.
