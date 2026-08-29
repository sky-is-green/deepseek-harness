# `@deepseek-ai/dsh-client-ui-models-manager`

English | [中文](README.zh.md)

Model manager v2 — one-click `fetchToFile` resume + `modelsDir` picker (LM Studio default `~/.lmstudio/models` or `.lmstudio\\models` on Windows, fallback `models/gguf`).

## Configuration

None. Client helpers are pure; `resolveModelsDir(preferred, lmStudioDir)` picks `preferred` → LM Studio → fallback. `fetchToFileWithResume` wraps `fetch` with Range resume, `.part` staging, 416 finalize-or-restart, and per-chunk progress.

## Extension points

- Pure helpers: `lmStudioDefaultDir(platform, homeDir)`, `resolveModelsDir`, `pickerHint`, `fetchToFileWithResume`, `createMemoryWriter` — import from `./src/client/*` for tests or future settings UI.
- Client `apply` is a no-op effect (proves disposal); full settings slot wiring deferred until host models service ships.

## Model Experience

- **Token cost:** none — all local or direct HF fetch.
- **KV-cache effect:** none.

## Known Limitations and Deferred Work

- No host FS integration yet — browser writer is in-memory (`createMemoryWriter`); host side will map to real `modelsDir` via `ctx.fs` when the service lands.
- No cordis `settings.section` registration yet — picker UI is pure and will mount once `ctx.models` provides `modelsDir` persistence.
- No progress UI — `onProgress` callback ready, panel rendering deferred.
