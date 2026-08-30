# Agent Note: UI Link — wizard ties engine/tier/health

Status: implemented

## Problem

Wizard, sidecar panel, and bench estimator were separate. User needs one card linking `engine` + `VHDX/drive` + `health` + `tier` + `leak` for launch.

## Decision

* **`ui-setup-wizard/src/client/wizard.ts`**: added `TierMetrics`/`TierFlags`, `calculateTier` (mirrors `dsh-bench/estimator` pure), `WizardStatus` and `buildWizardStatus` linking `WizardState` + `HealthSnapshot` + `tier` + `complete`. No cross-plugin import — pure, client-bundle safe.
* **`ui-setup-wizard/src/client/index.ts`**: settings `setup` now renders `buildWizardStatus(DEFAULT_STATE, buildHealthSnapshot(...), 32768, false)` — wizard shows `engine` + `VHDX` + `mount` + `modelsDir` + `health` (`windows 8765` + `linux 8000 vhdxMounted/dockerRunning`) + `tier` (`total 106GB`, `recommendCap`) in one render.
* Tests: `wizard.client.spec.ts` 6/6 — `validateEngine`, `health`, `isSetupComplete`, `driveFailure`, `calculateTier` dual `40 vs 20`, `buildWizardStatus` links all.

## Consequences

* `S22` wizard is now the single launch card; `ui-sidecar-panel` sparkline cap `30` keeps history bounded.
* `tsc -b` wizard/panel 0, `vitest` 10/10, `49` client packages, `261` invariants.
