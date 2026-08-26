# @deepseek-ai/dsh-gguf-metadata

English | [中文](README.zh.md)

A dependency-free GGUF header reader: parse architecture, quantization label, context length, and chat template from a weight file's leading kilobytes without loading the file. The main entry is browser-safe (bytes in, metadata out); `@deepseek-ai/dsh-gguf-metadata/node` adds positioned file reads so multi-GB models parse from disk cheaply.

## Contract

- Only GGUF container versions 2 and 3 parse; anything else throws `GgufError` with the offending version — no best-effort v1 guessing.
- Parsing walks the key-value section once and skips array payloads by arithmetic (string arrays walk their length prefixes), bounding every read against fixed spec-derived caps; corrupt or hostile headers fail loud instead of allocating.
- `contextLength` resolves only from `<general.architecture>.context_length`; keys with a different arch prefix are ignored, and key order never matters.
- `quantization` derives from the `general.file_type` enum (mirroring llama.cpp's `LLAMA_FTYPE_*` values); unknown enum members render as `ftype-N`.
- Fields absent from the header stay absent from `GgufMetadata` — presence is information.

## Model Experience

### Weight inspection surface

#### What the model sees

Nothing: this package reads files and returns plain metadata to callers; it contributes no prompt content and registers no tools.

#### Token effect

No direct effect; callers decide what, if anything, the parsed fields imply for requests. The parsed surface is plain JSON — `arch`, `quant`, `contextLength`, `chatTemplate` — so any caller that does turn metadata into prompt content does so explicitly at its own seam.

#### KV Cache effect

None; the reader owns no request state.

## Known Limitations and Deferred Work

- **Header-only by design** — tensor list contents and per-tensor quantization are not read; consumers needing tensor-level detail must extend the parser behind the same byte-source seam.
