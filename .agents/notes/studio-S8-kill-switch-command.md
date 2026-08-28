# Studio S8: the kill switch is a confirmed fan-out of `session.cancel`

- **Date:** 2026-08-25
- **Domain/Task:** studio / S8
- **Status:** implemented

## Interfaces & hooks

- New package `packages/client/ui-kill-switch` (`@deepseek-ai/dsh-client-ui-kill-switch`), browser half only.
- Registers one client command contribution `kill-switch` on `ctx.commandUi` (popupSelect kind); no slots, no stores.
- The single option carries `SelectOption.confirmation`; the shared popup shell (`RiskConfirmation`) gates settlement, so nothing fires until the acknowledge checkbox is checked. The confirm label names the live session count.
- Action fans `SessionFace.cancel()` out over every id in the live list snapshot via `sessions.binding(id)`, best-effort (one rejection never stops the rest); tally reported through the opening session's composer notice channel (`conversation.input.for(actx).notify('info', …)`).
- Registered in `tsconfig.client.json`, web-app bundle rows + dependency.

## Models

No new session events, no wire changes: cancellation reuses the existing `session.cancel` / `subagent.interrupt` routing inside the runtime. Queued messages are kept by runtime semantics.

## Deferred legs

Jobs (`ctx.jobs` is host-side), terminals (no client face), and loaded models (`ctx.models` has no provider until E4) have no browser-reachable seam today; the command grows those legs when the seams land.

## Verification

Focused spec 5/5 (`tests/apply.client.spec.ts`: registration + HMR disposal, confirmation gate with live count, fan-out + tally notice, partial-failure tally), scoped oxlint clean, per-package `tsc -b` clean, `verify-client-packages` clean for this package.
