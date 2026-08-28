# @deepseek-ai/dsh-client-ui-kill-switch

English | [中文](README.zh.md)

Web client plugin contributing the `kill-switch` command: one confirmed action that fans a `session.cancel` out to every session in the live list, interrupting all running turns. The single popup option carries the shared shell's risk confirmation (`SelectOption.confirmation`) whose acknowledge step must be checked before anything fires; the confirm button names the live session count, and the tally ("sent stop to N/M sessions") reports back through the opening session's composer notice channel. Best-effort by design: one busy or rejecting session never stops the fan-out.

Queued messages are kept — cancel semantics belong to the runtime (pending work resumes in FIFO order after the Host reaches cancellation quiescence).

## Scope

Covered today: running agent turns across all listed sessions (including subagent interrupts routed by the runtime). Not reachable from a browser yet, therefore deferred until wire surfaces exist: job kills (`ctx.jobs` is host-side), terminal teardown (no client face), and loaded-model unloads (`ctx.models` has no Service Provider until E4) — this command will grow those legs as the seams land.

## Composition

```yaml
- id: ui-kill-switch
  name: '@deepseek-ai/dsh-client-ui-kill-switch'
```

## Model Experience

None of its own: cancellation changes scheduling only; queued messages still run and nothing is deleted or edited.

#### KV Cache effect

None; the plugin never assembles or sends provider requests. Interrupted turns simply stop generating — the provider owns whatever partial-output semantics apply.

## Known Limitations and Deferred Work

- **Jobs/terminals/models not covered** — no browser-reachable seam exists for those today; see Scope.
- **Tally is notice-scoped** — the result renders on the opening session only, matching how other client-only command outcomes surface.
