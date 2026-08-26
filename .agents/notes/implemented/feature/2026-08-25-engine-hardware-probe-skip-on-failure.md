# Agent Note: Hardware detection skips what it cannot see instead of failing

Status: implemented

English | [中文](2026-08-25-engine-hardware-probe-skip-on-failure.zh.md)

## Problem

Fit estimates ("needs 6.2 GB, you have 8 GB") and the model manager cards need host compute facts — GPUs, VRAM, total RAM — on machines that range from single-GPU NVIDIA desktops to AMD/Vulkan-only hosts to Apple laptops. Detection tooling varies wildly by platform (`nvidia-smi`, `vulkaninfo`, unified memory), and a missing tool is normal, not an error.

## Decision

`@deepseek-ai/dsh-hardware-probe` is a pure library over an injected `ProbeEnvironment` (platform, arch, RAM, PATH lookup, bounded command runner). Its semantics:

- **Skip-on-failure**: a missing or crashing detector contributes no device; only an aborted signal fails the probe. Absence of information is reported as absence.
- **Total RAM always reports**, so estimators always have their denominator.
- **CPU-only hosts get one `cpu` entry** (with model name when known) rather than an empty list, so UI never renders "no devices".
- **Apple silicon = one Metal device whose memory is total RAM** (unified); **vulkaninfo entries carry no VRAM** because vulkaninfo does not report it; **NVIDIA entries carry VRAM** parsed from CSV with quoted-name handling.
- The default command runner uses the subprocess seam's shared parent-environment scrub — this spawner cannot route through `ctx.subprocess` (it is a plain library), so it imports `scrubbedParentEnv` directly per that package's published escape hatch.

The Python reference implementation selects backends by explicit configuration (`backend: vulkan|rocm|cuda|cpu` pointing at pre-staged binaries) and does no probing; this package adds the detection layer the TS side needs for automatic fit estimates.

## Alternatives considered

- **A `ctx.hardware` service** — rejected: the only current consumer is the future local provider's `ModelsRuntime.hardware()` implementation; a public service with one internal caller is exactly the seam smell the package rules name, so the capability ships as a library closure input.
- **Fail loud on broken detectors** — rejected: driver updates or missing SDK tools would break every boot for information the rest of the host still provides; the models seam treats unknown hardware as smaller fit claims, not errors.
- **WMI/registry VRAM probing for AMD/Intel on Windows** — deferred: WMI's `AdapterRAM` caps at 4 GB (wrong for every modern discrete card), so reporting it would be worse than reporting nothing.

## Consequences

E4's provider implements `hardware()` with one cached `probeHardware()` call; S1/S2 render real devices with honest gaps (Vulkan cards show no VRAM until a reliable source exists). New detectors slot into `probe.ts` behind the same skip-on-failure pattern.
