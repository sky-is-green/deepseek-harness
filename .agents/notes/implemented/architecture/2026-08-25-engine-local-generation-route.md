# Agent Note: Local generation rides pi-ai provider profiles; no direct adapter

Status: implemented

English | [中文](2026-08-25-engine-local-generation-route.zh.md)

## Problem

HiveBench Studio serves models from local runtimes (llama.cpp first). The agent loop needs to send requests to those servers like any other provider, and Lane A had to decide between two shapes: point the existing pi-ai adapter at `http://127.0.0.1:<port>/v1` through configuration, or write a dedicated local-generation adapter that speaks llama.cpp directly.

## Decision

**Profiles win.** A hand-declared provider profile is the complete local route:

```yaml
providers:
  local:
    api: openai-completions
    baseURL: http://127.0.0.1:8080/v1
    models:
      - id: qwen3-4b-instruct
        name: Qwen3 4B
        contextWindow: 32768
```

Evidence from the shipped suite: hand-declared OpenAI-compatible routes resolve, list, and stream end-to-end through `ctx.llm` against real localhost HTTP servers (`packages/llm/llm-pi-ai/tests/catalog.spec.ts` unauthenticated-route and headers-auth cases; `sdk-options.spec.ts` dispatch of a fully described local model; `adapter.spec.ts` streaming turns against the localhost mock). Model discovery interrogates `GET /v1/models` with bearer auth — the listing llama.cpp servers expose — so the models list can be entered by hand or discovered.

One deliberate posture matters for keyless servers: naming no credential resolves the route as configured-but-keyless, and pi-ai's OpenAI-compatible implementation then requires either an API key or an `Authorization` header, failing loud rather than letting the harness invent a placeholder (`llm-pi-ai` README documents this). A llama.cpp server started without `--api-key` accepts any bearer value, so the working shape is one line: `headers: { Authorization: "Bearer local" }`. The studio launcher can also generate and pass a token, which then travels in the same header.

Sampling vocabulary flows through today where it exists (`temperature`, output caps); unsupported options such as stop sequences fail loud as `UNSUPPORTED_OPTION` instead of being dropped.

## Alternatives considered

- **A direct llama.cpp adapter on `ctx.llm`** — rejected: every requirement E7 named (custom baseURL, OpenAI-compatible protocol, explicit model list, optional auth) is expressible as a profile, so an adapter would duplicate dispatch, streaming, retry, and attribution machinery for zero capability gain.
- **Auto-injecting a placeholder Authorization header for keyless routes** — rejected for now: the harness deliberately refuses to invent credentials (documented and tested), and silently adding authentication could surprise token-verifying proxies. Revisit only if the one-line header proves a recurring onboarding obstacle.
- **Bypassing `ctx.llm` with sidecar-native generation** — rejected: model-visible output must enter the session log through the loop; a parallel generation path would fork attribution, replay, and tool-call plumbing.

## Consequences

E2–E6 build against configuration, not new transport code: the future `ctx.models` provider launches llama-server, and generation reaches it through a mounted profile whose `baseURL` names the launched port. The conditions that would reopen the direct-adapter question are concrete: a llama.cpp feature no compat switch expresses (per-request grammar/JSON-schema constraints, logit bias) becoming product-critical, or discovery/listing needs beyond `/v1/models`.
