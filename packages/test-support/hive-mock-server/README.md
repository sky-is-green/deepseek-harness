# @deepseek-ai/dsh-hive-mock-server

English | [中文](README.zh.md)


## Model Experience

### Sidecar wire stub

#### What the model sees

Nothing. The stub serves canned HTTP responses on `POST /v1/hive/curate`, `POST /v1/hive/observe`, and `POST /v1/protocol/run`; it never talks to an LLM and exists so sidecar-consuming lanes (UI surfaces, curator changes, bench tooling) test without the Python sidecar running.

#### Token effect

Zero. Responses are static or scripted fixtures with no token accounting of any kind.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The stub keeps all state in memory; there is no persistence or comb.
- No SSE streaming endpoints (`/v1/hive/stream`) yet — streaming consumers still need the Python sidecar or hand-rolled fakes (tracked on the X1 row of MULTI-OX-PROJECT-PLAN.md).
