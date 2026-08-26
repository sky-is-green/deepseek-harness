# Agent Note: Failure forensics as a projection fold plus turn-tail chain entry

Status: implemented

English | [中文](2026-08-25-xray-failure-forensics-projection.zh.md)

## Problem

X4 wants model crashes and tool timeouts captured with exit/signal identity, output tail, and a suggested fix, surfaced as richer error presentation. Failure facts ARE durable today — `turn/end` error reasons carry `LlmFailure`, `llm/retry` carries the retry trail, `tool/result` carries structured error identity and `isError`, shell results embed `[exit code]` / `[killed by signal]` markers in their model-facing text — but nothing folded them into one queryable shape, and the chat's error pill showed only a message string. Adding a NEW session event for forensics would touch frozen core types, require SDK snapshot updates across both SDKs, and duplicate information the log already carries.

## Decision

Two additive packages:

- `@deepseek-ai/dsh-failure-forensics` (host, mounted in dsh-base) registers the `failureForensics` projection unit: a pure fold over existing events producing at most 20 entries (oldest evicted), each with kind, bounded message, machine code, tool name from `callId` pairing, output tail, kill signal parsed from result text, and a deterministic `suggestedFix` (timeout / credentials / rate-limit / binary-missing / signal; null rather than guessed). Plain non-zero command exits are deliberately NOT captured — they are everyday workflow, not forensics. Bounds are fixed constants of the wire shape, not config.
- `@deepseek-ai/dsh-client-ui-devtools-failure-forensics` (web) contributes one `conversation.chat.turnTail` chain entry that renders the closing turn's entries newest-first, expandable to fields and output tail. Chain composition means zero edits to ui-conversation; the component renders null when the projection has no entries for the turn, so ordinary turns keep the shipped tail exactly.

Unlike the devtools view tabs, this row ships enabled: it adds no chrome and renders nothing without captured failures.

## Alternatives considered

- A new structured session event written at failure time: rejected — core `SessionEventMap` is frozen reference for lanes, requires dual-SDK expected output updates, and re-records what the log already contains; a projection keeps one source of truth and replays identically.
- Rendering stderr directly from subprocess captures: rejected — raw process output is non-durable wire view data; the durable artifact is the model-facing result text, which is exactly what a replayed log can serve.
- Replacing `conversation.details.tool` to enrich error display: rejected — that seat renders EVERY tool's output for the session; takeover semantics would fork the whole panel.

## Consequences

Hook failures (`hook/result`) are not folded yet; adding them means a new entry kind plus locale copy in the same pair of packages. The chain selector accepts every turn because selectors cannot read reactive projection data, so the component mounts once per turn even when it renders null — the cheap, sanctioned cost of the current slot contract. Forensics quality is bounded by durable signal quality: provider request ids appear only when adapters report them, and stderr reaches entries only through the model-facing text markers the shell tools already emit.
