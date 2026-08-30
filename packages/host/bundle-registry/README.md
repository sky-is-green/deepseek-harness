---
description: "Host bundle registry read face: profile manifests + bundle closure"
kind: "package-reference"
---

# `@deepseek-ai/dsh-host-bundle-registry`

## Summary

Host bundle registry read face — profile manifests + bundle closure.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Usage

```ts
import { listProfiles, readProfileManifest, getBundleClosure } from '@deepseek-ai/dsh-host-bundle-registry'

listProfiles('apps/cli/config')
readProfileManifest('apps/cli/config/agent-presets/standard')
getBundleClosure('apps/cli/config', ['standard', 'my-preset'])
```

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- Read-only — no write, no validation beyond YAML parse
- Closure is deduped by plugin `id`/`name` string, not deep merge

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
