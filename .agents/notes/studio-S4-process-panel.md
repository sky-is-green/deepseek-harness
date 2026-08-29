# S4 Process panel — STUDIO

Date: 2026-08-29
Task: S4 — Process manager panel: spawned servers/shells with CPU/RAM and kill buttons
Worker: QUEEN @ hivebench-S4
Branch: hive/S4 -> master

## What changed
- packages/client/ui-process-panel (new, 10 files): formatResources, canKill, killProcess, filterProcesses pure helpers + no-op client apply
  - 5 tests green, tsc -b green, oxlint 0, invariant companion, README
- pnpm-lock.yaml: regen for new client package
- tsconfig.client.json: add ui-process-panel reference (hotspot single-file)
- packages/bundle/web-app/cordis.patch.yml: add ui-process-panel roster entry (hotspot single-file)

## Why
Users need to see spawned llama-servers/shells with CPU/RAM and kill them without shell. Pure helpers unblock panel UI; live host binding deferred to subprocess/webServer wiring.

## Verification
- pnpm vitest run packages/client/ui-process-panel/tests: 5/5 green
- pnpm exec tsc -b packages/client/ui-process-panel: exit 0
- oxlint: 0 errors
- hotspots: pnpm-lock, tsconfig.client.json, cordis.patch.yml each committed alone per Rule 3

## Interfaces
- Pure helpers: formatResources(cpu,memMb), canKill(entry), killProcess(entry, killer), filterProcesses(list, query)
- Client apply is no-op effect (proves disposal); full live binding deferred

## Known limitations
- Mock data — CPU/RAM not yet wired to subprocess/webServer live metrics
- Kill is via injected killer callback, not yet live subprocess kill
- No live polling — filter + kill ready, auto-refresh deferred
