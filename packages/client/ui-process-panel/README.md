# `@deepseek-ai/dsh-client-ui-process-panel`

English | [中文](README.zh.md)

Process manager panel — spawned servers/shells with CPU/RAM and kill buttons.

## Configuration

None. Pure helpers: `formatResources(cpu, memMb)`, `canKill(entry)`, `killProcess(entry, killer)`, `filterProcesses(list, query)`.

## Extension points

- Client `apply` is a no-op effect (proves disposal); full `webServer`/`subprocess` live binding deferred.

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- Mock data — CPU/RAM from `subprocess`/`webServer` not yet wired; kill is via injected `killer` callback
- No live polling — filter + kill ready, auto-refresh deferred
