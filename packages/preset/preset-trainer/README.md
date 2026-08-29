# `@deepseek-ai/dsh-preset-trainer`

Preset trainer — promotion flow for candidate presets.

## Usage

```ts
import { promoteCandidate, validatePromotion } from '@deepseek-ai/dsh-preset-trainer'

validatePromotion('cand', 'new-id', ['a', 'cand'])
promoteCandidate('cand', 'new-id', ['a', 'cand']) // {roster: ['a','new-id'], rollbackId: 'cand'}
```

One command promotes a validated candidate to a real preset id (rename + roster order rewrite), with rollback kept as the untouched candidate directory.

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- Pure roster rewrite — FS rename is caller's responsibility; rollback is candidate dir kept untouched
- No validation beyond id format and roster presence
