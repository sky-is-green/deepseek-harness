# E4 handoff — for whoever picks up after the drone reset

State: implementation COMPLETE on this branch (`hive/E4`, tip = commit after the three below), gates green at land time (8/8 tests, tsc, oxlint, constraints, invariants).

## What remains

1. Integrate: merge `hive/E4` into `hive-studio` during Round 3 (was blocked only by foreign staged `command-kill/*` files in the primary checkout — not by anything in this branch).
2. Run the integration matrix there: `pnpm install && pnpm run build && pnpm run test && pnpm run typecheck && pnpm run lint`.
3. Flip board row E4 to `[Completed in Round N]`.

## Gotchas

- `packages/models/model-profiles` reference must NOT be added to `tsconfig.host.json` until E9 lands (its package is absent here).
- Known gate bugs (filed): `check-claims.mjs` globToRegExp breaks `**` patterns — use exact paths in claims; hotspot-alone check self-rejects `/tsconfig.host.json`. Documented bypass: `CLAIMS_GATE=skip` (used for the two mechanical hotspot commits).
- Downloads intentionally refuse loud pointing at E3 (still open, claimable).
- Salvage copy of identical sources also at `%TEMP%\opencode\E4-handoff\` (may be wiped by reset; the branch is authoritative).
