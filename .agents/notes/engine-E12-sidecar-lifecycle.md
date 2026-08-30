# Agent Note: E12 Linux ROCm Docker + VHDX bare mount

Status: implemented

## Problem

Large-model tier needs Linux ROCm Docker with a dedicated NVMe `.vhdx` bare-mounted to `/mnt/dsh_storage`. Windows Vulkan path is quick but cannot hold `104GB` shards. No lifecycle helper existed for bare mount or Docker health.

## Decision

* **`packages/sidecar/sidecar-lifecycle`** (`@deepseek-ai/dsh-sidecar-lifecycle`):
  * `vhdx.ts`: `buildVhdxBareCommand`, `buildWslMountCommand`, `describeVhdxFailure` — pure, fail-loud.
  * `docker.ts`: `buildRocmService`, `healthUrl`, `describeDockerFailure` — pure compose fragment.
  * `lifecycle.ts`: `failedStatus`, `portForEngine` — maps engine to `sidecar/status: failed` with actionable fix.
  * `index.ts`: Cordis service `sidecarLifecycle` exposing `status()` reading `engine-selector` Config; invalid config fails loud via `resolveEngine`.
* **`scripts/bootstrap-sidecar.mjs`**: Node script mounting VHDX (`wsl --mount --vhd --bare` + `mount /dev/sdX1 /mnt/dsh_storage`) and `docker compose up dsh-compute-backend` with loud exit.
* **`docker-compose.yml`**: adds `dsh-compute-backend` (`custom-dsh-rocm-backend:latest`, `/dev/kfd`, `/dev/dri`, `HSA_OVERRIDE_GFX_VERSION=11.0.0`, `FLASH_ATTENTION_MODE=3`, `CACHE_PRECISION_TYPE=fp8`, `/mnt/dsh_storage/models:/workspace/models:ro`) alongside `llama-server` quick path. `open-webui` now sees both `host.docker.internal:8765` and `dsh-compute-backend:8000`.

## Alternatives considered

* Silent fallback to Windows — rejected per E11.
* Keeping VHDX as NTFS `E:\models` — rejected: 9P tax for 100GB shards.

## Consequences

* `E12` unblocks `S22` wizard and `X25` dual-host test.
* `tsc -b` sidecar-lifecycle 0, `vitest` 8 green, `259` invariants conform.
