# S19 Model manager v2 — STUDIO

Date: 2026-08-29
Task: S19 — Model manager v2: one-click fetchToFile resume + modelsDir picker (LM Studio default + models/gguf fallback)
Worker: QUEEN @ hivebench-S19
Branch: hive/S19 -> master

## What changed
- packages/client/ui-models-manager (new, 12 files): client helpers for one-click resume + dir picker
  - models-dir.ts: lmStudioDefaultDir(platform,home), resolveModelsDir(preferred->lmStudio->fallback), pickerHint, FALLBACK_MODELS_DIR= models/gguf
  - fetch-resume.ts: fetchToFileWithResume(url, getExistingSize, writer, fetcher, onProgress) — Range header, .part staging, 416 finalize, 200 restart, per-chunk progress, createMemoryWriter
  - client/index.ts: pure exports + no-op apply (proves disposal)
  - 14 tests green (models-dir 8, fetch-resume 6)
  - tsc -b green, oxlint 0, invariant companion, README with Model Experience
- pnpm-lock.yaml: regen for new package (workspace:*)
- tsconfig.client.json: add ui-models-manager reference (hotspot single-file)
- packages/bundle/web-app/cordis.patch.yml: add ui-models-manager roster entry (hotspot single-file)

## Why
E3 download manager (fetchToFile resume) existed but had no UI. LM Studio default dir (~/.lmstudio/models) + fallback needed picker to avoid hard-coded paths. One-click resume avoids re-downloading large GGUFs.

## Verification
- pnpm vitest run packages/client/ui-models-manager/tests: 14/14 green
- pnpm exec tsc -b packages/client/ui-models-manager: exit 0
- oxlint packages/client/ui-models-manager/src: 0 errors
- hotspot: pnpm-lock, tsconfig.client.json, cordis.patch.yml each committed alone per Rule 3

## Interfaces
- No Host service yet; package is pure client helpers. Future host models service will persist modelsDir via ctx.settings and map writer to real FS.

## Known limitations
- No host FS integration — browser writer is in-memory; host side will use ctx.fs when models service ships
- No settings slot UI yet — picker is pure, will mount once ctx.models provides persistence
- No progress UI — onProgress ready, panel rendering deferred
- cordis roster entry added but package not yet rendered in settings UI

## Guard wake protocol
Unchanged (done in S20).
