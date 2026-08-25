# @deepseek-ai/dsh-hardware-probe

English | [中文](README.zh.md)

Host compute detection backing `ctx.models` fit estimates: NVIDIA GPUs over `nvidia-smi` (backend `cuda`, VRAM in bytes), Apple silicon as one unified-memory Metal device, Vulkan adapters over `vulkaninfo --summary`, and a CPU entry when nothing else answers. Every detection seam is injected, so tests run offline and embedders can substitute their own host facts.

## Contract

- **Skip-on-failure detection.** A missing or failing detector (`nvidia-smi`, `vulkaninfo`) contributes nothing; it never fails the probe. Absence of detection information is normal — drivers, SDK tools, and platforms vary.
- **Total RAM always reports** (`os.totalmem()` in the default environment); fit estimators can always size against it.
- **CPU-only hosts still get an entry**: when no discrete device is detected, one `cpu` device carries the CPU model name when the host exposes one.
- **Apple silicon reports unified memory as device memory**, so Metal memory figures equal total RAM by design.
- **vulkaninfo entries carry no memory figure** — vulkaninfo does not report VRAM; NVIDIA entries do.
- Commands run bounded (5s timeout each) with the subprocess seam's scrubbed parent environment; this library cannot route through `ctx.subprocess`, so it imports the shared scrub directly.

## Model Experience

### Detection surface

#### What the model sees

Nothing: the probe informs fit estimates and UI cards through callers; it contributes no prompt content and registers no tools.

#### Token effect

No direct effect; sizing decisions remain with consumers.

#### KV Cache effect

None; the probe owns no request state.

## Known Limitations and Deferred Work

- **No AMD/Intel discrete VRAM reading** — Windows WMI caps adapter memory below 4 GB and ROCm exposes no stable CLI; Vulkan adapters therefore report without VRAM until a reliable source exists.
- **No result caching yet** — every call re-runs detectors; the future local provider is expected to cache once per process (`ModelsRuntime.hardware` documents results as process-static).
