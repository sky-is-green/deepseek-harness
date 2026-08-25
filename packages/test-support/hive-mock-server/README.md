# @deepseek-ai/dsh-hive-mock-server

Scriptable HTTP stub of the Hive sidecar wire contract for tests and offline
development. It serves the three endpoints sidecar consumers use —
`POST /v1/hive/curate`, `POST /v1/hive/observe`, `POST /v1/protocol/run` —
with response bodies that byte-match `@deepseek-ai/dsh-hive`'s
`CurateResponse` / `ObserveResponse` types and the Python sidecar's live
shapes.

## Model experience

Zero model interaction: this package never talks to an LLM. It exists so
sidecar-consuming lanes (UI surfaces, curator changes, bench tooling) test
without the Python sidecar running.

Behavior per endpoint:

- **curate** — bumps a per-conversation turn counter and returns the stored
  chunks joined as `assembled_content` (empty on a fresh conversation, which
  mirrors the real store).
- **observe** — stores the reply when non-empty and returns `{ok, stored,
  turn}`.
- **protocol/run** — returns a synthetic `{run_dir, pid: null}`.

Scriptability: pass `script: ['server_error', 'observe_notstored', …]` to
queue per-request behaviors consumed FIFO before the default success path;
pass `token` to require a matching `x-hive-token` header (401 otherwise).

```ts
import { startHiveMockServer } from '@deepseek-ai/dsh-hive-mock-server'

const mock = await startHiveMockServer({ script: ['curate_error'] })
// point SidecarClient at mock.url; inspect mock.requests afterwards
await mock.close()
```

## Known Limitations and Deferred Work

- The stub keeps all state in memory; there is no persistence or comb.
- No SSE streaming endpoints (`/v1/hive/stream`) yet — streaming consumers
  still need the Python sidecar or hand-rolled fakes (tracked on the X1 row
  of MULTI_AGENT_PLAN.md).
