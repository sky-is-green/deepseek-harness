# Agent Note: 2026-08-25-studio-command-kill-switch

Status: implemented

English | [中文](2026-08-25-studio-command-kill-switch.zh.md)

## Problem

A runaway studio session needs one confirmed stop action. Stopping everything by hand means visiting each live session surface separately, and a partial stop gives no visibility into what is still running.

## Decision

`packages/client/ui-kill-switch` registers one client command contribution, `kill-switch`, on `ctx.commandUi` (popupSelect kind). Its single option carries `SelectOption.confirmation`; the shared popup shell's risk confirmation gates settlement behind an explicit acknowledge whose confirm label names the live session count. The action fans `SessionFace.cancel()` out over every id in the live list snapshot through `sessions.binding(id)`, best-effort — one rejection never stops the rest — and reports an accepted/total tally through the opening session's composer notice channel. No new session events and no wire-format changes: cancellation reuses the existing `session.cancel` / `subagent.interrupt` routing inside the runtime.

## Alternatives considered

- **A host-side `/kill` command** (`packages/interaction/command-kill` draft): one command calling `ctx.jobs.kill()`, `ctx.terminals.kill()`, and `ctx.models.requestUnload()`. Lost: jobs are host-side, terminals have no client face, and model unload had no provider seam, so none of those legs is reachable from the browser where the switch is needed, and the draft never completed its verification matrix.

## Consequences

One confirmed gesture stops every live session from any composer, with partial-failure visibility in the tally. Jobs, terminals, and loaded models are not stopped until their client seams land; because the fan-out is best-effort, a failing cancel surfaces as a reduced tally rather than blocking the remaining cancels.
