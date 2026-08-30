---
description: "Client sidecar lifecycle panel (X11 companion to `dsh-sidecar-lifecycle`). Renders `sidecarLifecycle` status as a `settings` section and surfaces bootstrap hints when the host service is absent."
kind: "package-reference"
---

# `@deepseek-ai/dsh-ui-sidecar-panel`

[English](README.md) | 中文


## 概述

Client sidecar lifecycle panel (X11 companion to `dsh-sidecar-lifecycle`). Renders `sidecarLifecycle` status as a `settings` section and surfaces bootstrap hints when the host service is absent.

Client sidecar lifecycle panel (X11 companion to `dsh-sidecar-lifecycle`). Renders `sidecarLifecycle` status as a `settings` section and surfaces bootstrap hints when the host service is absent.


## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Configuration

None. Installed as a client plugin; reads `ctx.sidecarLifecycle.status()` when available.

## Extension points

- `settings` section `sidecar` (`order: 40`, title `Sidecar`) — shows `{state, port}` and unavailable hint.

## Model Experience

- **Token cost:** none.
- **KV-cache effect:** none.

## Known Limitations and Deferred Work

- Pure settings rendering; Start/Stop buttons are deferred to a host `webserver` action (panel today is read-only).
- No log tail yet.

<a id="dev-note"></a>
### 开发备注

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
