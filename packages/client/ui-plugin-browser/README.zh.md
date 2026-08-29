# `@deepseek-ai/dsh-client-ui-plugin-browser`

English | [中文](README.zh.md)

Plugin browser — discover/installable view over the bundle system. Uses host `bundleRegistry` read face (`listProfiles` + `getBundleClosure`) when available; otherwise renders from injected closure.

## Configuration

None. Pure helpers: `filterPlugins(plugins, filter, onlyInstallable)`, `groupPlugins`, `closureToEntries(closure, installedSet)`.

## Extension points

- Client `apply` is a no-op effect (proves disposal); full `settings` slot wiring deferred until host registry ships.

## Model Experience

- Token cost: none.
- KV-cache: none.

## Known Limitations

- Host integration deferred — browser is pure, no live FS read yet
- No install action — view is discover-only; install will call host bundle writer when it ships
- No cordis `settings.section` registration yet
