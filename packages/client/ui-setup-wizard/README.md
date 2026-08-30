# `@deepseek-ai/dsh-client-ui-setup-wizard`

One-click setup wizard for dual-host. Exposes `drive` + `engine` + `modelsDir` picker and unified health (`Windows Vulkan` + `Linux ROCm/VHDX/docker`).

## Configuration

None. Wizard reads `sidecarLifecycle.status()` and `engine-selector` Config.

## Extension points

* `settings` section `setup` (`order: 5`, title `Setup`) — wizard card.

## Model Experience

* Token cost: none.
* KV effect: none.

## Known Limitations

* VHDX `mkfs` only if no filesystem; health poll is `GET /health`.
