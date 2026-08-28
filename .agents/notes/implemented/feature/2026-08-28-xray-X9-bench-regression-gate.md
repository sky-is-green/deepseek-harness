# X9 Bench Regression Gate — PES vs Committed Baseline

## Summary

`X9` is the headless CI gate over the `dsh-bench` protocol runner (`X8`): a PES regression exits nonzero vs the committed `baseline.json`. The existing `/bench` command still launches `POST /v1/protocol/run` and summarizes `GET /v1/report/<run>`; the gate is a pure comparison layered on top for CI batch checks.

## Contracts

- `packages/hive/dsh-bench/src/gate.ts:1` — `evaluateGate(report, baseline, threshold)` / `exitCodeFor(decision)` / `pesOf(report)`. Threshold 0 = any drop fails; missing `post_run_pes.pes` skips the gate (not a regression).
- `packages/hive/dsh-bench/baseline.json:1` — `{pes: 73.1}` stub (from `tests/dsh-bench.spec.ts` report fixture; replace when live P1–P11 PES is established).
- `scripts/check-pes-baseline.mjs:1` — `node scripts/check-pes-baseline.mjs --report <report.json> [--baseline packages/hive/dsh-bench/baseline.json] [--threshold 0]` — reads JSON, calls `evaluateGate`, prints headline, exits `1` on regression else `0`.

## Interfaces changed

- `packages/hive/dsh-bench/src/index.ts:42` — re-exports `PesBaseline`, `GateDecision`, `evaluateGate`, `exitCodeFor`, `pesOf` from `./gate`.
- `packages/hive/dsh-bench/README.md:47` / `README.zh.md:47` — Regression gate section + baseline note.

## Verification

- `packages/hive/dsh-bench/tests/bench-gate.spec.ts:1` — 9 tests: extract PES, pass at/above baseline, fail on any drop (threshold 0), threshold tolerance (0.5), boundary at exactly threshold, skip on missing PES, exit codes. Together with `dsh-bench.spec.ts` (8 tests) total 17 green in worktree.
- Manual: `echo '{"post_run_pes":{"pes":72}}' | node scripts/check-pes-baseline.mjs` → `REGRESSION` exit 1; `74` → `ok` exit 0; missing PES → `gate skipped` exit 0.
- Per-package `tsc -b` / `oxlint` / `pnpm run build` expected green; repo-wide `typecheck` includes gate types.

## Deferred

- Live baseline PES (current stub is protocol fixture). Wire CI `bench:gate` job after `/bench live` when sidecar is up.
- Optional `/bench` flag to fail the command itself on regression (today the gate is the external script / library, not a slash-command switch).
