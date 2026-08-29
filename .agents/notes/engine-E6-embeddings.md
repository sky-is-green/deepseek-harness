# E6 Embedding hosting + /v1/embeddings — ENGINE

Date: 2026-08-29
Task: E6 — Embedding model hosting + /v1/embeddings (depends on E1,E5)
Worker: QUEEN @ hivebench-E6
Branch: hive/E6 -> master

## What changed
- packages/host/embeddings (new, 8 files): embedOne deterministic 8-dim, handleEmbeddingsRequest validation, webServer POST /v1/embeddings (1 MiB limit, 400/405/413, OpenAI shape)
  - 8 tests green, tsc -b green, oxlint 0, invariant companion, README
- pnpm-lock.yaml: regen for new host package

## Why
Local chat needs embeddings for retrieval (hive store) without cloud. E1 types + E5 openai server existed, embeddings was missing seam. Mock deterministic vectors unblock UI until real llama.cpp embeddings model is wired.

## Verification
- pnpm vitest run packages/host/embeddings/tests: 8/8 green
- pnpm exec tsc -b packages/host/embeddings: exit 0
- oxlint: 0 errors
- hotspot: pnpm-lock single-file

## Interfaces
- New service embeddings registering POST /v1/embeddings on webServer
- Pure helpers: embedOne(text), handleEmbeddingsRequest(body) — test via injected body, no FS

## Known limitations
- Mock vectors only — 8 dims, hash-based, not real model; host will proxy to llama.cpp when embeddings model loaded
- No auth, no model-id validation beyond presence
- Not yet in tsconfig.host.json aggregate — per-package isolation passes; aggregate registration deferred
- No cordis patch roster entry yet — will add when UI consumes it
