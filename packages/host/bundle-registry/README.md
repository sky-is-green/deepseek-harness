# `@deepseek-ai/dsh-host-bundle-registry`

Host bundle registry read face — profile manifests + bundle closure.

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
