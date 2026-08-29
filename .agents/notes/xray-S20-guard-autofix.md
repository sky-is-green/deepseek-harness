# S20 Guard auto-fix GREEN — XRAY

Date: 2026-08-29
Task: S20 — Guard auto-fix GREEN: auto-regen docs catalogs + pnpm-lock hotspot via CLAIMS_GATE=skip
Worker: QUEEN @ hivebench-S20
Branch: hive/S20 -> master

## What changed
- scripts/check-claims.mjs (new, 238 lines): claims gate with session-proof UTF-16LE decode, seat-latch (duplicate Task_ID guard), hotspot single-commit, vendor block, CLAIMS_GATE=skip bypass. Selftest: node scripts/check-claims.mjs --selftest.
- packages/hive/dsh-bench/src/index.ts: merge S18 history surface with correct schemastery z Config (per-field JSDoc) — fixes verify-config-catalog (4 violations).
- packages/hive/dsh-bench/src/gate.ts: restore PesBaseline/GateDecision surface (lost in S18 merge) — fixes tsc -b.
- docs/config-catalog.md: regen via pnpm run gen-config-catalog.

## Why
Guard must fix GREEN trivia itself. Gate was session-brittle (UTF-16) and allowed duplicate claims to interleave designs. dsh-bench Config broken since S18 HEAD, blocking doc-sync.

## Verification
- node scripts/check-claims.mjs --selftest: OK
- pnpm run verify-config-catalog: up to date
- pnpm exec tsc -b packages/hive/dsh-bench: exit 0
- lint staged: 0 errors
- hotspot: docs/config-catalog.md committed alone per Rule 3

## Interfaces
No new service/Consumer; gate is pre-commit hook, Config schema now walkable.

## Known limitations
- pnpm-lock hotspot not exercised (no deps changed)
- Other doc-sync gates still red — out of scope

## Guard wake protocol
BEE-GUARD.md:76 updated to Wake protocol (shared with QUEEN).
