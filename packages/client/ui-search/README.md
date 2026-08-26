# @deepseek-ai/dsh-client-ui-search

English | [中文](README.zh.md)

Web client plugin contributing the global cross-session search dialog: `Ctrl/Cmd+Shift+F` opens a frame-wide dialog over the runtime's request-local `sessions.search` RPC (`session.search`). Queries debounce and each request carries its own signal — a faster keystroke aborts and supersedes the slower predecessor, per the session-search contract that makes stale suppression the UI owner's duty. Results join the live list snapshot for display titles; only listed sessions navigate (`sessions.open` validates against the list), unlisted hits render with a not-in-list badge. Error, empty, pending, and has-more states surface inline; the wire `hasMore` bound means "refine the query" (no cursor exists on this face).

## Composition

Registered once into the existing `shell.overlay` list seat; no SlotMap changes. Requires nothing beyond the runtime sessions face already mounted in every web assembly.

```yaml
- id: ui-search
  name: '@deepseek-ai/dsh-client-ui-search'
```

## Model Experience

### Global session search dialog

#### What the model sees

Nothing. The dialog reads durable session logs through the Host's search authorization boundary (hits filter to `session.list`-visible sessions); it never alters prompts, messages, schemas, streams, or tool results.

#### Token effect

Zero. Search hits and titles come from stored sessions; opening one navigates to history that was already token-counted when produced.

#### KV Cache effect

None; the plugin never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Unlisted hits are inert** — a hit masked from `session.list` (or evicted between search and click) cannot be opened by design; surfacing a "load then open" flow would need a list-refresh seam.
- **No pagination** — the wire face is one page with a bound; deeper result sets need query refinement until the seam grows a cursor.
