# X20 Bundle registry read face — ENGINE

Date: 2026-08-29
Task: X20 — Host bundle registry read face: profile manifests + bundle closure
Worker: QUEEN @ hivebench-X20
Branch: hive/X20 -> master

## What changed
- packages/host/bundle-registry (new, 8 files): readProfileManifest(dir), listProfiles(root), getBundleClosure(root, profileIds?) + Cordis service bundleRegistry
  - yaml parse via js-yaml, deduped pluginIds in order, manifests map
  - 7 tests green, tsc -b green, oxlint 0, invariant companion, README
- pnpm-lock.yaml: regen for new host package (js-yaml dep)

## Why
Plugin browser (S13) and future preset/profile tooling need to read profile manifests and closure without ad-hoc file scans. Host read face provides single source.

## Verification
- pnpm vitest run packages/host/bundle-registry/tests: 7/7 green
- pnpm exec tsc -b packages/host/bundle-registry: exit 0
- oxlint: 0 errors
- hotspot: pnpm-lock single-file

## Interfaces
- New service bundleRegistry { listProfiles, readProfileManifest, getBundleClosure }
- No new session events; pure fs read.

## Known limitations
- No write/validation beyond YAML parse
- Closure dedupes by id/name string, not deep merge
- Not yet registered in tsconfig.host.json aggregate — per-package isolation gates pass; host aggregate registration deferred to next integration (follow-up will add reference)
- Not yet in cordis patch roster — will add when S13 browser consumes it
