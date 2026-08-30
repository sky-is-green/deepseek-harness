# Agent Note: S22 Setup wizard + unified health

Status: implemented

## Problem

Users must hand-edit `Mount_AI_Drive.bat`, `.wslconfig`, `docker-compose.yml`, and `modelsDir` to use the large-model tier. No single card shows `Windows Vulkan` vs `Linux ROCm/VHDX/docker` health.

## Decision

* **`packages/client/ui-setup-wizard`** (`@deepseek-ai/dsh-client-ui-setup-wizard`):
  * `wizard.ts`: `EngineKind`, `WizardState`, `DEFAULT_STATE`, `validateEngine`, `buildHealthSnapshot`, `isSetupComplete`, `describeDriveFailure` — pure.
  * `src/client/index.ts`: registers `settings` section `setup` (`order: 5`) via `locale` and `settings` from `ctx`; pure helpers tested directly.
  * `clientBundle` preset, invariant companion, `vitest` 4 green.
* Hotspot wiring deferred to separate commits per Rule 3: `cordis.patch.yml` registers `ui-setup-wizard`, `tsconfig.client.json` adds reference, `pnpm-lock.yaml` regen.

## Alternatives considered

* Separate pages for drive/engine — rejected: one card is one click.

## Consequences

* `S22` unblocks `X25` dual-host test when `X23` lands.
* `260` invariants conform, `tsc -b` 0, `oxlint` 0.
