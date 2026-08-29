# X18 Promotion flow — XRAY

Date: 2026-08-29
Task: X18 — Promotion flow: one command promotes a validated candidate to a real preset id (rename + roster order rewrite), with rollback kept as the untouched candidate directory
Worker: QUEEN @ hivebench-X18
Branch: hive/X18 -> master

## What changed
- packages/preset/preset-trainer (new, 7 files): validatePromotion, promoteCandidate pure roster rewrite + rollback id, 4 tests green, tsc -b green, oxlint 0, invariant, README
- pnpm-lock.yaml: regen for new preset package

## Why
Trainer chain X15 evidence → X16 candidate → X17 eval → X18 promotion needs a safe promote that renames candidate dir to real id and rewrites roster, keeping candidate untouched for rollback. Pure helpers unblock the command.

## Verification
- pnpm vitest run packages/preset/preset-trainer/tests: 4/4 green
- pnpm exec tsc -b packages/preset/preset-trainer: exit 0
- oxlint: 0 errors
- hotspot: pnpm-lock single-file

## Interfaces
- Pure: validatePromotion(candidateId, newId, roster), promoteCandidate(candidateId, newId, roster) -> {roster, rollbackId, newId}
- No FS side effects — caller handles rename; rollback is candidate dir kept

## Known limitations
- Pure roster rewrite only — FS rename and roster file write are caller's responsibility
- No validation beyond id format and roster presence
