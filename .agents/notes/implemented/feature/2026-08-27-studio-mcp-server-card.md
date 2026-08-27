# Agent Note: MCP server manager card

Status: implemented

English | [中文](2026-08-27-studio-mcp-server-card.zh.md)

## Problem

Host `mcp-client` is config-driven and list-valued, loaded once per server from `cordis.yml` and requiring a host restart. Users had no in-product surface to inspect which MCP servers are configured or to add and remove them without hand-editing files. Earlier drafts proposed a bespoke settings page plus a host probe (`mcp/testConnectivity`), which together are an E-sized effort.

## Decision

Add a single `mcp` namespace card inside the existing `ui-settings-plugins` card framework (`packages/client/ui-settings-plugins`):

- **One staged field, `servers: McpServerConfig[]`, serialized as JSON.** `CardForm` owns the revision-fenced write (`scope.set('servers', next)` / `unset` when empty), so concurrent edits surface as `saveFailed` and no new wire RPC is needed. The spec validates JSON shape, `serverName` pattern (`^[A-Za-z0-9_-]{1,32}$`), required `command`/`url` per transport, and duplicate names; invalid drafts block the save.
- **Controller stages add/remove locally.** `McpCardController` keeps a draft for the new-server form (`serverName`, `transport`, `command`, `argsText`, `url`), validates it against the current staged list, and stages additions and removals by editing the single JSON field. Draft edits publish through the same `SnapshotStore` the renderer reads, so the list and the form stay in sync without a second subscription.
- **UI is a normal `settings.plugin.item` card (`McpCard`).** It shows the effective or staged list (with a restart hint), lets each row be removed, and offers a small add form that switches between `stdio` (`command` + space-separated `args`) and `streamable-http` (`url`). The card is invisible while the `mcp` namespace is not served (`available === false`), matching the other plugin cards.

The change is client-only; `test-connectivity` stays deferred to `X19`.

## Alternatives considered

- **Bespoke MCP settings page.** A dedicated page could render richer per-server health and test-connectivity inline, but required a new settings section, host probe RPC, and a second write path. Rejected: keep `S12` to the card framework and defer probing to `X19`.
- **One field per server (e.g. `server.<name>`).** Would give per-field dirty tracking, but turns an ordered list into a sparse key-value map and needs key-rename handling on `serverName` edits. Rejected: a single array field keeps ordering and atomic writes simple.
- **Direct file edit without staging.** Writing on every keystroke would create one durable write per character and lose the preview-before-save contract the other cards provide. Rejected: reuse `CardForm` staging.

## Consequences

- Users can manage MCP servers from Settings > Plugins without editing `cordis.yml`; changes are staged, validated, and written with revision fencing, then applied after host restart (hint rendered in the card). Host `mcp-client` needs no client change to read the `mcp.servers` value when it is eventually wired.
- Adding a new transport only extends the `McpServerConfig` union, the draft form, and the JSON validator; the card's save path is unchanged.
- Deferred: live connectivity probe and per-server enable/disable remain `X19` work.
