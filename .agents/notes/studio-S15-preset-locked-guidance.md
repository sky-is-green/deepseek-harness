# Studio S15: the locked refusal is guidance, not an error

- **Date:** 2026-08-25
- **Domain/Task:** studio / S15
- **Status:** implemented

## Interfaces & hooks

- `AgentPresetSeatController` grows an optional `copy?: { lockedGuidance: string }` constructor parameter; registration passes the localized sentence from the existing `settings.agentPreset` namespace (new key `switchLocked`, zh+en).
- On a host reply whose error code is `agent-preset-locked`, the chip now renders that sentence instead of the raw server message; every other refusal keeps the server text. Fallback behavior is unchanged (`current` returns to the deployment default).
- The header-label half of the row already shipped (`AgentPresetLabel` names the resolved running preset); no changes there.

## Models

No wire or event changes: `agent-preset-locked` remains a blank-only-rule refusal; only its client presentation moved from raw-message to guidance.

## Verification

ui-agent-preset suites 158/158 (new case asserts the localized sentence replaces the server message when copy is supplied; the pre-existing case pins the no-copy fallback), scoped oxlint clean, per-package `tsc -b` clean.

## Deferred

An in-conversation switch affordance would promise a swap the host refuses by design; the honest control stays on the new-session screen.
