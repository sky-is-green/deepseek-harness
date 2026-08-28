# @deepseek-ai/dsh-model-profiles

English | [中文](README.zh.md)

Saved per-model serving profiles for the model hosting seam: sampling params, a default system prompt, and a default serve-time context length, keyed by catalog model id. One settings namespace (`model-profiles`) is the storage of record, so profiles survive restarts through whichever settings provider is mounted.

## Contract

- **Reads degrade to empty without a settings provider; writes fail loud.** A save attempted with no mounted provider throws instead of reporting success while dropping the data.
- **Explicit over implicit at the boundary.** `applyToLoadRequest` never overrides a request-supplied context length; the profile fills only what the request left unset.
- **Writes validate before persisting.** Field ranges refuse the write with the offending field named: `temperature` `[0, 2]`, `topP` `(0, 1]`, integer `topK >= 0` (0 disables), `minP` `[0, 1]`, `repeatPenalty` `[0, 4]`, presence/frequency penalties `[-2, 2]`, integer `maxTokens >= 1`, integer `contextLength >= 256`.
- **Saves deep-merge.** A sampling patch keeps sibling fields the caller did not send; `remove` forgets the whole profile.
- Profiles are keyed by the string form of the branded catalog `LocalModelId`; an unknown id reads as "no profile".

## Model Experience

### What the model sees

Nothing directly. Consumers resolve profiles into requests they already send: a saved `systemPrompt` reaches the model only when the consuming entry point applies it, and saved sampling params ride the request the same way.

### Token effect

None on its own. A saved `systemPrompt` adds its tokens to prompts at apply time, under the consumer's existing budget accounting.

### KV Cache effect

A profile's `contextLength`, when applied at load, sizes the serve-time context window and therefore the per-loaded-model KV reservation; larger values raise VRAM use.

## Known Limitations and Deferred Work

- **No per-field clearing yet.** `save` merges and `remove` forgets whole profiles; clearing one saved field requires the settings `mutate` path API until a consumer needs it surfaced here.
- **Sampling params are resolved, not auto-sent.** Wiring resolved sampling values into generation requests belongs to the local generation route, not this seam.
