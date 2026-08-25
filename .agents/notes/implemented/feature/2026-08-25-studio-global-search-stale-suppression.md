# Studio: global search owns stale suppression because the seam says so

- **Date:** 2026-08-25
- **Lane:** studio (S6)
- **Status:** implemented

## Decision

The global search dialog (`packages/client/ui-search`) consumes the existing one-shot `sessions.search` RPC unchanged — debouncing, per-request AbortSignals, and aborted-response suppression live entirely in the dialog — and joins hit titles against the live list snapshot instead of trusting the wire to carry them.

## Why

The session-search contract fixes the wire face deliberately narrow (one page, no cursor, `hasMore` = "refine") and documents stale suppression as each UI owner's duty; the sidebar browser already implements that pattern locally. A global surface re-uses the identical seam rather than growing it: titles come from the list snapshot because "the list snapshot remains the metadata authority", and navigation goes through `sessions.open`, whose list validation doubles as the answer to unlisted hits.

## Consequences

- Unlisted hits render inert rather than opening; a load-then-open flow needs a new list-refresh seam and is deferred.
- The 20-result wire bound shows as "refine your query"; cursor pagination would be a seam change, not a UI change.
