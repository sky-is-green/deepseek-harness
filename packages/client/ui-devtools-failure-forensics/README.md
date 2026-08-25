# @deepseek-ai/dsh-client-ui-devtools-failure-forensics

Richer failure detail in the chat view: one turn-tail chain entry per closing
turn, rendering the `failureForensics` projection entries for that turn —
kind badge, bounded message, machine code, provider request id, kill signal,
bounded output tail, and the deterministic suggested fix.

## Behavior

Rides the `conversation.chat.turnTail` chain slot, so it composes beside the
other tail contributors without touching ui-conversation internals. The
selector accepts every turn (it cannot read reactive projection data); the
component renders null when the projection has no entries for the turn, so
ordinary turns keep exactly the shipped tail. Entries render newest first,
each expandable to its fields.

The fold behind the projection is mounted by `dsh-base`
(`@deepseek-ai/dsh-failure-forensics`); composing either plugin out removes
its half of the surface cleanly.

Enabled by default in the web-app roster: unlike the devtools *view* tabs, it
adds no chrome and renders nothing without captured failures.

## Model Experience

- **Token cost:** zero — presentation over an existing host projection.
- **KV-cache effect:** none; never mounted as a model-facing component.
- **Replay:** the projection is a pure fold, so historical turns render their
  failures identically after reload.

## Known Limitations and Deferred Work

- Hook failures (`hook/result`) are not folded yet; adding them means a new
  entry kind plus locale copy in the same pair of packages.
- The selector accepts every turn, so the component mounts once per turn even
  when it will render null; the chain contract has no cheaper reactive seat
  today.
