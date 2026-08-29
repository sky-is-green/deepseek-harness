# X13 Memory browser — XRAY

Date: 2026-08-29
Task: X13 — Memory browser endpoints: inspect, pin, delete, edit retained entries
Worker: QUEEN @ hivebench-X13
Branch: hive/X13 -> master

## What changed
- packages/host/memory-browser (new, 8 files): MemoryStore + webServer routes /v1/memory/* (inspect, pin, delete, edit) + Cordis service
  - MemoryStore: inspect, pin, delete, edit, list (in-memory, sorted)
  - Routes: GET /v1/memory/inspect?id=, POST /v1/memory/pin {id,pinned}, DELETE /v1/memory/delete?id=, PATCH /v1/memory/edit {id,content}
  - 5 tests green, tsc -b green, oxlint 0, invariant companion, README
- pnpm-lock.yaml: regen for new host package

## Why
X7's persistent store + comb ingestion existed python-side but had no TS host read face for UI. Memory browser (studio) needs to inspect/pin/delete/edit retained entries — this provides the host endpoints.

## Verification
- pnpm vitest run packages/host/memory-browser/tests: 5/5 green
- pnpm exec tsc -b packages/host/memory-browser: exit 0
- oxlint: 0 errors
- hotspot: pnpm-lock single-file

## Interfaces
- New service memoryBrowser with 4 routes on webServer
- Pure MemoryStore for tests and host logic

## Known limitations
- In-memory only — no persistence beyond process; X7's durable store will be wired when available
- No auth, no pagination
