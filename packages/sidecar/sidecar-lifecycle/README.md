# `@deepseek-ai/dsh-sidecar-lifecycle`

English | [中文](README.zh.md)

Host sidecar lifecycle for the Hive sidecar (`harness` FastAPI app). Ensures a frozen binary is preferred so users never run `pip`, then spawns and health-checks the sidecar via `ctx.subprocess` (`GET /openapi.json`) and emits `sidecar/status`.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `port` | `8765` | Sidecar listen port |
| `binaryPath` | — | Absolute path to frozen PyInstaller binary; when absent/missing falls back to `python -m harness` |
| `pythonBin` | `python` | Python executable for module fallback |
| `cwd` | — | Working dir where `harness/` is resolvable |
| `startupTimeoutMs` | `15000` | Health deadline |
| `healthPollMs` | `250` | Poll interval |
| `extraArgs` | `[]` | Extra spawn args |

```yaml
- id: sidecar-lifecycle
  name: '@deepseek-ai/dsh-sidecar-lifecycle'
  config:
    port: 8765
    binaryPath: native/sidecar
```

## Service

`SidecarLifecycle extends Service` at `ctx.sidecarLifecycle`:

- `status(): SidecarStatus` — `{state: 'stopped'|'starting'|'running'|'failed', port, pid, error}`
- `bootstrapReady(): boolean` — frozen binary or module fallback resolvable
- `start(signal?): Promise<SidecarStatus>` — resolves argv via `resolveSidecarArgv`, spawns via `ctx.subprocess`, polls `/openapi.json`, emits `sidecar/status`
- `stop(): Promise<SidecarStatus>` — idempotent
- `probeHealth(signal?): Promise<boolean>` — `GET /openapi.json`

Bootstrap helper `resolveSidecarArgv(config)` prefers `config.binaryPath` when `existsSync`; `scripts/bootstrap-sidecar.mjs` reports `frozen` vs `module` vs `missing`.

## Model Experience

- **Token cost:** none. Sidecar lifecycle never reaches the model.
- **KV-cache effect:** none.

## Known Limitations and Deferred Work

- Frozen binary not shipped yet; `scripts/bootstrap-sidecar.mjs --check` reports the `missing` vs `frozen` vs `module` mode and the module fallback remains the dev path.
- No orphan adoption across restarts (lifecycle owns one process per host session).
- Health probes `openapi.json`; `harness` readiness does not gate `curate` circuit breaker (that remains `dsh-hive` soft fallback).
