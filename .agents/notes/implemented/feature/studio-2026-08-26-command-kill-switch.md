# Agent Note: studio-2026-08-26-command-kill-switch

## Summary
Added `@deepseek-ai/dsh-command-kill` package implementing the `/kill` human-facing slash command (S8 task).

## Changes
- New package: `packages/interaction/command-kill/`
  - Registers `/kill` command via `ctx.commands`
  - Stops all live agents via `agent.cancel({ kind: 'user' })`
  - Kills all jobs per agent via `ctx.jobs.kill()`
  - Closes all terminals per agent via `ctx.terminals.kill()`
  - Unloads all loaded/loading models via `ctx.models.requestUnload()`
  - Reports summary of stopped items and any errors

## Files Created
- `packages/interaction/command-kill/package.json`
- `packages/interaction/command-kill/tsconfig.json`
- `packages/interaction/command-kill/tsdown.config.ts`
- `packages/interaction/command-kill/src/index.ts`
- `packages/interaction/command-kill/src/invariant.ts`
- `packages/interaction/command-kill/README.md`
- `packages/interaction/command-kill/README.zh.md`
- `packages/interaction/command-kill/README.i18n.yaml`

## Dependencies
- Peer: `dsh-commands`, `dsh-jobs`, `dsh-terminal`, `dsh-agent`, `dsh-models`, `dsh-invariants`, `cordis`
- Uses module augmentation side-effects for Context typing

## Verification
- `pnpm run build` ✓
- `pnpm run typecheck` ✓
- `pnpm run lint` ✓

## Known Limitations
- Jobs are per-agent; no global job list
- Models in `failed` state not unloaded
- Fire-and-forget: doesn't await full settlement
- Requires all four services composed