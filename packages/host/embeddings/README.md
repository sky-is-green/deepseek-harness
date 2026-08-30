---
description: "Embedding model hosting + /v1/embeddings over local llama"
kind: "package-reference"
---

# `@deepseek-ai/dsh-host-embeddings`

## Summary

Embedding model hosting + `POST /v1/embeddings` over local llama.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Usage

Registers `POST /v1/embeddings` on `webServer`:

```json
{ "model": "my-gguf", "input": "hello" }
{ "model": "my-gguf", "input": ["a", "b"] }
```

Returns OpenAI shape:

```json
{ "object": "list", "data": [{ "object": "embedding", "embedding": [0.1, ...], "index": 0 }], "model": "my-gguf", "usage": { "prompt_tokens": 2, "total_tokens": 2 } }
```

Deterministic 8-dim mock vectors when no local model is loaded; host side will proxy to llama-server when `ctx.models` provides embeddings.

## Model Experience

- Token cost: none (local).
- KV-cache: none.

## Known Limitations

- Mock embeddings only — no real model inference yet (host will proxy to llama.cpp when embeddings model is loaded)
- 1 MiB body limit, 400 on bad input, 405 on method
- No auth — relies on webServer's existing auth

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
