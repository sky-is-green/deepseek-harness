# @deepseek-ai/dsh-host-openai-endpoint

English | [中文](README.zh.md)

Inbound OpenAI-compatible serving plugin (default-exported `OpenAiEndpoint`, config `{enabled?, bearerToken?}`): registers two exact routes on [`dsh-host-webserver`](../webserver/README.md) — `GET /v1/models` and `POST /v1/chat/completions` — and proxies them to the llama-server process that the `ctx.models` provider spawned for the target model, so external OpenAI clients (IDEs, agents, scripts) use locally hosted models by pointing their base URL at the studio. Requests and responses are forwarded verbatim, including SSE streams; this package never parses generation payloads. Mount after both the web server and a models provider; `enabled: false` registers nothing, and teardown releases both routes.

`GET /v1/models` answers the full local catalog in the OpenAI list envelope (`id`, `object: 'model'`, `created: 0`, `owned_by: 'studio'`). For chat, a non-empty `"model"` field matches catalog ids or display names; without one, exactly one loaded llm must exist — zero answers a 503 envelope, several a 400 naming them, an unknown name a 404. Upstream discovery rides the optional `ModelServeEndpoints` provider capability detected structurally (`serveEndpoint(modelId)`), so providers that do not spawn servers degrade to explicit 503 envelopes instead of breaking mount. The upstream reply's status and content type pass through untouched, bodies stream via backpressured pipe, and a client disconnect aborts the upstream request mid-stream. When a `bearerToken` is configured, every `/v1/*` request needs `Authorization: Bearer <token>`; otherwise 401 envelopes. Bodies larger than 32 MiB answer 413 before any upstream work; malformed JSON answers 400.

## Model Experience

### OpenAI serving surface

#### What the model sees

Proxied `POST /v1/chat/completions` payloads reach the loaded `llama-server` verbatim, including the `model` field that resolves catalog ids or display names; `GET /v1/models` exposes the local catalog as `owned_by: 'studio'` entries. The plugin registers no prompt or tool schemas of its own.

#### Token effect

No prompt assembly in this layer; bodies stream via `pipeline()` with a 32 MiB cap, so request token count is whatever the upstream server counts.

#### KV Cache effect

None at this layer; each spawned `llama-server` owns its KV cache and dies with its process on unload.

## Known Limitations and Deferred Work

- **Two routes, not the whole surface** — `/v1/models` and `/v1/chat/completions` only; embeddings (`/v1/embeddings`) arrive with task E6, and other completions endpoints stay deferred until a consumer asks.
- **Bearer auth, no identities** — one shared token guards the surface; per-client keys, rate limits, and usage metering are deployment work this v1 deliberately leaves out.
- **Single-upstream assumption** — each request resolves to exactly one model's server at dispatch time; there is no queueing, load balancing, or multi-model fan-out.
