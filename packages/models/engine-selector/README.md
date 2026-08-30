# `@deepseek-ai/dsh-models-engine-selector`

Engine selector seam for local model hosting. `Config.engine` chooses `windows-vulkan` (quick, `E:\models` NTFS) or `linux-rocm-docker` (large, `/mnt/dsh_storage` ext4 bare VHDX + ROCm Docker). Invalid or unavailable backends fail loud with an actionable fix, never silently fallback.

## Configuration

```yaml
# cordis.yml
engine-selector:
  config:
    engine: windows-vulkan # or linux-rocm-docker
```

Default is `windows-vulkan`.

## Failure handling

`describeEngineFailure(kind, reason, detail)` returns a human copy for `sidecar/status: failed`:

* `vhdx-not-mounted` — run `Mount_AI_Drive.bat`
* `docker-not-running` — start Docker Desktop/WSL
* `rocm-not-available` — check `/dev/kfd`, `/dev/dri`, `video`/`render` groups
* `model-not-found` — fix `modelsDir` or `/workspace/models`
* `port-in-use` — free `8000`

## Model Experience

* **Token cost:** none.
* **KV-cache effect:** none — selector is pure.

## Known Limitations and Deferred Work

* No auto fallback; E11 intentionally fails loud per plan.
* VHDX mount still manual via batch; S22 wizard will automate.
