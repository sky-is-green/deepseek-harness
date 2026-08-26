# @deepseek-ai/dsh-client-ui-command-palette

English | [中文](README.zh.md)

Web client plugin contributing the global command palette: `Ctrl/Cmd+K` opens a frame-wide palette over the session's available commands through `ctx.commandUi.paletteEntries` (host catalog plus availability-filtered client contributions and bare-invocation decorations). Type-to-filter narrows rows locally; Enter or click runs a row — host commands execute as bare detached executes against the current session (`command.execute`, handler outcomes render as durable flow nodes), popup commands resolve their option list inside the palette and submit the picked option through their own `onSelect`. LeadingInput host rows render inert: argument claims stay composer-owned. With no current session the hotkey stays inert and nothing mounts.

## Composition

Registered once into the existing `shell.overlay` list seat; no SlotMap changes. Requires `ctx.commandUi` (ui-commands), whose `paletteEntries` face it consumes.

```yaml
- id: ui-command-palette
  name: '@deepseek-ai/dsh-client-ui-command-palette'
```

## Model Experience

### Command palette overlay

#### What the model sees

Nothing directly. The overlay lists commands from the `commandUi.paletteEntries` fold and executes them through the existing `command.execute` admission path with its durable lifecycle logging; it never alters prompts, messages, schemas, streams, or tool results beyond what the executed command itself does.

#### Token effect

Zero of its own. An executed command affects the session exactly as typing `/name` would; the palette adds nothing on top.

#### KV Cache effect

None of its own; executed host commands affect the session exactly as typing `/name` would.

## Known Limitations and Deferred Work

- **Option confirmations are not gated** — a popup option carrying `confirmation` runs without the shared shell's acknowledge step; wire it when a shipped contribution actually uses the gate.
- **Substring filtering** — the local filter is substring-based; the slash menu's boundary-aware fuzzy ranking could replace it if palette rosters grow large.
