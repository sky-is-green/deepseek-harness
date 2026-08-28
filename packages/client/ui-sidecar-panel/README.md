# `@deepseek-ai/dsh-ui-sidecar-panel`

English | [中文](README.zh.md)

Client sidecar lifecycle panel (X11 companion to `dsh-sidecar-lifecycle`). Renders `sidecarLifecycle` status as a `settings` section and surfaces bootstrap hints when the host service is absent.

## Configuration

None. Installed as a client plugin; reads `ctx.sidecarLifecycle.status()` when available.

## Extension points

- `settings` section `sidecar` (`order: 40`, title `Sidecar`) — shows `{state, port}` and unavailable hint.

## Model Experience

- **Token cost:** none.
- **KV-cache effect:** none.

## Known Limitations and Deferred Work

- Pure settings rendering; Start/Stop buttons are deferred to a host `webserver` action (panel today is read-only).
- No log tail yet.
