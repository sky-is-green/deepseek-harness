# @deepseek-ai/dsh-settings-transfer

English | [中文](README.zh.md)

Export/import bundle for studio setup moves: the raw user layers of every registered settings namespace (model profiles included) plus locally-authored presets, in one versioned JSON file. The importing host re-validates everything through its own registered owners before persisting.

## Contract

- **Import never invents owners.** A bundle section applies only when its namespace is already registered on this host; anything else is skipped with a reason, because a section with no schema owner cannot be validated.
- **Applied sections pass their owner's schema first.** A value this host's owner rejects refuses the write; nothing partial persists.
- **Preset import stays inside the authoring trust boundary.** Ids must be valid preset directory names, files byte-copy into the user-writable root only, and an existing same-id preset is skipped unless `overwritePresets` is set. System presets are never touched.
- **Exports carry user overrides only.** Composition `base` layers and schema defaults belong to each deployment's own config; exporting them would overwrite another host's composition with this machine's.
- Bundles are format-versioned; `readBundle` refuses versions this build does not understand instead of guessing.

## Model Experience

### What the model sees

Nothing directly. Imported settings reach the model only through the features that read those namespaces (for example per-model profiles applied at load), under their existing validation and budgets.

### Token effect

None on its own. An imported `systemPrompt`-style field affects tokens only when the consuming feature applies it.

### KV Cache effect

An imported profile `contextLength`, when later applied at load, sizes the serve-time window as documented on the profiles seam.

## Known Limitations and Deferred Work

- **Composition-file presets only.** A bundled preset carries its `agent.cordis.yml`; extra sidecar files in a preset directory are not yet captured.
- **No selective import yet.** A bundle applies whole namespaces; field-level picking waits for a consumer that needs it.
