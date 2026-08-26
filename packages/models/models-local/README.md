# @deepseek-ai/dsh-models-local

English | [中文](README.zh.md)

The local llama.cpp provider for `ctx.models`: the catalog is one directory of `.gguf` weights read through the GGUF header reader, `hardware()` serves a once-cached probe from `dsh-hardware-probe`, and load/unload drive a spawned `llama-server` through `ctx.subprocess` with bounded `/health` polling and free-port allocation. Downloads are task E3's slice and refuse loud here.

## Contract

- **Load grammar is the seam's**, enforced by the `dsh-models` invariant companion when mounted: `unloaded → loading → loaded → unloading → unloaded`, `failed` recoverable by retry.
- **One spawn per load**: argv is `[serverBinary, ...extraArgs, -m <path>, --port <free>, -c <context>]`; ports probe upward from `basePort`; a second concurrent load refuses loud instead of evicting.
- **Health budget**: `/health` polls every `healthPollMs` until `loadTimeoutMs`, then the process tree is terminated and state commits `failed` with the reason; an aborted signal walks `unloading → unloaded` semantics via the abort path and rejects with `aborted`.
- **Catalog scan fails loud** on a corrupt `.gguf` — silent holes are how "why can't I load my model" bugs start. Remove the bad file or fix it.
- Disposal best-effort unloads everything; wedged children die with the subprocess service's own teardown escalation.

## Model Experience

### Local hosting surface

#### What the model sees

Nothing directly: requests reach spawned servers through `ctx.llm` adapter routes pointed at the served port (`api: openai-completions`, per the local-generation-route decision), and those adapters own everything model-visible.

#### Token effect

No direct effect; context-length sizing flows into the spawned server flag only.

#### KV Cache effect

None at this layer; each loaded server owns its KV cache and dies with its process on unload.

## Known Limitations and Deferred Work

- **No downloads** — `startDownload`/`downloads()` reject loud pending E3's download-manager slice.
- **Single-model concurrency** — one spawned server at a time; multi-model residency waits on idle eviction policy (E4 follow-up) rather than hiding eviction behind silent unloads.
