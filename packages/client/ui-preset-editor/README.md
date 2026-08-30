---
description: "Preset/persona editor UI over presets seam"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-preset-editor`

English | [中文](README.zh.md)


## Summary

Preset/persona editor UI over presets seam

Preset/persona editor UI over the presets seam — pure helpers for persona text + prompt sections.


## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Configuration

None. Pure helpers: `validatePersona`, `validateSections`, `applyPatch`, `draftSummary`.

## Extension points

- Client `apply` is a no-op effect (proves disposal); full `settings` slot wiring deferred until presets seam is stable.

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- Pure helpers only — no host persistence yet (will use `preset` seam when it ships)
- No UI rendering — preview + validation ready, panel deferred

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
