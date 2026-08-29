# S13 Plugin browser — STUDIO

Date: 2026-08-29
Task: S13 — Plugin browser: discover/installable view over bundle system (UI)
Worker: QUEEN @ hivebench-S13
Branch: hive/S13 -> master

## What changed
- packages/client/ui-plugin-browser (new, 10 files): filterPlugins, groupPlugins, closureToEntries pure helpers + no-op client apply
  - 6 tests green, tsc -b green, oxlint 0, invariant companion, README
- pnpm-lock.yaml: regen for new client package (workspace:*)
- tsconfig.client.json: add ui-plugin-browser reference (hotspot single-file)
- packages/bundle/web-app/cordis.patch.yml: add ui-plugin-browser roster entry (hotspot single-file)

## Why
Bundle registry (X20) provides read face for profile manifests + closure. Plugin browser consumes it to show discoverable vs installed plugins — discover/installable view over bundle system. X20 unblocked S13; this closes the read→view loop.

## Verification
- pnpm vitest run packages/client/ui-plugin-browser/tests: 6/6 green
- pnpm exec tsc -b packages/client/ui-plugin-browser: exit 0
- oxlint: 0 errors
- hotspots: pnpm-lock, tsconfig.client.json, cordis.patch.yml each committed alone per Rule 3

## Interfaces
- Pure helpers: closureToEntries(closure, installedSet), filterPlugins, groupPlugins — test via injected closure, no host FS needed yet
- Client apply is no-op effect (proves disposal); full slot wiring deferred until host registry provides live data

## Known limitations
- No host integration — browser is pure, closure is injected, not live from bundleRegistry service
- No install action — view is discover-only; install will call host bundle writer when it ships
- No settings slot UI — will mount as settings section when design settles
