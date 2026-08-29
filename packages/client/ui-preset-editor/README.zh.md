# `@deepseek-ai/dsh-client-ui-preset-editor`

English | [中文](README.zh.md)

Preset/persona editor UI over the presets seam — pure helpers for persona text + prompt sections.

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
