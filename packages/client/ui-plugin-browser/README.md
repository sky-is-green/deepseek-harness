---
description: "Plugin browser — discover/installable view over bundle system"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-plugin-browser`

English | [中文](README.zh.md)


## Summary

Plugin browser — discover/installable view over bundle system

Plugin browser — discover/installable view over the bundle system. Uses host `bundleRegistry` read face (`listProfiles` + `getBundleClosure`) when available; otherwise renders from injected closure.


## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Configuration

None. Pure helpers: `filterPlugins(plugins, filter, onlyInstallable)`, `groupPlugins`, `closureToEntries(closure, installedSet)`.

## Extension points

- Client `apply` is a no-op effect (proves disposal); full `settings` slot wiring deferred until host registry ships.

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- Host integration deferred — browser is pure, no live FS read yet
- No install action — view is discover-only; install will call host bundle writer when it ships
- No cordis `settings.section` registration yet

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
