# Agent Note: Inbound OpenAI serving proxies to provider-spawned servers over an optional capability

Status: implemented

English | [中文](2026-08-26-engine-E5-openai-endpoint.zh.md)

## Problem

Task E5 (LM Studio parity) needs external OpenAI clients to consume locally hosted models. The models seam deliberately keeps endpoint exposure out of its vocabulary ("endpoint exposure belongs to Service Providers"), so a serving plugin cannot learn where the loaded model's llama-server listens — the one fact every inbound request needs.

## Decision

- **Optional capability interface, detected structurally.** `dsh-models` gains `ModelServeEndpoints` (`serveEndpoint(modelId): string | undefined`) as a types-only addition; no abstract method, no breaking change for existing consumers (S1 renders untouched). `models-local` implements it by tracking each spawn's port from allocation to teardown, so capability presence and process lifetime stay in lockstep.
- **Proxy, not reimplementation.** `@deepseek-ai/dsh-host-openai-endpoint` mounts two exact routes on the existing webserver carrier and forwards bodies verbatim — including SSE frames through a backpressured pipe — because llama-server already speaks fluent OpenAI. Parsing generation payloads would only create a second place to drift from the wire format.
- **Degradation is explicit.** A provider without the capability, or with no live server for the target, answers OpenAI-style 503 envelopes; resolution failures use 400/404/503 with typed error strings. Nothing throws into the webserver's per-request guard that a routing decision can answer honestly instead.

## Alternatives considered

- **Extend `ModelLoadState` with the endpoint** — rejected: it changes a landed seam type consumed by S1 and makes every state emission carry connection facts only serving consumers need.
- **Config-declared static upstream URL** — rejected: it decouples serving from load state, so `/v1/models` would advertise models whose servers are dead and chat would hit closed ports.
- **Standalone HTTP server in the plugin** — rejected: the studio already owns one listener lifecycle (`webserver`), and duplicating bind/teardown/auth plumbing splits the security posture across two sockets.

## Consequences

E6 (embeddings) extends the same route table rather than inventing transport. External clients now address loaded models at `http://<webserver>/v1`; auth is one shared bearer token until a deployment needs identities. The client-disconnect abort propagation is asserted against a real socket in tests, so the SSE passthrough cannot silently regress to buffered proxying.
