# @deepseek-ai/dsh-client-ui-devtools-prompt-inspector

Per-step assembled-request inspector for the dsh web client: a conversation
view tab that answers "what did the model actually see?" from the durable log.

## What it shows

- **Request headers** — one row per logged `request/header` event, newest
  first. Each row names the provider model, its turn/step location, badges for
  `initial` / system-changed / tools-changed relative to the previous header,
  and expands to the exact rendered system prompt text and the complete tool
  schema catalog sent with the request.
- **Injected context** — every producer-supplied context message
  (`user/message` with a non-user source), with its role (`inject` /
  `recall`), producer label read off the durable source, and a bounded
  plain-text preview.
- **Token composition** — the token-meter `contextBreakdown` projection
  (heuristic system/tools/messages figures) and cumulative `tokenUsage`
  buckets when a provider has reported usage.

The tab registers into `conversation.view` (id `prompt-inspector`) and reads
everything through the framework session kit plus host-computed projections;
it defines no service and contributes nothing to the session log or to any
model request.

## Enabling it

The web-app bundle ships the row disabled — this is a devtools surface, not
production chrome. Re-enable it from any later patch layer (a profile's
`cordis.patch.yml` or a `--patch` overlay) by targeting the row id and
replacing it without `disabled`:

```yaml
- id: ui-devtools-prompt-inspector
  name: '@deepseek-ai/dsh-client-ui-devtools-prompt-inspector'
```

## Model Experience

- **Token cost:** zero — pure client-side projection of already-logged events.
- **KV-cache effect:** none; never mounted as a model-facing component.
- **Replay:** rows are pure folds of durable events, so replaying a log
  rebuilds identical snapshots.

## Semantics and limits

A header row is logged only when the effective envelope changes, so agent-loop
steps that inherit the previous request render under their carrying header's
row rather than getting a row of their own. Section-level attribution (which
prompt section produced which part of the system text) is not available: the
durable log stores only rendered text, so the inspector shows exactly what was
logged. Token figures use the shared fixed-density estimator and are
approximations by design; see `@deepseek-ai/dsh-token-meter` for the
estimator contract.

## Extension points

None. Consumers wanting more per-step data should extend the durable event set
or the token-meter projections; this package stays a read-only view over them.

## Known Limitations and Deferred Work

- Steps without a fresh header are attributed to their carrying header; there
  is no per-step row for inherited envelopes.
- Tool-schema diffing compares serialized JSON, so key-order-only changes
  badge as changed.
