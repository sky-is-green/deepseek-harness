---
description: "Process manager panel - servers/shells with CPU/RAM and kill"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-process-panel`

[English](README.md) | 中文


## 概述

Process manager panel - servers/shells with CPU/RAM and kill

Process manager panel — spawned servers/shells with CPU/RAM and kill buttons.


## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Configuration

None. Pure helpers: `formatResources(cpu, memMb)`, `canKill(entry)`, `killProcess(entry, killer)`, `filterProcesses(list, query)`.

## Extension points

- Client `apply` is a no-op effect (proves disposal); full `webServer`/`subprocess` live binding deferred.

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- Mock data — CPU/RAM from `subprocess`/`webServer` not yet wired; kill is via injected `killer` callback
- No live polling — filter + kill ready, auto-refresh deferred

<a id="dev-note"></a>
### 开发备注

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
