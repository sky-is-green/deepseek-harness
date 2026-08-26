# @deepseek-ai/dsh-models-local

English | [中文](README.zh.md)

The local llama.cpp provider for `ctx.models`: the catalog is one directory of `.gguf` weights read through the GGUF header reader, `hardware()` serves a once-cached probe from `dsh-hardware-probe`, load/unload drive a spawned `llama-server` through `ctx.subprocess` with bounded `/health` polling and free-port allocation, and downloads stream through `dsh-model-downloads` into the weights directory with Range resume and sha256 integrity verification.

## Contract

- **Load grammar is the seam's**, enforced by the `dsh-models` invariant companion when mounted: `unloaded → loading → loaded → unloading → unloaded`, `failed` recoverable by retry.
- **One spawn per load**: argv is `[serverBinary, ...extraArgs, -m <path>, --port <free>, -c <context>]`; ports probe upward from `basePort`; a second concurrent load refuses loud instead of evicting.
- **Health budget**: `/health` polls every `healthPollMs` until `loadTimeoutMs`, then the process tree is terminated and state commits `failed` with the reason; an aborted signal walks `unloading → unloaded` semantics via the abort path and rejects with `aborted`.
- **Downloads land in `modelsDir`** under the source file's basename: staged through a `.part` sibling with Range resume, verified against the hub's advertised sha256 when served, renamed into place only after verification passes. A destination that already exists refuses before any handle exists; completion rescans the catalog and emits `models/catalog-updated` before the job settles `completed`. Cancellation keeps the partial `.part` for the next attempt.
- **Catalog scan fails loud** on a corrupt `.gguf` — silent holes are how "why can't I load my model" bugs start. Remove the bad file or fix it.
- Disposal cancels all running downloads and awaits their settlement after best-effort unloading everything; wedged children die with the subprocess service's own teardown escalation.

## Model Experience

### Local hosting surface

#### What the model sees

Nothing directly: requests reach spawned servers through `ctx.llm` adapter routes pointed at the served port (`api: openai-completions`, per the local-generation-route decision), and those adapters own everything model-visible.

#### Token effect

No direct effect; context-length sizing flows into the spawned server flag only.

#### KV Cache effect

None at this layer; each loaded server owns its KV cache and dies with its process on unload.

## Known Limitations and Deferred Work

- **Single hub endpoint, no auth** — downloads address one `hubBaseUrl` (default huggingface.co) anonymously; mirrors and credential-gated repositories need an auth seam no consumer exercises yet.
- **Single-file downloads** — split GGUF shard sets (`-00001-of-00003.gguf`) download as unrelated catalog entries; shard concatenation is not implemented.
- **Single-model concurrency** — one spawned server at a time; multi-model residency waits on idle eviction policy (E4 follow-up) rather than hiding eviction behind silent unloads.
