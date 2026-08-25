# Agent Note: The command palette rides a `paletteEntries` fold, not a second registry

Status: implemented

## Problem

The command contract had no public listing face: candidate synthesis (catalog merge, availability filtering, collision detection) is private to the slash source, so a palette built only on public faces could never see client contributions, and rebuilding that synthesis in the palette would duplicate the exact logic whose drift the loud-collision rule guards.

## Decision

The global Ctrl/Cmd+K palette (`packages/client/ui-command-palette`) lists commands through one new read-only method on the existing `CommandUiContract`, `paletteEntries(session, signal)`, which folds the host catalog, availability-filtered contributions, and bare-invocation decorations into self-contained rows (`host` / `popup` with bound `options`/`onSelect`). The palette executes host commands by submitting `/${name}` through `command.execute` and runs popup rows inside its own two-stage UI. Folding once in `ui-commands` keeps the slash menu and the palette on one roster, keeps decorations a bare-invocation replacement in both surfaces, and confines the shared-package change to one additive method plus its fold.

## Alternatives considered

- Rebuild candidate synthesis inside the palette over public faces only — rejected: it duplicates the logic whose drift the loud-collision rule guards and still cannot see client contributions without a new contract method.
- Give the palette its own registry and let both surfaces register separately — rejected for the same drift reason: two rosters invite the exact divergence the shared fold removes.

## Consequences

- Host rows carrying `leadingInput` surface as inert (`argsRequired`) — argument claims remain composer-owned; executing them from the palette would bypass the claim machinery's admission path.
- Popup options run without the shared shell's `confirmation` gate for now (no shipped contribution uses it); wiring the risk gate into the palette is deferred until one does.
- Local filtering is substring-based rather than the slash menu's fuzzy ranking; swap in if rosters grow.
