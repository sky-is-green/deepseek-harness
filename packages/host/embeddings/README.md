# `@deepseek-ai/dsh-host-embeddings`

Embedding model hosting + `POST /v1/embeddings` over local llama.

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
