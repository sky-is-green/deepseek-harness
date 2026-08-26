# Agent Note: Global search owns stale suppression because the seam says so

Status: implemented

English | [中文](2026-08-25-studio-global-search-stale-suppression.zh.md)

## Problem

The session-search contract fixes the wire face deliberately narrow (one page, no cursor, `hasMore` = "refine") and documents stale suppression as each UI owner's duty. A global search surface therefore needs its own debounce, abort, and suppression story, plus a title source — the wire does not carry titles.

## Decision

The global search dialog (`packages/client/ui-search`) consumes the existing one-shot `sessions.search` RPC unchanged — debouncing, per-request AbortSignals, and aborted-response suppression live entirely in the dialog — and joins hit titles against the live list snapshot instead of trusting the wire to carry them. The sidebar browser already implements the identical seam pattern locally, so a global surface re-uses it rather than growing it: titles come from the list snapshot because "the list snapshot remains the metadata authority", and navigation goes through `sessions.open`, whose list validation doubles as the answer to unlisted hits.

## Alternatives considered

- Grow `sessions.search` to return joined titles and cursor pagination — rejected: the contract's narrow face is deliberate, and pagination is a seam change rather than a UI change.
- Trust the response payload alone and render hits verbatim — rejected: stale responses after rapid typing would open wrong or deleted sessions; suppression is this owner's duty by contract.

## Consequences

- Unlisted hits render inert rather than opening; a load-then-open flow needs a new list-refresh seam and is deferred.
- The 20-result wire bound shows as "refine your query"; cursor pagination would be a seam change, not a UI change.
