# X11 Sidecar Lifecycle + Frozen-Binary Bootstrap

## Summary

`X11` owns the Hive sidecar (`harness` FastAPI) lifecycle so users never run `pip`. Host `SidecarLifecycle` over `ctx.subprocess` spawns and probes `GET /openapi.json`, prefers a frozen PyInstaller binary (`native/sidecar` or `$SIDECAR_BINARY`) via `resolveSidecarArgv` and `scripts/bootstrap-sidecar.mjs` (reports `frozen`/`module`/`missing`), emits `sidecar/status`, and guarantees teardown. Client `ui-sidecar-panel` renders the status as a `settings` section (`order: 40`).

## Contracts

- `packages/sidecar/sidecar-lifecycle/src/index.ts:1` — `SidecarLifecycle extends Service` at `ctx.sidecarLifecycle` (`status()`/`bootstrapReady()`/`start(signal?)`/`stop()`/`probeHealth()`), `Config` (`port`, `binaryPath?`, `pythonBin`, `cwd?`, `startupTimeoutMs`, `healthPollMs`, `extraArgs`), `resolveSidecarArgv(config)`, `sidecar/status` event. Lifecycle is one-process, concurrent `start` refuses loud, `stop` idempotent, health polls `openapi.json` with deadline.
- `scripts/bootstrap-sidecar.mjs:1` — `node scripts/bootstrap-sidecar.mjs [--check] [--json]` probes `native/sidecar` and sibling `hive-memory/harness` candidates, prints `frozen` vs `module` vs `missing` and appropriate `argv`, exits 1 on `--check` when `missing`.
- `packages/client/ui-sidecar-panel/src/index.ts:1` — `ui-sidecar-panel` registers `settings` section `sidecar` (`title: Sidecar`, `order: 40`) reflecting `ctx.sidecarLifecycle.status()` when present.
- Aggregates: `tsconfig.host.json:315` ref `packages/sidecar/sidecar-lifecycle`, `tsconfig.client.json:101` ref `packages/client/ui-sidecar-panel`, `tsconfig.base.json:110` explicit path for `dsh-sidecar-lifecycle` (group `sidecar` not in wildcard per `xray-2026-08-25-base-paths-source-mapping`).

## Interfaces changed

- New host service `@deepseek-ai/dsh-sidecar-lifecycle` and client `@deepseek-ai/dsh-ui-sidecar-panel`.
- New `sidecar/status` event.

## Verification

- `packages/sidecar/sidecar-lifecycle/tests/sidecar-lifecycle.spec.ts:1` — 5 tests: `resolveSidecarArgv` fallback/extraArgs, `start`→`running`→`stop` via mocked `subprocess` + stubbed `fetch` health, concurrent start refuses, health never → `failed`. `packages/client/ui-sidecar-panel/tests/sidecar-panel.spec.ts:1` — 2 tests (register smoke, disposal). Total 7 green.
- `pnpm exec tsc -b packages/sidecar/sidecar-lifecycle/tsconfig.json` / `packages/client/ui-sidecar-panel/tsconfig.json` — 0.
- `pnpm exec oxlint` — 0 after `oxlint --fix` (arrow-parens, unnecessary assertions).
- Manual: `node scripts/bootstrap-sidecar.mjs --json` → `mode: module` with `C:/.../hive-memory/harness`; `--check` exit 0; `missing` path exits 1.

## Deferred

- Frozen PyInstaller binary artifact (`native/sidecar`) not shipped yet; `bootstrap-sidecar` remains the `module` fallback (like `models-local` `serverBinary` stub). Publish pipeline to build `native/sidecar` per OS.
- No orphan adoption across host restarts; no log tail or Start/Stop button in panel (read-only status today).
