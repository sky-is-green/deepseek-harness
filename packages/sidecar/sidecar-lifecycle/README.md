# `@deepseek-ai/dsh-sidecar-lifecycle`

Sidecar lifecycle for dual-host: `windows-vulkan` (quick, `E:\models`) vs `linux-rocm-docker` (large, `E:\dsh_storage.vhdx` bare + `/mnt/dsh_storage` ext4 + ROCm Docker). Every misconfiguration fails loud with an actionable fix.

## Configuration

```yaml
sidecarLifecycle:
  config:
    engine: windows-vulkan # or linux-rocm-docker
```

Default `windows-vulkan`.

## VHDX bare mount

`vhdx.ts` builds `wsl --mount --vhd E:\dsh_storage.vhdx --bare` + `mount /dev/sdX1 /mnt/dsh_storage`. `scripts/bootstrap-sidecar.mjs` executes it. `describeVhdxFailure` maps to `sidecar/status: failed` detail.

## Docker ROCm

`docker.ts` builds `custom-dsh-rocm-backend:latest` service with `/dev/kfd`, `/dev/dri`, `HSA_OVERRIDE_GFX_VERSION=11.0.0`, `FLASH_ATTENTION_MODE=3`. `docker-compose.yml` adds `dsh-compute-backend` alongside existing `llama-server`.

## Model Experience

* Token cost: none.
* KV effect: none — lifecycle only.

## Known Limitations

* VHDX `mkfs.ext4` runs only if device has no filesystem; reuses existing.
* Health check is `GET /health` poll; streaming not probed.
