# @deepseek-ai/dsh-failure-forensics

English | [中文](README.zh.md)


## What it folds

Every input is an already-committed session event; nothing here writes to the log or touches a model request.

| Signal | Event | Entry kind |
|---|---|---|
| Model failure closing a turn | `turn/end` reason `error` | `model-error` |
| Provider retry | `llm/retry` | `model-retry` |
| Tool timeout | `tool/result` with `error.code === 'TOOL_TIMEOUT'` | `tool-timeout` |
| Structured tool error | `tool/result` with `error` or an `isError` block | `tool-error` |
| Signal-killed command | `[killed by signal: …]` marker in result text | `command-killed` |
| Failed compaction attempt | `compaction/end` with `error` | `compaction` |

Tool names come from pairing each `tool/call` identity with its `toolCallId`-keyed result; plain non-zero command exits are deliberately not captured — they are everyday workflow, not forensics.

Suggested fixes map deterministically from kind/code: `timeout`, `credentials` (AUTH/UNAUTHORIZED), `rate-limit` (RATE_LIMIT/429), `binary-missing` (ENOENT), `signal`. Everything else carries no hint rather than guessing.

## Bounds

Fixed protocol constants of the wire shape, not tunables: 20 retained entries (oldest evicted first), 200-char message cap, 400-char output tail, 64 open tool-call identities. The state is plain JSON and checkpoints through the projection cache like any other unit.

## Mounting

Shipped in `dsh-base`; registration is an effect on `sessionProjections`, so composing this plugin out removes the key and clients read capability absence. The web client's richer turn-tail row lives in `@deepseek-ai/dsh-client-ui-devtools-failure-forensics`.

## Extension points

None. New signals join by extending the fold switch in the same package that owns the entry shape.

## Model Experience

### Failure-signal projection

#### What the model sees

Nothing. The `failureForensics` projection is a host-side read-only fold over already-committed session events (`turn/end`, `llm/retry`, `tool/result`, `compaction/end`); its entries exist for devtools rendering and never enter a prompt assembly.

#### Token effect

Zero. Folding consumes events whose tokens were counted where they were produced, and the bounded entry list is served to clients, not to providers.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Hook-result signals are not folded yet** — adding them requires a durable signal owner for `hook/result` before a fold-switch entry can reference it.
