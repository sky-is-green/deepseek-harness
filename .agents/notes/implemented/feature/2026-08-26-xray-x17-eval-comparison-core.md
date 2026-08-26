# Agent Note: Score the runs you have, wire the runs you don't — X17 lands its core first

Status: implemented

English | [中文](2026-08-26-xray-x17-eval-comparison-core.zh.md)

## Problem

X17 asks for the preset-trainer eval loop: run candidate vs baseline headless on bench protocol tasks, score PES and pass rate, and emit a comparison report as a `ctx.jobs` job. The scoring verdict is pure data work, but the execution half — spawning headless sessions under two presets and producing scored runs — is real-API territory with no offline oracle. Building both halves in one landing would either ship unexercised lifecycle code or fake coverage.

## Decision

Split the row at its natural seam; this landing ships everything testable offline in `dsh-preset-trainer`:

- **Evaluation vocabulary** (`EvalRun`, `TaskScore`, `EvalThresholds`, `EvalComparison`): a run is one task list executed under one preset label with an optional run-level PES mirroring the sidecar's `post_run_pes.pes` shape.
- **Pure core** (`summarizeEvalRun`, `compareRuns`): pass rates, PES delta, per-task flips, and a verdict under fully explicit thresholds — every baseline task must be executed (a skipped task fails loud), net new failures (regressions minus gains) must fit `allowNewFailures`, PES drop must fit `maxPesDrop`. Extra candidate tasks are reported, never penalized. Duplicate task ids inside a run throw: that is a broken artifact, not comparable data.
- **Bilingual README** for the package (none existed at this base) documenting run shape, verdict rules, and the deferral.

The live executor port and the `ctx.jobs` producer wrapper are deliberately deferred to a keyed-e2e follow-up; the README's Known Limitations names this so no consumer expects `compareRuns` to launch anything.

## Alternatives considered

- **Land executor + jobs wrapper now with mocked runs in tests** — rejected: hand-built job lifecycle around a mock producer proves plumbing, not behavior, and would be the only exercise the code ever gets until someone keys an e2e run; the deferred slice stays honest instead.
- **Reuse `dsh-bench`'s report parsing as the run source** — rejected for now: sidecar reports score sidecar protocol runs, not preset-differentiated task lists; conflating the two would bake a wrong unit into the contract. The `pes?: number` field mirrors their number without importing their shape.
- **Net-failure rule as gross regressions** — rejected: a candidate that fixes t3 and breaks t2 is quality-neutral on balance; thresholds exist to bound damage, not to forbid churn. Gross counts remain visible in the comparison fields.

## Consequences

X9 (bench regression gate) and X18 (promotion flow) can consume `compareRuns` today instead of reinventing verdict logic. The eval-loop follow-up owns exactly two things: an executor port producing `EvalRun`s from headless runs, and a jobs producer wrapping it — the scoring they feed is already frozen and tested.
